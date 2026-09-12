import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    // Mobile-first viewport — the product is designed mobile-first (02_UX §8)
    viewportWidth: 420,
    viewportHeight: 860,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10_000,
    responseTimeout: 15_000,
  },
});
