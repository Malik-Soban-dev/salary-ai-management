/**
 * First-time user experience (02_UX §7): register → 8-stage wizard →
 * first plan generated and approved.
 */
describe("onboarding", () => {
  it("walks a new user from registration to an approved first plan", () => {
    const email = `e2e-${Date.now()}@test.dev`;

    cy.visit("/");
    cy.get("#in-email").type(email);
    cy.get("#in-pass").type("supersecret1");
    cy.get("#in-cur").select("PKR");
    cy.get("#btn-register").click();

    // Step 0: welcome + promise
    cy.contains("how you use money").should("be.visible");
    cy.get("#ob-next").click();

    // Step 1: income (required)
    cy.contains("Take-home amount").should("be.visible");
    cy.get('input[data-inc="0"][data-field="amount"]').type("150000");
    cy.get("#ob-next").click();

    // Step 2: commitments (skippable)
    cy.contains("Recurring commitments").should("be.visible");
    cy.get("#ob-skip").click();

    // Step 3: lifestyle — tune one category weight, continue
    cy.contains("Everyday spending").should("be.visible");
    cy.get('input[data-cat="0"]').clear().type("6");
    cy.get("#ob-next").click();

    // Step 4: safety (skippable)
    cy.contains("Financial safety").should("be.visible");
    cy.get("#ob-skip").click();

    // Step 5: goals (skippable)
    cy.contains("What’s next for you?").should("be.visible");
    cy.get("#ob-skip").click();

    // Step 6: planning style → build the first plan
    cy.contains("Planning style").should("be.visible");
    cy.get('[data-style="balanced"]').click();
    cy.get("#ob-next").click();

    // Step 7: plan is generated and shown as a draft
    cy.contains("Salary Plan", { timeout: 15_000 }).should("be.visible");
    cy.get("#btn-approve").should("be.visible").click();
    cy.get(".badge").contains("approved").should("be.visible");
    // Income protected first: protected total row exists
    cy.contains("Protected total").should("be.visible");
  });

  it("keeps the onboarding promise: returning to the app skips the wizard", () => {
    const email = `e2e-return-${Date.now()}@test.dev`;
    cy.visit("/");
    cy.get("#in-email").type(email);
    cy.get("#in-pass").type("supersecret1");
    cy.get("#btn-register").click();
    cy.contains("how you use money").should("be.visible");
    cy.get("#ob-next").click();
    cy.get('input[data-inc="0"][data-field="amount"]').type("80000");
    cy.get("#ob-next").click();
    cy.get("#ob-skip").click(); // commitments
    cy.get("#ob-skip").click(); // lifestyle (defaults)
    cy.get("#ob-skip").click(); // safety
    cy.get("#ob-skip").click(); // goals
    cy.get("#ob-next").click(); // build plan

    cy.contains("Salary Plan", { timeout: 15_000 }).should("be.visible");
    // Reload — profile now has income, so no wizard again
    cy.reload();
    cy.get("#tabbar").should("be.visible");
    cy.contains("Safe to spend").should("not.exist"); // we're on the plan route
    cy.get('[data-tab="home"]').click();
    cy.contains("Safe to spend").should("be.visible");
  });
});
