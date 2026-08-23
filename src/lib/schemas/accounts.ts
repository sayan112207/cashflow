import { z } from "zod";

import { agingBucketSchema, apiErrorSchema } from "@/lib/schemas/dashboard";

/**
 * Accounts response bodies from `docs/accounts-contract.md`.
 *
 * Keys are snake_case — the wire format. Every type is `z.infer` only; do not
 * add a parallel interface that can drift from the parser.
 */

const moneyString = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, 'Money must be a plain decimal string, e.g. "482000.00"');

const percentage = z.number().min(0).max(100);

const isoDatetime = z.string().datetime({ offset: true });

/** Plain calendar date — org timezone, no time component. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const contactPipSchema = z.enum(["present", "missing", "bounced", "dnc"]);

export const chaseStatusSchema = z.enum(["no_p0", "bounced_p0", "paused", "active"]);

export const chaseStatusLabelSchema = z.enum(["Can't chase", "Paused", "Active"]);

export const contactTierSchema = z.enum(["P0", "P1", "P2"]);

export const deliveryStateSchema = z.enum(["verified", "unverified", "bounced"]);

export const invoiceStatusSchema = z.enum([
  "Not yet due",
  "Open",
  "Partially paid",
  "Promised",
  "Disputed",
  "Paid",
  "Written off",
]);

export const paymentSourceSchema = z.enum(["Bank alert", "Manual", "Statement"]);

export const activityKindSchema = z.enum([
  "invoice_created",
  "invoice_edited",
  "import",
  "payment_received",
  "promise_made",
  "promise_broken",
  "dispute_raised",
  "contact_added",
  "contact_edited",
  "contact_removed",
  "bounce",
  "pause",
  "resume",
  "message_sent",
]);

export const tdsSectionSchema = z.enum(["194C", "194J", "194H", "194I", "None"]);

export const contactLanguageSchema = z.enum(["en", "hi", "ta", "te", "mr", "gu", "bn", "kn"]);

export const accountsListFilterSchema = z.enum(["has_overdue", "missing_contacts", "paused"]);

export const accountsSortColumnSchema = z.enum([
  "name",
  "outstanding",
  "overdue",
  "open_count",
  "oldest_overdue_days",
  "avg_days_late",
  "contacts",
  "chase_status",
]);

export const accountsSortDirSchema = z.enum(["asc", "desc"]);

/**
 * URL search for `/app/accounts`.
 *
 * `.default` fills missing keys; `.catch` recovers from malformed values so a
 * bad link falls back instead of crashing the route.
 */
export const accountsSearchSchema = z.object({
  filter: z
    .union([accountsListFilterSchema, z.array(accountsListFilterSchema)])
    .optional()
    .catch(undefined),
  sort: accountsSortColumnSchema.default("outstanding").catch("outstanding"),
  dir: accountsSortDirSchema.default("desc").catch("desc"),
});

export const accountDetailTabSchema = z.enum([
  "invoices",
  "contacts",
  "payments",
  "activity",
  "settings",
]);

/** URL search for `/app/accounts/$accountId`. */
export const accountDetailSearchSchema = z.object({
  tab: accountDetailTabSchema.default("invoices").catch("invoices"),
});

function agingSlot<B extends z.infer<typeof agingBucketSchema>>(bucket: B) {
  return z.object({
    bucket: z.literal(bucket),
    amount: moneyString,
    share_pct: percentage,
  });
}

const accountAgingSchema = z.tuple([
  agingSlot("Not yet due"),
  agingSlot("1–30"),
  agingSlot("31–60"),
  agingSlot("61–90"),
  agingSlot("90+"),
]);

export const accountContactsPipsSchema = z.object({
  p0: contactPipSchema,
  p1: contactPipSchema,
  p2: contactPipSchema,
});

export const accountListItemSchema = z.object({
  account_id: z.string().uuid(),
  name: z.string().min(1),
  outstanding: moneyString,
  overdue: moneyString,
  open_count: z.number().int().nonnegative(),
  /** `null` when nothing is overdue — UI renders em dash. */
  oldest_overdue_days: z.number().int().nonnegative().nullable(),
  /** `null` under three paid samples — UI renders em dash, never zero. */
  avg_days_late: z.number().int().nullable(),
  contacts: accountContactsPipsSchema,
  chase_status: chaseStatusSchema,
  status_label: chaseStatusLabelSchema,
});

/** `GET /api/v1/accounts` */
export const accountsListSchema = z.object({
  total_count: z.number().int().nonnegative(),
  filtered_count: z.number().int().nonnegative(),
  filtered_outstanding: moneyString,
  filtered_overdue: moneyString,
  org_totals: z.object({
    account_count: z.number().int().nonnegative(),
    outstanding: moneyString,
    overdue: moneyString,
  }),
  items: z.array(accountListItemSchema),
});

export const accountSettingsSchema = z.object({
  default_credit_days: z.number().int().positive(),
  currency: z.literal("INR"),
  tds_section: tdsSectionSchema,
  tds_rate: z.number().min(0).max(100),
  paused_at: isoDatetime.nullable(),
  pause_reason: z.string().nullable(),
  paused_until: isoDate.nullable(),
  owner_user_id: z.string().uuid().nullable(),
  owner_name: z.string().nullable(),
  notes: z.string().nullable(),
});

/**
 * `GET /api/v1/accounts/{id}` — header, aging, chase status, settings.
 *
 * `header_status` is backend-composed copy (e.g. "Chasing paused — email bouncing")
 * and is rendered verbatim beside the sync line.
 */
export const accountDetailSchema = z.object({
  account_id: z.string().uuid(),
  name: z.string().min(1),
  outstanding: moneyString,
  overdue: moneyString,
  open_count: z.number().int().nonnegative(),
  oldest_overdue_days: z.number().int().nonnegative().nullable(),
  avg_days_late: z.number().int().nullable(),
  chase_status: chaseStatusSchema,
  status_label: chaseStatusLabelSchema,
  header_status: z.string().min(1),
  last_synced_at: isoDatetime,
  updated_at: isoDatetime,
  aging: accountAgingSchema,
  settings: accountSettingsSchema,
});

export const accountInvoiceSchema = z.object({
  invoice_id: z.string().uuid(),
  number: z.string().min(1),
  invoice_date: isoDate,
  due_date: isoDate,
  days_overdue: z.number().int(),
  amount_outstanding: moneyString,
  status: invoiceStatusSchema,
  /** When set, Chase is disabled and this string is the tooltip. */
  chase_disabled_reason: z.string().min(1).nullable(),
});

export const accountInvoiceGroupSchema = z.object({
  bucket: agingBucketSchema,
  subtotal: moneyString,
  invoices: z.array(accountInvoiceSchema),
});

/** `GET /api/v1/accounts/{id}/invoices` */
export const accountInvoicesSchema = z.object({
  account_id: z.string().uuid(),
  groups: z.array(accountInvoiceGroupSchema),
});

export const accountContactSchema = z.object({
  contact_id: z.string().uuid(),
  tier: contactTierSchema,
  name: z.string().min(1),
  designation: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  channel_email: z.boolean(),
  channel_whatsapp: z.boolean(),
  channel_sms: z.boolean(),
  always_cc: z.boolean(),
  do_not_contact: z.boolean(),
  dnc_reason: z.string().nullable(),
  language: contactLanguageSchema,
  delivery_state: deliveryStateSchema,
  last_bounced_at: isoDatetime.nullable(),
  last_contacted_at: isoDatetime.nullable(),
  sort_order: z.number().int().nonnegative(),
  updated_at: isoDatetime,
});

/** `GET /api/v1/accounts/{id}/contacts` — ladder + escalation timing. */
export const accountContactsSchema = z.object({
  account_id: z.string().uuid(),
  updated_at: isoDatetime,
  p1_after_days: z.number().int().positive(),
  p2_after_days: z.number().int().positive(),
  contacts: z.array(accountContactSchema),
});

export const paymentAllocationSchema = z.object({
  invoice_id: z.string().uuid(),
  invoice_number: z.string().min(1),
  amount: moneyString,
});

export const accountPaymentSchema = z.object({
  payment_id: z.string().uuid(),
  received_on: isoDate,
  amount: moneyString,
  source: paymentSourceSchema,
  reference: z.string().nullable(),
  allocations: z.array(paymentAllocationSchema),
  unapplied: moneyString,
});

/** `GET /api/v1/accounts/{id}/payments` */
export const accountPaymentsSchema = z.object({
  account_id: z.string().uuid(),
  unapplied_total: moneyString,
  items: z.array(accountPaymentSchema),
});

export const accountActivityItemSchema = z.object({
  activity_id: z.string().uuid(),
  kind: activityKindSchema,
  /** Backend-composed sentence. Frontend renders verbatim. */
  summary: z.string().min(1),
  occurred_at: isoDatetime,
  invoice_id: z.string().uuid().nullable(),
  contact_id: z.string().uuid().nullable(),
});

/** `GET /api/v1/accounts/{id}/activity` */
export const accountActivitySchema = z.object({
  account_id: z.string().uuid(),
  items: z.array(accountActivityItemSchema),
});

/** Mutation request bodies */

export const createContactBodySchema = z.object({
  tier: contactTierSchema,
  name: z.string().min(1),
  designation: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  channel_email: z.boolean().optional(),
  channel_whatsapp: z.boolean().optional(),
  channel_sms: z.boolean().optional(),
  always_cc: z.boolean().optional(),
  do_not_contact: z.boolean().optional(),
  dnc_reason: z.string().nullable().optional(),
  language: contactLanguageSchema.optional(),
});

export const updateContactBodySchema = createContactBodySchema.partial();

export const updateEscalationBodySchema = z.object({
  p1_after_days: z.number().int().positive(),
  p2_after_days: z.number().int().positive(),
});

export const updateSettingsBodySchema = z.object({
  default_credit_days: z.number().int().positive().optional(),
  currency: z.literal("INR").optional(),
  tds_section: tdsSectionSchema.optional(),
  tds_rate: z.number().min(0).max(100).optional(),
  owner_user_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * Settings tab form values. Pause fields are edited here but go through the
 * pause/resume endpoints — they are not part of `updateSettingsBodySchema`.
 */
export const accountSettingsFormSchema = z
  .object({
    default_credit_days: z.number().int().positive(),
    currency: z.literal("INR"),
    tds_section: tdsSectionSchema,
    tds_rate: z.number().min(0).max(100),
    paused: z.boolean(),
    pause_reason: z.string(),
    paused_until: z.string(),
    owner_user_id: z.string().uuid().nullable(),
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.paused && value.pause_reason.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add a reason before pausing.",
        path: ["pause_reason"],
      });
    }
    if (value.paused_until.length > 0 && !isoDate.safeParse(value.paused_until).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use a valid date.",
        path: ["paused_until"],
      });
    }
  });

export const pauseAccountBodySchema = z.object({
  reason: z.string().min(1),
  until: isoDate.optional(),
});

export type ContactPip = z.infer<typeof contactPipSchema>;
export type ChaseStatus = z.infer<typeof chaseStatusSchema>;
export type ChaseStatusLabel = z.infer<typeof chaseStatusLabelSchema>;
export type ContactTier = z.infer<typeof contactTierSchema>;
export type DeliveryState = z.infer<typeof deliveryStateSchema>;
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
export type PaymentSource = z.infer<typeof paymentSourceSchema>;
export type ActivityKind = z.infer<typeof activityKindSchema>;
export type TdsSection = z.infer<typeof tdsSectionSchema>;
export type ContactLanguage = z.infer<typeof contactLanguageSchema>;
export type AccountsListFilter = z.infer<typeof accountsListFilterSchema>;
export type AccountsSortColumn = z.infer<typeof accountsSortColumnSchema>;
export type AccountsSortDir = z.infer<typeof accountsSortDirSchema>;
export type AccountsSearch = z.infer<typeof accountsSearchSchema>;
export type AccountDetailTab = z.infer<typeof accountDetailTabSchema>;
export type AccountDetailSearch = z.infer<typeof accountDetailSearchSchema>;
export type AccountListItem = z.infer<typeof accountListItemSchema>;
export type AccountsList = z.infer<typeof accountsListSchema>;
export type AccountSettings = z.infer<typeof accountSettingsSchema>;
export type AccountDetail = z.infer<typeof accountDetailSchema>;
export type AccountInvoice = z.infer<typeof accountInvoiceSchema>;
export type AccountInvoiceGroup = z.infer<typeof accountInvoiceGroupSchema>;
export type AccountInvoices = z.infer<typeof accountInvoicesSchema>;
export type AccountContact = z.infer<typeof accountContactSchema>;
export type AccountContacts = z.infer<typeof accountContactsSchema>;
export type AccountPayment = z.infer<typeof accountPaymentSchema>;
export type AccountPayments = z.infer<typeof accountPaymentsSchema>;
export type AccountActivityItem = z.infer<typeof accountActivityItemSchema>;
export type AccountActivity = z.infer<typeof accountActivitySchema>;
export type CreateContactBody = z.infer<typeof createContactBodySchema>;
export type UpdateContactBody = z.infer<typeof updateContactBodySchema>;
export type UpdateEscalationBody = z.infer<typeof updateEscalationBodySchema>;
export type UpdateSettingsBody = z.infer<typeof updateSettingsBodySchema>;
export type AccountSettingsFormValues = z.infer<typeof accountSettingsFormSchema>;
export type PauseAccountBody = z.infer<typeof pauseAccountBodySchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
