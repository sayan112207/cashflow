# Account Settings Tab — Rebuild

Scope: `AccountSettingsPanel` only. Nothing else on the account detail page changes.

```
git checkout feat/account-detail-v2
git checkout -b feat/account-settings-v2
```

---

## What this tab now is

It stopped being account configuration and became **per-account chasing configuration**. Five sections:

1. **Chasing cadence** — three modes: follow the org default, override it per-account, or don't chase at all. In override mode, six step cards each with tone, channel, and recipient tier.
2. **Escalation contacts** — read-only P0/P1/P2 summary with a link to the Contacts tab.
3. **Send window** — org default or a per-account window with times and weekdays.
4. **Account terms** — payment terms, expected TDS, and an MSME 43B(h) flag.
5. **Ownership and notes** — account owner and free-text context.
6. **Danger zone** — archive, gated behind typing the account name.

Plus two lock states: paused (banner, panel dimmed, Resume button) and no-admin (banner, panel dimmed).

---

## Files

| File | Action |
|---|---|
| `accounts-settings-schema-changes.ts` | apply to `src/lib/schemas/accounts.ts` |
| `AccountSettingsPanel.tsx` | replaces the existing file wholesale |
| `CadenceStepEditor.tsx` | new, in `src/components/app/` |

Then add to `src/lib/services/accounts.ts` and `src/lib/queries/account-detail.ts`:

```ts
updateChasingSettings(accountId, body, ifMatch): Promise<AccountDetail>
archiveAccount(accountId, body, ifMatch): Promise<AccountDetail>

useUpdateChasingSettings(accountId)
useArchiveAccount(accountId)
```

`updateAccountSettings` and `useUpdateAccountSettings` are **replaced, not kept alongside** — the old body shape no longer exists.

This also clears your typecheck failure. That error was `pause_reason` being an enum in the schema while the old panel still treated it as a string; the panel no longer touches pause at all.

---

## Three things I changed from the design

**`#B08900` is banned.** The design marks a diverged step with a `#B08900` left edge and pill. That colour failed contrast in the original audit and you removed it everywhere else. It's now `--color-warn` (`#7E6300`) on `bg-warn-tint`. Same signal, passes AA.

**Two reason vocabularies became one.** The header pause popover offers Dispute · Payment plan agreed · Client request · Other. This design's "Don't chase" offers Legal dispute · Payment plan agreed · Relationship hold · Other. Same question — why is chasing off — asked twice with different words. They're now one enum:

```
Dispute · Payment plan agreed · Client request · Relationship hold · Other
```

Worth going further than I have: **pausing from the header and stopping from Settings are arguably the same state**. Both stop messages, both need a reason. The only real difference is that pause carries an end date. If they stay separate, an account can be paused *and* set to "don't chase" with two different reasons, and nothing in the UI shows that. I'd collapse them — `chase_mode: "stopped"` with an optional `until` — but that's a product call, so I've left both wired for now.

**The voice-channel rule moved to the backend.** The design hardcodes `index >= 4` in the view to decide when Voice becomes available. That's a cadence policy, not a rendering detail, and the same rule will be needed in the Chasing module. Each step now carries `allowed_channels` from the API.

---

## The nine v1 fields — what happens to each

| v1 field | Verdict |
|---|---|
| Default credit terms (days) | **Replaced** by Payment terms — Net 30 / Net 45 / Custom, same value, better control |
| Currency | **Dropped** — see below |
| Expected TDS section | **Kept**, moved into Account terms |
| Expected TDS rate (%) | **Kept**, moved into Account terms |
| Pause chasing (toggle) | **Replaced** by the header popover and `chase_mode` |
| Pause reason | **Replaced** — now a shared enum, not free text |
| Paused until | **Replaced** — lives on the header popover |
| Account owner | **Kept**, in a new Ownership section |
| Notes | **Kept**, in a new Ownership section |

### Why TDS stays here as well as on the payments row

I said last time that TDS had found its home in the payments row. That was half the picture.

The payments row shows the **detected** shortfall. These fields are what make that detection reliable. An invoice of ₹1,18,000 paid as ₹1,08,000 is either a routine 194J deduction or a ₹10,000 short payment — and those need opposite responses. One gets reconciled against Form 26AS at year end; the other gets chased. Without an expected section and rate on the account, the backend can only guess from the shape of the gap. With them it can say "matches expected 194J at 10%" and stop bothering the user.

The gross-carry copy from the v1 form is preserved verbatim beneath the fields, because it is the sentence that stops someone assuming TDS reduces what they're owed:

> Receivables are carried gross. TDS fields record what to expect at payment time; they never reduce the outstanding figure.

Rate is disabled and nulled when section is `None`, and required when it isn't.

### Why currency goes

Nothing downstream respects it. `formatINR` is hardcoded, the aging bar assumes rupees, every total assumes rupees. A control the rest of the app ignores is worse than no control — it implies support that doesn't exist and someone will eventually set it to USD and file a bug.

Keep the column on `accounts` defaulting to INR so the data model is ready. Bring the control back when multi-currency is actually built. Worth noting `Meridian Exports LLP` is one of your entities, so this will come up.

### Why owner earns its place

With more than one person in an org, "whose account is this" drives assignment, the working list, and eventually a "my accounts" filter in Chasing. It's cheap now and awkward to retrofit once Chasing exists. Unassigned is a valid state and the default.

Notes is minor but free — one textarea for the context that doesn't fit anywhere structured ("pays only after their own client pays them").

---

## New backend surface — for Sayan

Schema changes, not just endpoints:

```
accounts
  chase_mode          enum (default | custom | stopped)
  stop_reason         enum, nullable
  stop_note           text, nullable
  send_window_mode    enum (default | custom)
  send_window_opens   time
  send_window_closes  time
  send_window_days    text[]
  terms_preset        enum (net_30 | net_45 | custom)
  term_days           int
  is_msme             boolean
  tds_section         enum (194C | 194J | 194H | 194I | None)
  tds_rate            numeric(5,2), nullable
  owner_user_id       uuid, nullable, FK users
  notes               text, nullable
  archived_at         timestamptz, nullable

account_cadence_steps          per-account overrides
  account_id · step_key · tone · channel · recipients
```

Three rules that belong server-side:

- **`can_edit` is resolved by the server**, never inferred from a role string in the UI. The panel renders what it's told.
- **`allowed_channels` per step** — the voice gate is cadence policy.
- **Archiving re-checks the typed name.** The client-side match is a speed bump, not a guard.
- **`assignable_owners` comes from the server** — the users who may own an account in this org. The panel does not fetch a user list of its own.
- **Expected TDS feeds payment matching.** When a receipt falls short by roughly `tds_rate` of the invoice base, the payments row should read `TDS shortfall ₹X` rather than flagging a short payment. That comparison is backend work and it is the reason these two fields exist.

`default_steps` and `default_summary` come from the org cadence so the frontend can mark divergence without holding a copy of the default. Deciding what the default *is* stays server-side; diffing two supplied arrays is presentation.

---

## Verify

> Check `AccountSettingsPanel` and `CadenceStepEditor` against the design. Confirm: tone and channel pills are real radio inputs inside a fieldset with an `sr-only` legend, so arrow keys move between them; day toggles are real checkboxes; the disabled Voice option is wired with `aria-describedby` rather than relying on `title`; the archive dialog's confirm input has a label; and the stop-reason error uses `aria-invalid` and `aria-describedby`.
>
> Search for `#B08900` across the repo — expect zero hits.
>
> Confirm nothing in `src/components/ui/` or `src/components/landing/` changed.

Then `bun run typecheck && bun run lint && bun run build`.

---

## Still open

**"Needs approval" appears on every step** and points at the Chasing module's approval mode, which doesn't exist yet. It renders from `needs_approval` on each step, so it's data-driven rather than hardcoded, but nothing sets it meaningfully until Chasing is built.

**`View default` and `Edit in Contacts`** are text buttons with no handlers. `Edit in Contacts` should switch to `?tab=contacts` — one line, worth doing. `View default` needs the org cadence screen, which doesn't exist.

**`Save` is not dirty-gated.** The v1 form disabled Save until something changed; this panel does not. Cheap to add by snapshotting initial state and comparing — worth doing, since a Save that always looks live invites accidental writes.

**The paused banner reads `detail.paused_at`** while the rest of the panel reads `detail.settings`. If you collapse pause and stop into one state as suggested above, that split goes away.
