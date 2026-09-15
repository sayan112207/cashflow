import { describe, expect, test } from "bun:test";

import {
  allAgedSummaryFixture,
  largeTotalSummaryFixture,
  summaryFixture,
} from "@/lib/services/dashboard.mocks";

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

describe("dashboard summary fixtures", () => {
  test("aging buckets sum to total_outstanding", () => {
    for (const summary of [summaryFixture, allAgedSummaryFixture, largeTotalSummaryFixture]) {
      const agingSum = summary.aging.reduce(
        (sum, segment) => sum + moneyToCents(segment.amount),
        0n,
      );
      expect(centsToMoney(agingSum)).toBe(summary.tiles.total_outstanding);
    }
  });

  test("overdue equals total minus Not yet due", () => {
    for (const summary of [summaryFixture, allAgedSummaryFixture, largeTotalSummaryFixture]) {
      const notYetDue = summary.aging.find((segment) => segment.bucket === "Not yet due");
      if (!notYetDue) {
        throw new Error(`missing Not yet due bucket in fixture as_of=${summary.as_of}`);
      }
      const expectedOverdue =
        moneyToCents(summary.tiles.total_outstanding) - moneyToCents(notYetDue.amount);
      expect(centsToMoney(expectedOverdue)).toBe(summary.tiles.overdue);
    }
  });
});
