/** CSV import: parsing, idempotency, duplicate flagging and per-row errors. */
import { describe, expect, it } from "vitest";
import { emptyProfile, store } from "../src/store.js";
import { importCsv } from "../src/services/imports.js";

const TODAY = "2026-09-12";

function makeProfile() {
  const profile = emptyProfile("csv-test-user", "PKR", "2026-09-01T00:00:00Z");
  profile.categories = [
    { id: "cat-groceries", name: "Groceries", kind: "flexible", baselineWeight: 4 },
    { id: "cat-transport", name: "Transport", kind: "flexible", baselineWeight: 2 },
  ];
  store.profiles.set(profile.userId, profile);
  return profile;
}

describe("importCsv", () => {
  it("imports rows with a header, maps columns and guesses categories", () => {
    const profile = makeProfile();
    const csv = [
      "Date,Amount,Description",
      "2026-09-01,1250.50,Grocery store run",
      "02/09/2026,800,Petrol",
    ].join("\n");

    const result = importCsv(profile, [], csv, TODAY);
    expect(result.errors).toEqual([]);
    expect(result.created).toHaveLength(2);
    expect(result.meta.headerDetected).toBe(true);
    expect(result.created[0]!.amount.amountMinor).toBe(125050);
    expect(result.created[0]!.categoryId).toBe("cat-groceries");
    expect(result.created[1]!.date).toBe("2026-09-02"); // day-first assumed
    expect(result.created[1]!.categoryId).toBe("cat-transport");
  });

  it("is idempotent: re-importing the same rows produces duplicates, not double entries", () => {
    const profile = makeProfile();
    const csv = "Date,Amount,Description\n2026-09-03,500,Coffee beans\n2026-09-04,2200,Groceries";
    const first = importCsv(profile, [], csv, TODAY);
    expect(first.created).toHaveLength(2);

    const second = importCsv(profile, first.created, csv, TODAY);
    expect(second.created).toHaveLength(0);
    expect(second.duplicates).toHaveLength(2);
    expect(second.duplicates[0]!.reason).toMatch(/Exact duplicate/i);
  });

  it("flags probable duplicates of manual transactions without counting them", () => {
    const profile = makeProfile();
    const manual = {
      id: "t-manual",
      userId: profile.userId,
      amount: { amountMinor: 300000, currency: "PKR" },
      date: "2026-09-05",
      merchant: "Careem ride",
      categoryId: "cat-transport",
      source: "manual" as const,
      confidence: 1,
      createdAt: "2026-09-05T10:00:00Z",
    };
    const result = importCsv(profile, [manual], "Date,Amount,Description\n2026-09-05,3000,Careem", TODAY);
    expect(result.created).toHaveLength(0);
    expect(result.duplicates[0]!.reason).toMatch(/Probable duplicate/i);
  });

  it("reports per-row errors without failing the whole import", () => {
    const profile = makeProfile();
    const csv = [
      "Date,Amount,Description",
      "2026-09-06,100,Fine row",
      "not-a-date,50,Broken row",
      "2026-09-07,,No amount",
    ].join("\n");
    const result = importCsv(profile, [], csv, TODAY);
    expect(result.created).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]!.row).toBe(3);
  });

  it("supports semicolon and tab delimiters and headerless files", () => {
    const profile = makeProfile();
    const result = importCsv(profile, [], "2026-09-08;1500;Bus pass", TODAY);
    expect(result.created).toHaveLength(1);
    expect(result.meta.delimiter).toBe(";");
    expect(result.created[0]!.amount.amountMinor).toBe(150000);

    const tabbed = importCsv(profile, [], "2026-09-09\t900\tSnacks", TODAY);
    expect(tabbed.created).toHaveLength(1);
    expect(tabbed.meta.delimiter).toBe("\t");
  });

  it("records an idempotency key on created transactions", () => {
    const profile = makeProfile();
    const result = importCsv(profile, [], "2026-09-10,75,Chai", TODAY);
    expect(result.created[0]!.importIdempotencyKey).toBeTruthy();
    expect(result.created[0]!.source).toBe("import");
    expect(result.created[0]!.confidence).toBe(0.9);
  });
});
