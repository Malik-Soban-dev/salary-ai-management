/// <reference types="cypress" />

/**
 * Seed a fresh demo account through the real UI (POST /v1/demo/seed behind the
 * "Try the live demo" button). Every test gets an isolated account — the
 * in-memory store keeps runs deterministic.
 */
Cypress.Commands.add("seed", () => {
  cy.visit("/");
  cy.get("#btn-demo").click();
  cy.contains("Safe to spend", { timeout: 15_000 }).should("be.visible");
});
