import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AppButton } from "@/components/app/AppButton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  usePauseAccount,
  useResumeAccount,
  useUpdateAccountSettings,
} from "@/lib/queries/account-detail";
import {
  accountSettingsFormSchema,
  type AccountDetail,
  type AccountSettingsFormValues,
  type TdsSection,
} from "@/lib/schemas/accounts";
import { AccountsApiError } from "@/lib/services/accounts";
import { cn } from "@/lib/utils";

/** Org users for the owner select — expand when a users list endpoint exists. */
const OWNER_OPTIONS = [
  { id: "a5e70001-0000-4000-8000-000000000001", name: "Priya Nair" },
] as const;

const TDS_SECTIONS: TdsSection[] = ["194C", "194J", "194H", "194I", "None"];

const fieldClass =
  "w-full rounded-input border border-stroke bg-card px-3 py-2 text-body font-semibold text-fg";

type AccountSettingsPanelProps = {
  accountId: string;
  detail: AccountDetail;
};

/**
 * Spec §7 — real form via react-hook-form + zod. TDS fields are informational;
 * they never net down outstanding on this screen.
 */
export function AccountSettingsPanel({ accountId, detail }: AccountSettingsPanelProps) {
  const updateSettings = useUpdateAccountSettings(accountId);
  const pauseMutation = usePauseAccount(accountId);
  const resumeMutation = useResumeAccount(accountId);

  const form = useForm<AccountSettingsFormValues>({
    resolver: zodResolver(accountSettingsFormSchema),
    defaultValues: settingsToFormValues(detail),
  });

  useEffect(() => {
    form.reset(settingsToFormValues(detail));
  }, [detail.updated_at, detail, form]);

  const paused = form.watch("paused");
  const saving =
    updateSettings.isPending || pauseMutation.isPending || resumeMutation.isPending;

  async function onSubmit(values: AccountSettingsFormValues) {
    const wasPaused = detail.settings.paused_at !== null;
    const settingsChanged =
      values.default_credit_days !== detail.settings.default_credit_days ||
      values.currency !== detail.settings.currency ||
      values.tds_section !== detail.settings.tds_section ||
      values.tds_rate !== detail.settings.tds_rate ||
      values.owner_user_id !== detail.settings.owner_user_id ||
      (values.notes || null) !== detail.settings.notes;

    try {
      let ifMatch = detail.updated_at;

      if (settingsChanged) {
        const next = await updateSettings.mutateAsync({
          body: {
            default_credit_days: values.default_credit_days,
            currency: values.currency,
            tds_section: values.tds_section,
            tds_rate: values.tds_rate,
            owner_user_id: values.owner_user_id,
            notes: values.notes.trim().length === 0 ? null : values.notes,
          },
          ifMatch,
        });
        ifMatch = next.updated_at;
      }

      if (!wasPaused && values.paused) {
        await pauseMutation.mutateAsync({
          body: {
            reason: values.pause_reason.trim(),
            ...(values.paused_until.trim().length > 0
              ? { until: values.paused_until }
              : {}),
          },
          ifMatch,
        });
      } else if (wasPaused && !values.paused) {
        await resumeMutation.mutateAsync({ ifMatch });
      } else if (
        wasPaused &&
        values.paused &&
        (values.pause_reason !== (detail.settings.pause_reason ?? "") ||
          values.paused_until !== (detail.settings.paused_until ?? ""))
      ) {
        await pauseMutation.mutateAsync({
          body: {
            reason: values.pause_reason.trim(),
            ...(values.paused_until.trim().length > 0
              ? { until: values.paused_until }
              : {}),
          },
          ifMatch,
        });
      }

      toast.success("Settings saved.");
    } catch (error) {
      const message =
        error instanceof AccountsApiError ? error.message : "Couldn't save settings.";
      form.setError("root", { message });
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          void onSubmit(values);
        })}
        className="max-w-lg space-y-5"
        noValidate
      >
        <p className="text-prose font-normal text-fg-muted">
          Receivables are carried gross. TDS fields record what to expect at payment
          time; they never reduce the outstanding figure.
        </p>

        <FormField
          control={form.control}
          name="default_credit_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-prose font-semibold text-fg-muted">
                Default credit terms (days)
              </FormLabel>
              <FormControl>
                <input
                  type="number"
                  min={1}
                  className={cn(fieldClass, "tnum")}
                  {...field}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-prose font-semibold text-fg-muted">Currency</FormLabel>
              <FormControl>
                <select className={fieldClass} {...field}>
                  <option value="INR">INR</option>
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tds_section"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-prose font-semibold text-fg-muted">
                Expected TDS section
              </FormLabel>
              <FormControl>
                <select className={fieldClass} {...field}>
                  {TDS_SECTIONS.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tds_rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-prose font-semibold text-fg-muted">
                Expected TDS rate (%)
              </FormLabel>
              <FormControl>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  className={cn(fieldClass, "tnum")}
                  {...field}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="paused"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-prose font-semibold text-fg-muted">
                Pause chasing
              </FormLabel>
              <FormControl>
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  aria-label="Pause chasing"
                  onClick={() => field.onChange(!field.value)}
                  className={cn(
                    "rounded-pill px-3 py-1.5 text-prose font-semibold transition-colors duration-150",
                    field.value ? "bg-accent-tint text-accent" : "bg-alt text-fg-soft",
                  )}
                >
                  {field.value ? "On" : "Off"}
                </button>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {paused ? (
          <>
            <FormField
              control={form.control}
              name="pause_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-prose font-semibold text-fg-muted">
                    Pause reason
                  </FormLabel>
                  <FormControl>
                    <input type="text" className={fieldClass} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paused_until"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-prose font-semibold text-fg-muted">
                    Paused until (optional)
                  </FormLabel>
                  <FormControl>
                    <input type="date" className={fieldClass} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : null}

        <FormField
          control={form.control}
          name="owner_user_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-prose font-semibold text-fg-muted">
                Account owner
              </FormLabel>
              <FormControl>
                <select
                  className={fieldClass}
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(event.target.value.length > 0 ? event.target.value : null)
                  }
                >
                  <option value="">Unassigned</option>
                  {OWNER_OPTIONS.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-prose font-semibold text-fg-muted">Notes</FormLabel>
              <FormControl>
                <textarea rows={4} className={fieldClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root ? (
          <p role="alert" className="text-prose font-semibold text-danger">
            {form.formState.errors.root.message}
          </p>
        ) : null}

        <AppButton
          variant="primary"
          loading={saving}
          disabled={!form.formState.isDirty || saving}
          onClick={() => {
            void form.handleSubmit((values) => onSubmit(values))();
          }}
        >
          Save
        </AppButton>
      </form>
    </Form>
  );
}

function settingsToFormValues(detail: AccountDetail): AccountSettingsFormValues {
  const { settings } = detail;
  return {
    default_credit_days: settings.default_credit_days,
    currency: settings.currency,
    tds_section: settings.tds_section,
    tds_rate: settings.tds_rate,
    paused: settings.paused_at !== null,
    pause_reason: settings.pause_reason ?? "",
    paused_until: settings.paused_until ?? "",
    owner_user_id: settings.owner_user_id,
    notes: settings.notes ?? "",
  };
}
