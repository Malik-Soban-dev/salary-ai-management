/**
 * Core demo journey — the salary-planning loop through the real UI:
 * seed → home (safe-to-spend) → plan (protected money) → quick add →
 * CSV import → grounded assistant → month-end review.
 */
describe("demo journey", () => {
  it("seeds a demo account and shows the Home hero with safe-to-spend", () => {
    cy.seed();
    cy.get("#tabbar button").should("have.length", 5);
    cy.get(".hero .amount").invoke("text").should("match", /Rs/);
    // Seeded profile has goals — they appear on Home with progress
    cy.contains("Motorbike upgrade").should("be.visible");
    // Trial badge on a fresh demo account
    cy.contains(/Trial · \d+ days? left/).should("be.visible");
  });

  it("shows the approved plan with protected money and future money", () => {
    cy.seed();
    cy.get('[data-tab="plan"]').click();
    cy.contains("Protected money").should("be.visible");
    cy.contains("Family support").should("be.visible"); // seeded essential commitment
    cy.contains("Future money").should("be.visible");
    cy.contains("Emergency fund").should("be.visible");
    // Seeded plan is approved — no approve button, engine version shown
    cy.get("#btn-approve").should("not.exist");
    cy.contains(/engine v\d+\.\d+\.\d+/).should("be.visible");
  });

  it("quick-adds a transaction from free text (parse → preview → save)", () => {
    cy.seed();
    cy.get('[data-tab="transactions"]').click();
    cy.get("#tx-text").type("Spent 950 on dinner");
    cy.get("#tx-parse").click();
    cy.contains("Save transaction").should("be.visible");
    cy.get("#tx-save").click();
    // The parsed merchant appears in the refreshed transaction list
    cy.contains("dinner", { timeout: 15_000 }).should("be.visible");
  });

  it("imports CSV rows, flags a probable duplicate and skips re-imports", () => {
    cy.seed();
    const csv = [
      "Date,Amount,Description",
      "2026-09-02,2450,Imtiaz", // same date+amount as a seeded txn → probable duplicate
      "2026-09-11,450,Careem ride", // new row
    ].join("\n");
    cy.get('[data-tab="transactions"]').click();
    cy.get("#csv-text").invoke("val", csv);
    cy.get("#csv-import").click();
    cy.contains(/Imported 1 · duplicates skipped: 1/).should("be.visible");
    cy.contains(/Probable duplicate of "Imtiaz Super Market"/).should("be.visible");

    // Re-import: idempotent — nothing new counted
    cy.get("#csv-import").click();
    cy.contains(/Imported 0 · duplicates skipped: 2/).should("be.visible");
  });

  it("answers a spending question grounded in engine calculations", () => {
    cy.seed();
    cy.get('[data-tab="insights"]').click();
    cy.get("#chat-in").type("Can I spend 5000 on shoes?");
    cy.get("#chat-send").click();
    cy.get(".msg.ai", { timeout: 15_000 })
      .should("contain.text", "flexible money")
      .and("contain.text", "grounded in");
  });

  it("shows the month-end review with learning proposals and applies a rollover", () => {
    cy.seed();
    cy.get('[data-tab="insights"]').click();
    cy.contains("Month-end review").should("be.visible");
    // Seeded account has 7+ categorized transactions → evidence is sufficient
    cy.contains(/Plan .+ with these adjustments/).should("be.visible");
    cy.get("#btn-rollover").click();
    cy.contains(/Draft plan for .+ created/, { timeout: 15_000 }).should("be.visible");
    // lands on the Plan screen showing the next month's draft
    cy.contains("Learned from last month", { timeout: 15_000 }).should("be.visible");
    cy.contains("next month").should("be.visible");
    cy.get("#btn-approve").should("be.visible");
  });
});
