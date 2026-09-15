import { describe, expect, test } from "bun:test";

import {
  ACCOUNT_IDS,
  accountListItemsFixture,
  CONTACT_IDS,
  getMockAccountContacts,
  getMockAccountDetail,
  LONG_ACCOUNT_NAME,
  mockUpdateContact,
  mockUpdateChasingSettings,
  sharmaDetailFixture,
} from "@/lib/services/accounts.mocks";

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

describe("accounts list fixtures", () => {
  test("twelve rows outstanding sum to 3637000.00 and overdue to 1994000.00", () => {
    expect(accountListItemsFixture).toHaveLength(12);

    const outstanding = accountListItemsFixture.reduce(
      (sum, row) => sum + moneyToCents(row.outstanding),
      0n,
    );
    const overdue = accountListItemsFixture.reduce(
      (sum, row) => sum + moneyToCents(row.overdue),
      0n,
    );

    expect(centsToMoney(outstanding)).toBe("3637000.00");
    expect(centsToMoney(overdue)).toBe("1994000.00");
  });

  test("overflow account name is exactly 60 characters", () => {
    expect(LONG_ACCOUNT_NAME).toHaveLength(60);
  });
});

describe("Sharma Traders detail fixtures", () => {
  test("aging buckets sum to outstanding and overdue equals total minus Not yet due", () => {
    const agingSum = sharmaDetailFixture.aging.reduce(
      (sum, segment) => sum + moneyToCents(segment.amount),
      0n,
    );
    expect(centsToMoney(agingSum)).toBe(sharmaDetailFixture.outstanding);

    const notYetDue = sharmaDetailFixture.aging.find((segment) => segment.bucket === "Not yet due");
    if (!notYetDue) {
      throw new Error("missing Not yet due bucket");
    }
    const expectedOverdue =
      moneyToCents(sharmaDetailFixture.outstanding) - moneyToCents(notYetDue.amount);
    expect(centsToMoney(expectedOverdue)).toBe(sharmaDetailFixture.overdue);
  });
});

describe("last usable P0 is protected", () => {
  // Sharma has exactly one usable P0 (Rajat Mehta), so any edit that would stop
  // it being a usable P0 has to be refused.
  function sharmaToken(): string {
    const contacts = getMockAccountContacts(ACCOUNT_IDS.sharma);
    if (!contacts) throw new Error("missing Sharma contacts fixture");
    return contacts.updated_at;
  }

  test("moving the only usable P0 to another tier is rejected", () => {
    expect(() =>
      mockUpdateContact(ACCOUNT_IDS.sharma, CONTACT_IDS.rajat, { tier: "P1" }, sharmaToken()),
    ).toThrow("An account needs a P0 contact to be chased. Add a replacement first.");
  });

  test("marking the only usable P0 do-not-contact is rejected", () => {
    expect(() =>
      mockUpdateContact(
        ACCOUNT_IDS.sharma,
        CONTACT_IDS.rajat,
        { do_not_contact: true, dnc_reason: "Left the company" },
        sharmaToken(),
      ),
    ).toThrow("An account needs a P0 contact to be chased. Add a replacement first.");
  });

  test("a P0 edit that keeps it usable still goes through", () => {
    const updated = mockUpdateContact(
      ACCOUNT_IDS.sharma,
      CONTACT_IDS.rajat,
      { tier: "P0", designation: "Accounts Payable" },
      sharmaToken(),
    );
    const rajat = updated.contacts.find((c) => c.contact_id === CONTACT_IDS.rajat);
    expect(rajat?.tier).toBe("P0");
    expect(rajat?.designation).toBe("Accounts Payable");
  });
});

describe("account settings owner", () => {
  test("clearing the owner clears the owner name with it", () => {
    const before = getMockAccountDetail(ACCOUNT_IDS.sharma);
    if (!before) throw new Error("missing Sharma detail fixture");

    // The settings body is now the whole chasing-settings resource, so the call
    // echoes the current values back and changes only the owner.
    const s = before.settings;
    const after = mockUpdateChasingSettings(
      ACCOUNT_IDS.sharma,
      {
        chase_mode: s.chase_mode,
        stop_reason: s.stop_reason,
        stop_note: s.stop_note,
        send_window_mode: s.send_window_mode,
        terms_preset: s.terms_preset,
        term_days: s.term_days,
        is_msme: s.is_msme,
        tds_section: s.tds_section,
        tds_rate: s.tds_rate,
        owner_user_id: null,
        notes: s.notes,
      },
      before.updated_at,
    );

    expect(after.settings.owner_user_id).toBeNull();
    expect(after.settings.owner_name).toBeNull();
  });

  test("an unknown owner id carries no name", () => {
    const before = getMockAccountDetail(ACCOUNT_IDS.sharma);
    if (!before) throw new Error("missing Sharma detail fixture");

    const s = before.settings;
    const after = mockUpdateChasingSettings(
      ACCOUNT_IDS.sharma,
      {
        chase_mode: s.chase_mode,
        stop_reason: s.stop_reason,
        stop_note: s.stop_note,
        send_window_mode: s.send_window_mode,
        terms_preset: s.terms_preset,
        term_days: s.term_days,
        is_msme: s.is_msme,
        tds_section: s.tds_section,
        tds_rate: s.tds_rate,
        owner_user_id: "ffffffff-0000-4000-8000-00000000ffff",
        notes: s.notes,
      },
      before.updated_at,
    );

    // The id is stored, so the name must not be the previous owner's.
    expect(after.settings.owner_user_id).toBe("ffffffff-0000-4000-8000-00000000ffff");
    expect(after.settings.owner_name).toBeNull();
  });
});
