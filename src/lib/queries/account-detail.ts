import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AccountDetail, PauseAccountBody, UpdateSettingsBody } from "@/lib/schemas/accounts";
import {
  AccountsApiError,
  accountsQueryKeys,
  pauseAccount,
  resumeAccount,
  updateAccountSettings,
} from "@/lib/services/accounts";

/** Same optimistic pattern as contact update — detail resource, full replace on success. */
export function useUpdateAccountSettings(accountId: string) {
  const queryClient = useQueryClient();
  const queryKey = accountsQueryKeys.detail(accountId);

  return useMutation({
    mutationFn: (vars: { body: UpdateSettingsBody; ifMatch: string }) =>
      updateAccountSettings(accountId, vars.body, vars.ifMatch),

    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AccountDetail>(queryKey);
      if (!previous) return { previous: undefined };

      queryClient.setQueryData<AccountDetail>(queryKey, {
        ...previous,
        settings: {
          ...previous.settings,
          default_credit_days:
            vars.body.default_credit_days ?? previous.settings.default_credit_days,
          currency: vars.body.currency ?? previous.settings.currency,
          tds_section: vars.body.tds_section ?? previous.settings.tds_section,
          tds_rate: vars.body.tds_rate ?? previous.settings.tds_rate,
          owner_user_id:
            vars.body.owner_user_id === undefined
              ? previous.settings.owner_user_id
              : vars.body.owner_user_id,
          notes: vars.body.notes === undefined ? previous.settings.notes : vars.body.notes,
        },
      });

      return { previous };
    },

    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (error instanceof AccountsApiError) {
        toast.error(error.message);
        return;
      }
      toast.error("Couldn't save settings.");
    },

    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });
}

export function usePauseAccount(accountId: string) {
  const queryClient = useQueryClient();
  const queryKey = accountsQueryKeys.detail(accountId);

  return useMutation({
    mutationFn: (vars: { body: PauseAccountBody; ifMatch: string }) =>
      pauseAccount(accountId, vars.body, vars.ifMatch),

    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AccountDetail>(queryKey);
      if (!previous) return { previous: undefined };

      queryClient.setQueryData<AccountDetail>(queryKey, {
        ...previous,
        chase_status: "paused",
        status_label: "Paused",
        header_status: `Chasing paused — ${vars.body.reason}`,
        settings: {
          ...previous.settings,
          paused_at: previous.settings.paused_at ?? new Date().toISOString(),
          pause_reason: vars.body.reason,
          paused_until: vars.body.until ?? null,
        },
      });

      return { previous };
    },

    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (error instanceof AccountsApiError) {
        toast.error(error.message);
        return;
      }
      toast.error("Couldn't pause chasing.");
    },

    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.activity(accountId) });
    },
  });
}

export function useResumeAccount(accountId: string) {
  const queryClient = useQueryClient();
  const queryKey = accountsQueryKeys.detail(accountId);

  return useMutation({
    mutationFn: (vars: { ifMatch: string }) => resumeAccount(accountId, vars.ifMatch),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AccountDetail>(queryKey);
      if (!previous) return { previous: undefined };

      queryClient.setQueryData<AccountDetail>(queryKey, {
        ...previous,
        settings: {
          ...previous.settings,
          paused_at: null,
          pause_reason: null,
          paused_until: null,
        },
      });

      return { previous };
    },

    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (error instanceof AccountsApiError) {
        toast.error(error.message);
        return;
      }
      toast.error("Couldn't resume chasing.");
    },

    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      void queryClient.invalidateQueries({ queryKey: accountsQueryKeys.activity(accountId) });
    },
  });
}
