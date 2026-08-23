import { describe, expect, test } from "bun:test";

import {
  accountListItemsFixture,
  LONG_ACCOUNT_NAME,
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
