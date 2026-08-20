# Dashboard — Data Model, Business Rules, API Contract

Everything the Dashboard needs, and nothing it doesn't. Build only these tables and only these endpoints.

---

## 1. Data model

Five tables. `payments`, `chase_events`, `cadences`, and `messages` are **out of scope** — do not create them, do not stub them.

### `organisations`
```
id                 UUID  PK
name               text  not null
timezone           text  not null  default 'Asia/Kolkata'
financial_year_start_month  int  not null  default 4   -- April, for Indian FY
created_at         timestamptz  not null  default now()
```

### `users`
```
id                 UUID  PK
org_id             UUID  FK organisations  not null
name               text  not null
email              citext  not null  unique
created_at         timestamptz
```

### `accounts`
```
id                 UUID  PK
org_id             UUID  FK organisations  not null
name               text  not null
status             account_status  not null  default 'Active'
created_at         timestamptz
```
Enum `account_status`: `Active | Paused`

Index: `(org_id, name)`

### `contacts`
```
id                 UUID  PK
account_id         UUID  FK accounts  not null
tier               contact_tier  not null
name               text
email              citext
phone              text
delivery_state     delivery_state  not null  default 'unverified'
created_at         timestamptz
```
Enum `contact_tier`: `P0 | P1 | P2`
Enum `delivery_state`: `verified | unverified | bounced`

Partial unique index: one contact per tier per account —
`CREATE UNIQUE INDEX ON contacts (account_id, tier)`

### `invoices`
```
id                    UUID  PK
org_id                UUID  FK organisations  not null
account_id            UUID  FK accounts  not null
number                text  not null            -- 'INV-1042'
issue_date            date  not null
due_date              date  not null
amount_gross          numeric(14,2)  not null    -- ALWAYS gross. Never net of TDS.
amount_paid           numeric(14,2)  not null  default 0
status                invoice_status  not null
disputed_at           timestamptz
promised_date         date
promise_broken_count  int  not null  default 0
last_reminder_at      timestamptz
reminder_count        int  not null  default 0

-- priority, written by the scorer, never by a request handler
priority_score        numeric(6,3)
priority_band         priority_band
priority_reason       text
priority_computed_at  timestamptz
```
Enum `invoice_status`: `Not yet due | Open | Partially paid | Promised | Disputed | Paid | Written off`
Enum `priority_band`: `Chase now | Watch | Escalate`

Unique: `(org_id, number)`
Index: `(org_id, status, due_date)`, `(org_id, priority_score DESC)`

**Derived, never stored:** `amount_outstanding = amount_gross - amount_paid`. Expose as a hybrid property on the model.

**Dates are plain `date`, evaluated in the org's timezone.** `days_overdue` is computed against today's date in `org.timezone`. Do not add timezone conversion to `due_date`. Someone will helpfully try; don't let them.

---

## 2. Business rules — implement in `services/`, test each one

### 2.1 Chase-queue eligibility

An invoice enters the chase queue only if **all** of these hold:

```python
account.status == "Active"
invoice.status in ("Open", "Partially paid")
days_overdue > 0
account has a contact where tier == "P0" and delivery_state != "bounced"
```

Explicitly excluded, with the reason each matters:

| Excluded | Why |
|---|---|
| `status == "Disputed"` | A disputed invoice has no chase priority. Chasing it escalates a conflict. |
| `status == "Promised"` **and** `promised_date >= today` | An active promise pauses chasing. See 2.2. |
| account has no usable P0 | There is nobody to send to. The action would silently fail. |
| `status in ("Paid", "Written off")` | Nothing owed. |
| `status == "Not yet due"` | Nothing overdue. |

This filter lives in **one** function, `services/chase_queue.py::eligible_invoices(db, org_id)`. Nothing else may reimplement it. The Dashboard, Invoices, and Accounts screens will all call it.

### 2.2 Promise handling

- An active promise (`promised_date >= today`) pauses chasing but the invoice **stays out of the aged-debt bucket** even past 90 days. Do not bucket a live conversation as dead debt.
- A promise more than 45 days out is accepted but the pause is **capped at 45 days**; after that the invoice re-enters the queue. An unbounded pause is a stalling tactic.
- A promise date in the past is treated as immediate — no pause.
- The latest promise supersedes earlier ones, but `promise_broken_count` accumulates. Three broken promises is a strong escalation signal and feeds the priority modifier.

### 2.3 Priority score

Multiplicative urgency × value, so a small very-old invoice and a large slightly-late one don't both flood the top.

```python
# value normalisation, per org
p95 = 95th percentile of amount_outstanding across the org's eligible invoices
if org has fewer than 15 eligible invoices:
    p95 = max(amount_outstanding)          # percentile is meaningless at low n
if p95 == 0:
    value_norm = 0.0                       # guard: single zero-value invoice
else:
    value_norm = min(amount_outstanding / p95, 1.0)

urgency_norm = min(days_overdue / 60, 1.0)

modifier = 1.0
if promise_broken_count >= 1:  modifier *= 1.25
if promise_broken_count >= 3:  modifier *= 1.15   # cumulative, on top of the above
if reminder_count >= 2 and days_since_last_reminder > 7:  modifier *= 1.15
if status == "Partially paid":  modifier *= 0.85  # they are engaging

score = (0.5 + urgency_norm) * (0.5 + value_norm) * modifier
```

Band thresholds — keep as named constants in one module so they can be tuned without a code hunt:

```python
BAND_ESCALATE  = 1.60    # score >= this
BAND_CHASE_NOW = 1.00    # score >= this
# otherwise: Watch
```

**Recompute:** nightly batch, plus on-demand when an invoice, payment, or promise changes. Store `priority_computed_at`. If it is over 24 hours old, the API returns `stale: true` and the frontend shows the sync line in `--warn-text`. *(Out of scope for this build: only implement the on-demand path and a `scripts/recompute_priority.py` entry point. No scheduler.)*

### 2.4 Reason string

Resolved from the dominant contributor, first match wins. These exact strings:

| Condition | Reason |
|---|---|
| `promise_broken_count >= 1` | `Promise broken on {date:%-d %b}` |
| `reminder_count >= 2 and days_since_last_reminder > 7` | `Second reminder went unanswered` |
| invoice is the largest outstanding in the queue | `Largest overdue balance, {days} days` |
| `days_overdue` is 1–3 days short of 45 | `Crosses the 45-day mark tomorrow` |
| `days_overdue >= 60 and value_norm < 0.2` | `Small amount but {days} days old` |
| `reminder_count == 0` | `Small balance, first reminder due` |
| fallback | `{days} days overdue` |

Reason is generated in Python and returned as a string. The frontend never builds it.

### 2.5 Aging buckets

Computed on `amount_outstanding`, bucketed by `days_overdue`:

```
Not yet due   days_overdue <= 0
1–30          1  <= days_overdue <= 30
31–60         31 <= days_overdue <= 60
61–90         61 <= days_overdue <= 90
90+           days_overdue > 90
```

Buckets cover **all** open invoices, including Disputed and Promised ones. Aging is a statement of exposure, not of chaseability — a disputed invoice is still money you're owed.

**Invariant, asserted in a test:** the five buckets sum exactly to `total_outstanding`.

---

## 3. API contract

Base path `/api/v1`. All responses JSON. Money as **decimal strings**, never floats.

### `GET /api/v1/dashboard/summary`

```json
{
  "as_of": "2026-08-17T09:12:00+05:30",
  "stale": false,
  "tiles": {
    "total_outstanding": "1840000.00",
    "account_count": 47,
    "overdue": "920000.00",
    "overdue_share_pct": 50.0,
    "open_invoice_count": 128,
    "missing_contact_account_count": 6
  },
  "aging": [
    { "bucket": "Not yet due", "amount": "920000.00", "share_pct": 50.0 },
    { "bucket": "1–30",        "amount": "260000.00", "share_pct": 14.1 },
    { "bucket": "31–60",       "amount": "240000.00", "share_pct": 13.0 },
    { "bucket": "61–90",       "amount": "180000.00", "share_pct":  9.8 },
    { "bucket": "90+",         "amount": "240000.00", "share_pct": 13.0 }
  ],
  "attention": {
    "accounts_without_p0": 6,
    "disputes_open": 1,
    "promises_broken_this_week": 3
  }
}
```

Aging array order is fixed and matches the enum order. The frontend renders in array order and does not sort.

### `GET /api/v1/dashboard/chase-queue?limit=6`

```json
{
  "total_eligible": 41,
  "items": [
    {
      "invoice_id": "…",
      "account_id": "…",
      "account_name": "Meridian Industries Pvt Ltd",
      "invoice_number": "INV-1042",
      "amount_outstanding": "460000.00",
      "days_overdue": 38,
      "priority_band": "Escalate",
      "priority_reason": "Largest overdue balance, 38 days"
    }
  ]
}
```

`limit` defaults to 6, max 50. Sorted by `priority_score` descending, `amount_outstanding` descending as tiebreak.

### `POST /api/v1/chases`

```json
// request
{ "invoice_ids": ["…", "…", "…"] }

// 202 response
{ "queued": 3, "skipped": [] }
```

**Re-validate eligibility server-side** on every invoice in the request. The client's list may be stale — an invoice can be paid or disputed between page load and click. Any that fail go into `skipped` with a reason:

```json
{ "queued": 2, "skipped": [ { "invoice_id": "…", "reason": "Disputed" } ] }
```

For this build, "queued" means a row is written to an append-only `chase_requests` table with `(invoice_id, requested_by, requested_at)`. No message is sent. Sending is a later milestone.

### Errors

Standard shape on every 4xx/5xx:
```json
{ "error": { "code": "aggregates_unavailable", "message": "Couldn't load your totals." } }
```
The `message` field is user-facing copy and must follow the voice rules in `CLAUDE.md`. The frontend displays it verbatim; it does not write its own error strings.

---

## 4. Tests that must exist

```
test_eligibility_excludes_disputed
test_eligibility_excludes_account_without_p0
test_eligibility_excludes_bounced_p0_only_contact
test_eligibility_includes_partially_paid
test_active_promise_pauses_chase
test_promise_beyond_45_days_caps_pause
test_past_promise_date_does_not_pause
test_aging_buckets_sum_to_total_outstanding
test_aging_includes_disputed_invoices
test_priority_low_volume_org_uses_max_not_p95
test_priority_single_zero_value_invoice_does_not_divide_by_zero
test_reason_resolver_first_match_wins
test_chase_post_reskips_invoice_disputed_after_page_load
test_seed_data_reproduces_spec_table_exactly
```

That last one is the important one: assert that `GET /dashboard/chase-queue?limit=6` against the seed database returns exactly the six rows in `dashboard-spec.md`, in that order, with those bands and those reason strings. If the scorer drifts, that test tells you before the screen does.
