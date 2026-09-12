/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Loads the app and seeds a fresh demo account with an approved plan. */
      seed(): Chainable<void>;
    }
  }
}

export {};
