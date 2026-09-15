import type {
  AccountActivity,
  AccountContacts,
  AccountDetail,
  AccountInvoices,
  AccountListItem,
  AccountPayments,
  AccountsList,
  ApiError,
  CreateContactBody,
  PauseAccountBody,
  UpdateContactBody,
  UpdateEscalationBody,
  UpdateSettingsBody,
} from "@/lib/schemas/accounts";
import { dncReasonIsPresent } from "@/lib/schemas/accounts";

/**
 * Fixture data for `VITE_USE_MOCKS=true`, figures from `docs/accounts-spec.md`.
 *
 * Mutations below mutate `mockStore` and return the full updated resource so
 * optimistic-update paths can be exercised without a backend.
 */

/** Matches dashboard chase-queue IDs where the same account appears. */
export const ACCOUNT_IDS = {
  meridian: "acc00001-0000-4000-8000-000000000001",
  nimbus: "acc00002-0000-4000-8000-000000000002",
  shakti: "acc00003-0000-4000-8000-000000000003",
  anand: "acc00004-0000-4000-8000-000000000004",
  pinnacle: "acc00005-0000-4000-8000-000000000005",
  sharma: "acc00007-0000-4000-8000-000000000007",
  bhavani: "acc00008-0000-4000-8000-000000000008",
  kaveri: "acc00009-0000-4000-8000-000000000009",
  vertex: "acc00010-0000-4000-8000-000000000010",
  sundaram: "acc00011-0000-4000-8000-000000000011",
  raghav: "acc00012-0000-4000-8000-000000000012",
  coral: "acc00013-0000-4000-8000-000000000013",
} as const;

const USER_IDS = {
  priya: "a5e70001-0000-4000-8000-000000000001",
} as const;

export const CONTACT_IDS = {
  rajat: "c0c00001-0000-4000-8000-000000000001",
  rajesh: "c0c00002-0000-4000-8000-000000000002",
  rsharma: "c0c00003-0000-4000-8000-000000000003",
  kaveriP1: "c0c00004-0000-4000-8000-000000000004",
  kaveriP2: "c0c00005-0000-4000-8000-000000000005",
} as const;

const INVOICE_IDS = {
  inv2301: "d0c00010-0000-4000-8000-000000002301",
  inv2288: "d0c00011-0000-4000-8000-000000002288",
  inv2240: "d0c00012-0000-4000-8000-000000002240",
  inv2231: "d0c00013-0000-4000-8000-000000002231",
  inv2180: "d0c00014-0000-4000-8000-000000002180",
  inv2166: "d0c00015-0000-4000-8000-000000002166",
  inv2104: "d0c00016-0000-4000-8000-000000002104",
  inv2015: "d0c00017-0000-4000-8000-000000002015",
  inv2008: "d0c00018-0000-4000-8000-000000002008",
} as const;

const PAYMENT_IDS = {
  p1: "a0f00001-0000-4000-8000-000000000001",
  p2: "a0f00002-0000-4000-8000-000000000002",
} as const;

const ACTIVITY_IDS = {
  a1: "a0700001-0000-4000-8000-000000000001",
  a2: "a0700002-0000-4000-8000-000000000002",
  a3: "a0700003-0000-4000-8000-000000000003",
  a4: "a0700004-0000-4000-8000-000000000004",
  a5: "a0700005-0000-4000-8000-000000000005",
} as const;

/** Spec reference date: Monday 17 August 2026. */
const AS_OF = "2026-08-17T09:12:00+05:30";
const UPDATED_AT = "2026-08-17T09:12:00+05:30";
const SYNCED_TWO_DAYS_AGO = "2026-08-15T09:12:00+05:30";
const BOUNCED_NINE_DAYS_AGO = "2026-08-08T11:00:00+05:30";

const CHASE_DISABLED_BOUNCE = "Can't chase — Rajat Mehta's email is bouncing";

const ORG_TOTALS = {
  account_count: 47,
  outstanding: "5000000.00",
  overdue: "2800000.00",
} as const;

/** Spec §1 — the twelve visible rows, outstanding desc. */
export const accountListItemsFixture: AccountListItem[] = [
  {
    account_id: ACCOUNT_IDS.meridian,
    name: "Meridian Industries Pvt Ltd",
    outstanding: "620000.00",
    overdue: "460000.00",
    open_count: 3,
    oldest_overdue_days: 38,
    avg_days_late: 29,
    contacts: { p0: "present", p1: "present", p2: "missing" },
    chase_status: "active",
    status_label: "Active",
  },
  {
    account_id: ACCOUNT_IDS.sharma,
    name: "Sharma Traders Pvt Ltd",
    outstanding: "482000.00",
    overdue: "310000.00",
    open_count: 9,
    oldest_overdue_days: 94,
    avg_days_late: 34,
    contacts: { p0: "bounced", p1: "present", p2: "present" },
    chase_status: "bounced_p0",
    status_label: "Can't chase",
  },
  {
    account_id: ACCOUNT_IDS.nimbus,
    name: "Nimbus Creative LLP",
    outstanding: "415000.00",
    overdue: "280000.00",
    open_count: 2,
    oldest_overdue_days: 40,
    avg_days_late: 41,
    contacts: { p0: "present", p1: "present", p2: "missing" },
    chase_status: "active",
    status_label: "Active",
  },
  {
    account_id: ACCOUNT_IDS.shakti,
    name: "Shakti Engineering Pvt Ltd",
    outstanding: "390000.00",
    overdue: "240000.00",
    open_count: 3,
    oldest_overdue_days: 52,
    avg_days_late: 47,
    contacts: { p0: "present", p1: "present", p2: "present" },
    chase_status: "active",
    status_label: "Active",
  },
  {
    account_id: ACCOUNT_IDS.bhavani,
    name: "Bhavani Traders",
    outstanding: "345000.00",
    overdue: "0.00",
    open_count: 2,
    oldest_overdue_days: null,
    avg_days_late: 12,
    contacts: { p0: "present", p1: "missing", p2: "missing" },
    chase_status: "active",
    status_label: "Active",
  },
  {
    account_id: ACCOUNT_IDS.kaveri,
    name: "Kaveri & Sons",
    outstanding: "295000.00",
    overdue: "180000.00",
    open_count: 2,
    oldest_overdue_days: 67,
    avg_days_late: 52,
    contacts: { p0: "missing", p1: "present", p2: "present" },
    chase_status: "no_p0",
    status_label: "Can't chase",
  },
  {
    account_id: ACCOUNT_IDS.vertex,
    name: "Vertex Labs Pvt Ltd",
    outstanding: "260000.00",
    overdue: "140000.00",
    open_count: 2,
    oldest_overdue_days: 38,
    avg_days_late: 22,
    contacts: { p0: "present", p1: "present", p2: "missing" },
    chase_status: "active",
    status_label: "Active",
  },
  {
    account_id: ACCOUNT_IDS.sundaram,
    name: "Sundaram Industries Pvt Ltd",
    outstanding: "220000.00",
    overdue: "165000.00",
    open_count: 2,
    oldest_overdue_days: 71,
    avg_days_late: 58,
    contacts: { p0: "missing", p1: "present", p2: "missing" },
    chase_status: "no_p0",
    status_label: "Can't chase",
  },
  {
    account_id: ACCOUNT_IDS.raghav,
    name: "Raghav & Co Traders",
    outstanding: "185000.00",
    overdue: "62000.00",
    open_count: 2,
    oldest_overdue_days: 15,
    avg_days_late: 18,
    contacts: { p0: "present", p1: "missing", p2: "missing" },
    chase_status: "active",
    status_label: "Active",
  },
  {
    account_id: ACCOUNT_IDS.anand,
    name: "Anand & Sons Traders",
    outstanding: "160000.00",
    overdue: "95000.00",
    open_count: 2,
    oldest_overdue_days: 12,
    avg_days_late: 21,
    contacts: { p0: "present", p1: "present", p2: "missing" },
    chase_status: "active",
    status_label: "Active",
  },
  {
    account_id: ACCOUNT_IDS.coral,
    name: "Coral Bay Creative",
    outstanding: "140000.00",
    overdue: "0.00",
    open_count: 1,
    oldest_overdue_days: null,
    avg_days_late: 8,
    contacts: { p0: "present", p1: "missing", p2: "missing" },
    chase_status: "paused",
    status_label: "Paused",
  },
  {
    account_id: ACCOUNT_IDS.pinnacle,
    name: "Pinnacle Industries LLP",
    outstanding: "125000.00",
    overdue: "62000.00",
    open_count: 1,
    oldest_overdue_days: 9,
    avg_days_late: 14,
    contacts: { p0: "present", p1: "missing", p2: "missing" },
    chase_status: "active",
    status_label: "Active",
  },
];

export const accountsListFixture: AccountsList = {
  total_count: 47,
  filtered_count: 12,
  filtered_outstanding: "3637000.00",
  filtered_overdue: "1994000.00",
  org_totals: { ...ORG_TOTALS },
  items: accountListItemsFixture,
};

/** Spec §2 — Sharma Traders detail. */
export const sharmaDetailFixture: AccountDetail = {
  account_id: ACCOUNT_IDS.sharma,
  name: "Sharma Traders Pvt Ltd",
  outstanding: "482000.00",
  overdue: "310000.00",
  open_count: 9,
  oldest_overdue_days: 94,
  avg_days_late: 34,
  chase_status: "bounced_p0",
  status_label: "Can't chase",
  header_status: "Chasing paused — email bouncing",
  last_synced_at: SYNCED_TWO_DAYS_AGO,
  updated_at: UPDATED_AT,
  aging: [
    { bucket: "Not yet due", amount: "172000.00", share_pct: 35.7 },
    { bucket: "1–30", amount: "94000.00", share_pct: 19.5 },
    { bucket: "31–60", amount: "116000.00", share_pct: 24.1 },
    { bucket: "61–90", amount: "52000.00", share_pct: 10.8 },
    { bucket: "90+", amount: "48000.00", share_pct: 9.9 },
  ],
  settings: {
    default_credit_days: 30,
    currency: "INR",
    tds_section: "194J",
    tds_rate: 10,
    paused_at: BOUNCED_NINE_DAYS_AGO,
    pause_reason: "Email bouncing",
    paused_until: null,
    owner_user_id: USER_IDS.priya,
    owner_name: "Priya Nair",
    notes: null,
  },
};

/** Spec §3 — nine invoices grouped by aging bucket. */
export const sharmaInvoicesFixture: AccountInvoices = {
  account_id: ACCOUNT_IDS.sharma,
  groups: [
    {
      bucket: "Not yet due",
      subtotal: "172000.00",
      invoices: [
        {
          invoice_id: INVOICE_IDS.inv2301,
          number: "INV-2301",
          invoice_date: "2026-08-06",
          due_date: "2026-09-05",
          days_overdue: 0,
          amount_outstanding: "100000.00",
          status: "Not yet due",
          chase_disabled_reason: CHASE_DISABLED_BOUNCE,
        },
        {
          invoice_id: INVOICE_IDS.inv2288,
          number: "INV-2288",
          invoice_date: "2026-07-31",
          due_date: "2026-08-30",
          days_overdue: 0,
          amount_outstanding: "72000.00",
          status: "Not yet due",
          chase_disabled_reason: CHASE_DISABLED_BOUNCE,
        },
      ],
    },
    {
      bucket: "1–30",
      subtotal: "94000.00",
      invoices: [
        {
          invoice_id: INVOICE_IDS.inv2240,
          number: "INV-2240",
          invoice_date: "2026-07-03",
          due_date: "2026-08-02",
          days_overdue: 15,
          amount_outstanding: "54000.00",
          status: "Promised",
          chase_disabled_reason: CHASE_DISABLED_BOUNCE,
        },
        {
          invoice_id: INVOICE_IDS.inv2231,
          number: "INV-2231",
          invoice_date: "2026-06-26",
          due_date: "2026-07-26",
          days_overdue: 22,
          amount_outstanding: "40000.00",
          status: "Partially paid",
          chase_disabled_reason: CHASE_DISABLED_BOUNCE,
        },
      ],
    },
    {
      bucket: "31–60",
      subtotal: "116000.00",
      invoices: [
        {
          invoice_id: INVOICE_IDS.inv2180,
          number: "INV-2180",
          invoice_date: "2026-06-05",
          due_date: "2026-07-05",
          days_overdue: 43,
          amount_outstanding: "68000.00",
          status: "Open",
          chase_disabled_reason: CHASE_DISABLED_BOUNCE,
        },
        {
          invoice_id: INVOICE_IDS.inv2166,
          number: "INV-2166",
          invoice_date: "2026-05-29",
          due_date: "2026-06-28",
          days_overdue: 50,
          amount_outstanding: "48000.00",
          status: "Open",
          chase_disabled_reason: CHASE_DISABLED_BOUNCE,
        },
      ],
    },
    {
      bucket: "61–90",
      subtotal: "52000.00",
      invoices: [
        {
          invoice_id: INVOICE_IDS.inv2104,
          number: "INV-2104",
          invoice_date: "2026-05-07",
          due_date: "2026-06-06",
          days_overdue: 72,
          amount_outstanding: "52000.00",
          status: "Open",
          chase_disabled_reason: CHASE_DISABLED_BOUNCE,
        },
      ],
    },
    {
      bucket: "90+",
      subtotal: "48000.00",
      invoices: [
        {
          invoice_id: INVOICE_IDS.inv2015,
          number: "INV-2015",
          invoice_date: "2026-04-21",
          due_date: "2026-05-21",
          days_overdue: 94,
          amount_outstanding: "30000.00",
          status: "Open",
          chase_disabled_reason: CHASE_DISABLED_BOUNCE,
        },
        {
          invoice_id: INVOICE_IDS.inv2008,
          number: "INV-2008",
          invoice_date: "2026-04-24",
          due_date: "2026-05-24",
          days_overdue: 91,
          amount_outstanding: "18000.00",
          status: "Open",
          chase_disabled_reason: CHASE_DISABLED_BOUNCE,
        },
      ],
    },
  ],
};

/** Spec §4 — three contacts on Sharma's ladder. */
export const sharmaContactsFixture: AccountContacts = {
  account_id: ACCOUNT_IDS.sharma,
  updated_at: UPDATED_AT,
  p1_after_days: 21,
  p2_after_days: 45,
  contacts: [
    {
      contact_id: CONTACT_IDS.rajat,
      tier: "P0",
      name: "Rajat Mehta",
      designation: "Accounts Executive",
      email: "rajat@sharmatraders.com",
      phone: "+91 98••• •••21",
      channel_email: true,
      channel_whatsapp: false,
      channel_sms: false,
      always_cc: false,
      do_not_contact: false,
      dnc_reason: null,
      language: "en",
      delivery_state: "bounced",
      last_bounced_at: BOUNCED_NINE_DAYS_AGO,
      last_contacted_at: null,
      sort_order: 0,
      updated_at: UPDATED_AT,
    },
    {
      contact_id: CONTACT_IDS.rajesh,
      tier: "P1",
      name: "Rajesh Kumar",
      designation: "Finance Manager",
      email: "rajesh@sharmatraders.com",
      phone: "+91 99••• •••04",
      channel_email: true,
      channel_whatsapp: false,
      channel_sms: false,
      always_cc: false,
      do_not_contact: false,
      dnc_reason: null,
      language: "en",
      delivery_state: "verified",
      last_bounced_at: null,
      last_contacted_at: null,
      sort_order: 0,
      updated_at: UPDATED_AT,
    },
    {
      contact_id: CONTACT_IDS.rsharma,
      tier: "P2",
      name: "Mr. R. Sharma",
      designation: "Director",
      email: "rsharma@sharmatraders.com",
      phone: "+91 98••• •••77",
      channel_email: true,
      channel_whatsapp: false,
      channel_sms: false,
      always_cc: false,
      do_not_contact: false,
      dnc_reason: null,
      language: "en",
      delivery_state: "verified",
      last_bounced_at: null,
      last_contacted_at: null,
      sort_order: 0,
      updated_at: UPDATED_AT,
    },
  ],
};

/** Spec §5 — two payments; ₹12,000 unapplied on the Manual one. */
export const sharmaPaymentsFixture: AccountPayments = {
  account_id: ACCOUNT_IDS.sharma,
  unapplied_total: "12000.00",
  items: [
    {
      payment_id: PAYMENT_IDS.p1,
      received_on: "2026-08-04",
      amount: "40000.00",
      source: "Bank alert",
      reference: null,
      allocations: [
        {
          invoice_id: INVOICE_IDS.inv2231,
          invoice_number: "INV-2231",
          amount: "40000.00",
        },
      ],
      unapplied: "0.00",
    },
    {
      payment_id: PAYMENT_IDS.p2,
      received_on: "2026-07-22",
      amount: "60000.00",
      source: "Manual",
      reference: null,
      allocations: [
        {
          invoice_id: INVOICE_IDS.inv2166,
          invoice_number: "INV-2166",
          amount: "48000.00",
        },
      ],
      unapplied: "12000.00",
    },
  ],
};

/** Spec §6 — five activity entries, reverse chronological. */
export const sharmaActivityFixture: AccountActivity = {
  account_id: ACCOUNT_IDS.sharma,
  items: [
    {
      activity_id: ACTIVITY_IDS.a1,
      kind: "bounce",
      summary: "Rajat Mehta's email bounced.",
      occurred_at: BOUNCED_NINE_DAYS_AGO,
      invoice_id: null,
      contact_id: CONTACT_IDS.rajat,
    },
    {
      activity_id: ACTIVITY_IDS.a2,
      kind: "payment_received",
      summary: "₹40,000 payment received, allocated to INV-2231.",
      occurred_at: "2026-08-04T10:00:00+05:30",
      invoice_id: INVOICE_IDS.inv2231,
      contact_id: null,
    },
    {
      activity_id: ACTIVITY_IDS.a3,
      kind: "promise_made",
      summary: "INV-2240 marked as promised for 25 August.",
      occurred_at: "2026-07-30T10:00:00+05:30",
      invoice_id: INVOICE_IDS.inv2240,
      contact_id: null,
    },
    {
      activity_id: ACTIVITY_IDS.a4,
      kind: "contact_added",
      summary: "Rajesh Kumar added as P1 contact.",
      occurred_at: "2026-07-22T10:00:00+05:30",
      invoice_id: null,
      contact_id: CONTACT_IDS.rajesh,
    },
    {
      activity_id: ACTIVITY_IDS.a5,
      kind: "import",
      summary: "9 invoices imported from Tally export.",
      occurred_at: "2026-06-17T10:00:00+05:30",
      invoice_id: null,
      contact_id: null,
    },
  ],
};

/** Kaveri & Sons — no usable P0. */
export const kaveriDetailFixture: AccountDetail = {
  account_id: ACCOUNT_IDS.kaveri,
  name: "Kaveri & Sons",
  outstanding: "295000.00",
  overdue: "180000.00",
  open_count: 2,
  oldest_overdue_days: 67,
  avg_days_late: 52,
  chase_status: "no_p0",
  status_label: "Can't chase",
  header_status: "Can't chase — no primary contact",
  last_synced_at: SYNCED_TWO_DAYS_AGO,
  updated_at: UPDATED_AT,
  aging: [
    { bucket: "Not yet due", amount: "115000.00", share_pct: 39.0 },
    { bucket: "1–30", amount: "0.00", share_pct: 0.0 },
    { bucket: "31–60", amount: "0.00", share_pct: 0.0 },
    { bucket: "61–90", amount: "180000.00", share_pct: 61.0 },
    { bucket: "90+", amount: "0.00", share_pct: 0.0 },
  ],
  settings: {
    default_credit_days: 30,
    currency: "INR",
    tds_section: "None",
    tds_rate: 0,
    paused_at: null,
    pause_reason: null,
    paused_until: null,
    owner_user_id: USER_IDS.priya,
    owner_name: "Priya Nair",
    notes: null,
  },
};

export const kaveriContactsFixture: AccountContacts = {
  account_id: ACCOUNT_IDS.kaveri,
  updated_at: UPDATED_AT,
  p1_after_days: 21,
  p2_after_days: 45,
  contacts: [
    {
      contact_id: CONTACT_IDS.kaveriP1,
      tier: "P1",
      name: "Suresh Kaveri",
      designation: "Partner",
      email: "suresh@kaverisons.com",
      phone: "+91 98••• •••55",
      channel_email: true,
      channel_whatsapp: false,
      channel_sms: false,
      always_cc: false,
      do_not_contact: false,
      dnc_reason: null,
      language: "en",
      delivery_state: "verified",
      last_bounced_at: null,
      last_contacted_at: null,
      sort_order: 0,
      updated_at: UPDATED_AT,
    },
    {
      contact_id: CONTACT_IDS.kaveriP2,
      tier: "P2",
      name: "Meena Kaveri",
      designation: "Partner",
      email: "meena@kaverisons.com",
      phone: "+91 98••• •••56",
      channel_email: true,
      channel_whatsapp: false,
      channel_sms: false,
      always_cc: false,
      do_not_contact: false,
      dnc_reason: null,
      language: "en",
      delivery_state: "verified",
      last_bounced_at: null,
      last_contacted_at: null,
      sort_order: 0,
      updated_at: UPDATED_AT,
    },
  ],
};

/** Empty invoices state — named for Bhavani per the empty-copy example. */
export const bhavaniEmptyInvoicesFixture: AccountInvoices = {
  account_id: ACCOUNT_IDS.bhavani,
  groups: [],
};

export const filteredEmptyAccountsFixture: AccountsList = {
  total_count: 47,
  filtered_count: 0,
  filtered_outstanding: "0.00",
  filtered_overdue: "0.00",
  org_totals: { ...ORG_TOTALS },
  items: [],
};

export const accountsUnavailableFixture: ApiError = {
  error: {
    code: "accounts_unavailable",
    message: "Couldn't load your accounts.",
  },
};

/**
 * Spec §1 overflow: exactly 60 characters — a test asserts the length, so
 * don't tidy the wording without recounting.
 */
export const LONG_ACCOUNT_NAME = "Brahmaputra Infrastructure & Allied Engineering Services Ltd";

export const longAccountNameListFixture: AccountsList = {
  ...accountsListFixture,
  items: accountListItemsFixture.map((item, index) =>
    index === 0 ? { ...item, name: LONG_ACCOUNT_NAME } : item,
  ),
};

// ---------------------------------------------------------------------------
// Mutable mock store — seeded from fixtures; mutations write here.
// ---------------------------------------------------------------------------

type MockStore = {
  list: AccountsList;
  details: Record<string, AccountDetail>;
  invoices: Record<string, AccountInvoices>;
  contacts: Record<string, AccountContacts>;
  payments: Record<string, AccountPayments>;
  activity: Record<string, AccountActivity>;
};

function seedStore(): MockStore {
  return {
    list: structuredClone(accountsListFixture),
    details: {
      [ACCOUNT_IDS.sharma]: structuredClone(sharmaDetailFixture),
      [ACCOUNT_IDS.kaveri]: structuredClone(kaveriDetailFixture),
    },
    invoices: {
      [ACCOUNT_IDS.sharma]: structuredClone(sharmaInvoicesFixture),
      [ACCOUNT_IDS.bhavani]: structuredClone(bhavaniEmptyInvoicesFixture),
    },
    contacts: {
      [ACCOUNT_IDS.sharma]: structuredClone(sharmaContactsFixture),
      [ACCOUNT_IDS.kaveri]: structuredClone(kaveriContactsFixture),
    },
    payments: {
      [ACCOUNT_IDS.sharma]: structuredClone(sharmaPaymentsFixture),
    },
    activity: {
      [ACCOUNT_IDS.sharma]: structuredClone(sharmaActivityFixture),
    },
  };
}

let mockStore = seedStore();

export function resetAccountsMocks(): void {
  mockStore = seedStore();
}

export function getMockAccountsList(): AccountsList {
  return structuredClone(mockStore.list);
}

export function getMockAccountDetail(accountId: string): AccountDetail | undefined {
  const detail = mockStore.details[accountId];
  if (detail) return structuredClone(detail);

  const listItem = mockStore.list.items.find((item) => item.account_id === accountId);
  if (!listItem) return undefined;
  return synthesizeDetailFromListItem(listItem);
}

export function getMockAccountInvoices(accountId: string): AccountInvoices | undefined {
  const invoices = mockStore.invoices[accountId];
  if (invoices) return structuredClone(invoices);

  // Account exists but has no invoice fixture yet — empty groups, not a 404.
  if (accountExists(accountId)) {
    return { account_id: accountId, groups: [] };
  }
  return undefined;
}

function accountExists(accountId: string): boolean {
  return (
    accountId in mockStore.details ||
    mockStore.list.items.some((item) => item.account_id === accountId)
  );
}

/**
 * List-only accounts still need a detail payload so row links work. Full tab
 * fixtures (nine invoices, contacts, …) stay on Sharma / Kaveri / Bhavani.
 */
function synthesizeDetailFromListItem(item: AccountListItem): AccountDetail {
  const currentCents = moneyToCents(item.outstanding) - moneyToCents(item.overdue);
  const current = centsToMoney(currentCents < 0n ? 0n : currentCents);
  const overdue = item.overdue;
  const total = Number(item.outstanding);
  const share = (amount: string) =>
    total > 0 ? Math.round((Number(amount) / total) * 1000) / 10 : 0;

  return {
    account_id: item.account_id,
    name: item.name,
    outstanding: item.outstanding,
    overdue: item.overdue,
    open_count: item.open_count,
    oldest_overdue_days: item.oldest_overdue_days,
    avg_days_late: item.avg_days_late,
    chase_status: item.chase_status,
    status_label: item.status_label,
    header_status: headerStatusFor(item),
    last_synced_at: SYNCED_TWO_DAYS_AGO,
    updated_at: UPDATED_AT,
    aging: [
      { bucket: "Not yet due", amount: current, share_pct: share(current) },
      { bucket: "1–30", amount: "0.00", share_pct: 0 },
      { bucket: "31–60", amount: overdue, share_pct: share(overdue) },
      { bucket: "61–90", amount: "0.00", share_pct: 0 },
      { bucket: "90+", amount: "0.00", share_pct: 0 },
    ],
    settings: {
      default_credit_days: 30,
      currency: "INR",
      tds_section: "None",
      tds_rate: 0,
      paused_at: item.chase_status === "paused" ? SYNCED_TWO_DAYS_AGO : null,
      pause_reason: item.chase_status === "paused" ? "Paused" : null,
      paused_until: null,
      owner_user_id: USER_IDS.priya,
      owner_name: "Priya Nair",
      notes: null,
    },
  };
}

function headerStatusFor(item: AccountListItem): string {
  switch (item.chase_status) {
    case "bounced_p0":
      return "Chasing paused — email bouncing";
    case "no_p0":
      return "Can't chase — no primary contact";
    case "paused":
      return "Chasing paused";
    case "active":
      return "Active";
  }
}

function moneyToCents(value: string): bigint {
  const [rupees, paise = "0"] = value.split(".");
  return BigInt(rupees ?? "0") * 100n + BigInt(paise.padEnd(2, "0").slice(0, 2));
}

function centsToMoney(cents: bigint): string {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  const rupees = abs / 100n;
  const paise = abs % 100n;
  return `${sign}${rupees}.${paise.toString().padStart(2, "0")}`;
}

export function getMockAccountContacts(accountId: string): AccountContacts | undefined {
  const contacts = mockStore.contacts[accountId];
  if (contacts) return structuredClone(contacts);
  if (accountExists(accountId)) {
    return {
      account_id: accountId,
      updated_at: UPDATED_AT,
      p1_after_days: 21,
      p2_after_days: 45,
      contacts: [],
    };
  }
  return undefined;
}

export function getMockAccountPayments(accountId: string): AccountPayments | undefined {
  const payments = mockStore.payments[accountId];
  if (payments) return structuredClone(payments);
  if (accountExists(accountId)) {
    return { account_id: accountId, unapplied_total: "0.00", items: [] };
  }
  return undefined;
}

export function getMockAccountActivity(
  accountId: string,
  limit?: number,
): AccountActivity | undefined {
  const activity = mockStore.activity[accountId];
  if (activity) {
    const items = limit === undefined ? activity.items : activity.items.slice(0, limit);
    return structuredClone({ account_id: activity.account_id, items });
  }
  if (accountExists(accountId)) {
    return { account_id: accountId, items: [] };
  }
  return undefined;
}

function bumpUpdatedAt(): string {
  // Milliseconds are kept deliberately. This value is the If-Match token, and
  // truncating to whole seconds leaves a stale token valid for up to a second,
  // which makes the stale_write path untestable in mock mode.
  return new Date().toISOString().replace(/Z$/, "+00:00");
}

/** Usable P0 = tier P0 and not DNC. Bounced still counts — replace before remove. */
function usableP0Count(contacts: AccountContacts): number {
  return contacts.contacts.filter((c) => c.tier === "P0" && !c.do_not_contact).length;
}

function appendActivity(
  accountId: string,
  kind: AccountActivity["items"][number]["kind"],
  summary: string,
  contactId: string | null = null,
): void {
  const log = mockStore.activity[accountId] ?? {
    account_id: accountId,
    items: [],
  };
  log.items.unshift({
    activity_id: crypto.randomUUID(),
    kind,
    summary,
    occurred_at: bumpUpdatedAt(),
    invoice_id: null,
    contact_id: contactId,
  });
  mockStore.activity[accountId] = log;
}

export class MockAccountsConflictError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MockAccountsConflictError";
    this.code = code;
  }
}

export function mockCreateContact(
  accountId: string,
  body: CreateContactBody,
  ifMatch: string,
): AccountContacts {
  const contacts = mockStore.contacts[accountId];
  if (!contacts) {
    throw new MockAccountsConflictError("not_found", "Account contacts not found.");
  }
  if (contacts.updated_at !== ifMatch) {
    throw new MockAccountsConflictError(
      "stale_write",
      "Someone else changed this account. Reload and try again.",
    );
  }
  const now = bumpUpdatedAt();
  contacts.contacts.push({
    contact_id: crypto.randomUUID(),
    tier: body.tier,
    name: body.name,
    designation: body.designation ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    channel_email: body.channel_email ?? true,
    channel_whatsapp: body.channel_whatsapp ?? false,
    channel_sms: body.channel_sms ?? false,
    always_cc: body.always_cc ?? false,
    do_not_contact: body.do_not_contact ?? false,
    dnc_reason: body.dnc_reason ?? null,
    language: body.language ?? "en",
    delivery_state: "unverified",
    last_bounced_at: null,
    last_contacted_at: null,
    sort_order: contacts.contacts.filter((c) => c.tier === body.tier).length,
    updated_at: now,
  });
  contacts.updated_at = now;
  appendActivity(accountId, "contact_added", `${body.name} added as ${body.tier} contact.`);
  return structuredClone(contacts);
}

export function mockUpdateContact(
  accountId: string,
  contactId: string,
  body: UpdateContactBody,
  ifMatch: string,
): AccountContacts {
  const contacts = mockStore.contacts[accountId];
  if (!contacts) {
    throw new MockAccountsConflictError("not_found", "Account contacts not found.");
  }
  if (contacts.updated_at !== ifMatch) {
    throw new MockAccountsConflictError(
      "stale_write",
      "Someone else changed this account. Reload and try again.",
    );
  }
  const contact = contacts.contacts.find((c) => c.contact_id === contactId);
  if (!contact) {
    throw new MockAccountsConflictError("not_found", "Contact not found.");
  }

  // A usable P0 can be lost two ways, and the rule has to cover both: marking it
  // do-not-contact, or moving it off the P0 tier. Guarding only the first left
  // "Move to P1" as a way to make the last P0 vanish and the account unchaseable.
  const nextDnc = body.do_not_contact ?? contact.do_not_contact;
  const nextTier = body.tier ?? contact.tier;
  const wasUsableP0 = contact.tier === "P0" && !contact.do_not_contact;
  const staysUsableP0 = nextTier === "P0" && !nextDnc;
  if (wasUsableP0 && !staysUsableP0 && usableP0Count(contacts) <= 1) {
    throw new MockAccountsConflictError(
      "last_p0_required",
      "An account needs a P0 contact to be chased. Add a replacement first.",
    );
  }

  const merged = { ...contact, ...body };
  if (!dncReasonIsPresent(merged)) {
    throw new MockAccountsConflictError(
      "dnc_reason_required",
      "Add a reason before marking a contact do-not-contact.",
    );
  }

  Object.assign(contact, body, { updated_at: bumpUpdatedAt() });
  contacts.updated_at = contact.updated_at;
  appendActivity(accountId, "contact_edited", `${contact.name} updated.`, contactId);
  return structuredClone(contacts);
}

export function mockDeleteContact(
  accountId: string,
  contactId: string,
  ifMatch: string,
): AccountContacts {
  const contacts = mockStore.contacts[accountId];
  if (!contacts) {
    throw new MockAccountsConflictError("not_found", "Account contacts not found.");
  }
  if (contacts.updated_at !== ifMatch) {
    throw new MockAccountsConflictError(
      "stale_write",
      "Someone else changed this account. Reload and try again.",
    );
  }
  const contact = contacts.contacts.find((c) => c.contact_id === contactId);
  if (!contact) {
    throw new MockAccountsConflictError("not_found", "Contact not found.");
  }
  if (contact.tier === "P0" && !contact.do_not_contact && usableP0Count(contacts) <= 1) {
    throw new MockAccountsConflictError(
      "last_p0_required",
      "An account needs a P0 contact to be chased. Add a replacement first.",
    );
  }
  const name = contact.name;
  contacts.contacts = contacts.contacts.filter((c) => c.contact_id !== contactId);
  contacts.updated_at = bumpUpdatedAt();
  appendActivity(accountId, "contact_removed", `${name} removed.`, contactId);
  return structuredClone(contacts);
}

export function mockUpdateEscalation(
  accountId: string,
  body: UpdateEscalationBody,
  ifMatch: string,
): AccountContacts {
  const contacts = mockStore.contacts[accountId];
  if (!contacts) {
    throw new MockAccountsConflictError("not_found", "Account contacts not found.");
  }
  if (contacts.updated_at !== ifMatch) {
    throw new MockAccountsConflictError(
      "stale_write",
      "Someone else changed this account. Reload and try again.",
    );
  }
  if (body.p2_after_days <= body.p1_after_days) {
    throw new MockAccountsConflictError("escalation_order", "P2 must come after P1.");
  }
  contacts.p1_after_days = body.p1_after_days;
  contacts.p2_after_days = body.p2_after_days;
  contacts.updated_at = bumpUpdatedAt();
  appendActivity(
    accountId,
    "escalation_changed",
    `Escalation timing changed to P1 after ${body.p1_after_days} days, P2 after ${body.p2_after_days} days.`,
  );
  return structuredClone(contacts);
}

export function mockUpdateSettings(
  accountId: string,
  body: UpdateSettingsBody,
  ifMatch: string,
): AccountDetail {
  const detail = mockStore.details[accountId];
  if (!detail) {
    throw new MockAccountsConflictError("not_found", "Account not found.");
  }
  if (detail.updated_at !== ifMatch) {
    throw new MockAccountsConflictError(
      "stale_write",
      "Someone else changed this account. Reload and try again.",
    );
  }
  if (body.default_credit_days !== undefined) {
    detail.settings.default_credit_days = body.default_credit_days;
  }
  if (body.currency !== undefined) {
    detail.settings.currency = body.currency;
  }
  if (body.tds_section !== undefined) {
    detail.settings.tds_section = body.tds_section;
  }
  if (body.tds_rate !== undefined) {
    detail.settings.tds_rate = body.tds_rate;
  }
  if (body.notes !== undefined) {
    detail.settings.notes = body.notes;
  }
  if (body.owner_user_id !== undefined) {
    detail.settings.owner_user_id = body.owner_user_id;
    // Keeping the previous name when the id changes returns a row whose owner
    // id and owner name describe two different people. Only Priya has a name in
    // the fixtures; anything else — including Unassigned's null — has none.
    detail.settings.owner_name = body.owner_user_id === USER_IDS.priya ? "Priya Nair" : null;
  }
  detail.updated_at = bumpUpdatedAt();
  appendActivity(accountId, "settings_changed", "Account settings updated.");
  return structuredClone(detail);
}

export function mockPauseAccount(
  accountId: string,
  body: PauseAccountBody,
  ifMatch: string,
): AccountDetail {
  const detail = mockStore.details[accountId];
  if (!detail) {
    throw new MockAccountsConflictError("not_found", "Account not found.");
  }
  if (detail.updated_at !== ifMatch) {
    throw new MockAccountsConflictError(
      "stale_write",
      "Someone else changed this account. Reload and try again.",
    );
  }
  if (!body.reason.trim()) {
    throw new MockAccountsConflictError("pause_reason_required", "Add a reason before pausing.");
  }
  // Contract §2.4. Compared as a plain date string rather than through Date:
  // paused_until is a calendar date in the org timezone, and parsing it to an
  // instant would make the boundary depend on where the code runs.
  if (body.until !== undefined && body.until < new Date().toISOString().slice(0, 10)) {
    throw new MockAccountsConflictError(
      "pause_until_past",
      "Pick a date in the future, or leave it blank to pause indefinitely.",
    );
  }
  const now = bumpUpdatedAt();
  detail.settings.paused_at = now;
  detail.settings.pause_reason = body.reason;
  detail.settings.paused_until = body.until ?? null;
  detail.chase_status = "paused";
  detail.status_label = "Paused";
  detail.header_status = `Chasing paused — ${body.reason}`;
  detail.updated_at = now;
  appendActivity(accountId, "pause", `Chasing paused — ${body.reason}.`);
  return structuredClone(detail);
}

export function mockResumeAccount(accountId: string, ifMatch: string): AccountDetail {
  const detail = mockStore.details[accountId];
  if (!detail) {
    throw new MockAccountsConflictError("not_found", "Account not found.");
  }
  if (detail.updated_at !== ifMatch) {
    throw new MockAccountsConflictError(
      "stale_write",
      "Someone else changed this account. Reload and try again.",
    );
  }
  detail.settings.paused_at = null;
  detail.settings.pause_reason = null;
  detail.settings.paused_until = null;
  // Sharma's P0 is still bouncing after resume of an intentional pause.
  if (accountId === ACCOUNT_IDS.sharma) {
    detail.chase_status = "bounced_p0";
    detail.status_label = "Can't chase";
    detail.header_status = "Chasing paused — email bouncing";
  } else if (accountId === ACCOUNT_IDS.kaveri) {
    detail.chase_status = "no_p0";
    detail.status_label = "Can't chase";
    detail.header_status = "Can't chase — no primary contact";
  } else {
    detail.chase_status = "active";
    detail.status_label = "Active";
    detail.header_status = "Active";
  }
  detail.updated_at = bumpUpdatedAt();
  appendActivity(accountId, "resume", "Chasing resumed.");
  return structuredClone(detail);
}

/** Kept for callers that only need the static seed timestamp. */
export const ACCOUNTS_AS_OF = AS_OF;
