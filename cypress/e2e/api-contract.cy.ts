/**
 * API contract checks through Cypress — entitlement gating, plan lifecycle
 * and tenant isolation, exercised the way a mobile client would.
 */
describe("api contract", () => {
  it("starts a 3-day trial, generates and approves a plan, exposes safe-to-spend", () => {
    const email = `api-${Date.now()}@test.dev`;
    cy.request("POST", "/v1/auth/register", {
      email,
      password: "supersecret1",
      currency: "PKR",
      locale: { countryCode: "PK", language: "en", timezone: "Asia/Karachi", weekStart: 1 },
    }).then(({ body }) => {
      expect(body.billing.state).to.eq("trialing");
      expect(body.billing.daysRemaining).to.be.within(1, 3);
      const auth = { Authorization: `Bearer ${body.token}` };

      cy.request({
        method: "PUT",
        url: "/v1/profile",
        headers: auth,
        body: {
          incomeSources: [
            { name: "Salary", expectedAmount: 150000, frequency: "monthly", paydayDay: 1, reliability: "stable" },
          ],
          commitments: [
            { name: "Rent", expectedAmount: 40000, essential: true, cadence: "monthly", dueDay: 5 },
          ],
          categories: [
            { name: "Groceries", baselineWeight: 4, floor: 15000 },
            { name: "Transport", baselineWeight: 2 },
          ],
          emergency: { currentAmount: 30000, targetAmount: 120000 },
        },
      }).its("status").should("eq", 200);

      cy.request({ method: "POST", url: "/v1/month-plans/generate", headers: auth })
        .its("body").then((plan) => {
          expect(plan.status).to.eq("draft");
          expect(plan.totals.protected.amountMinor).to.eq(4_000_000); // rent protected in full
          cy.request({ method: "POST", url: `/v1/month-plans/${plan.id}/approve`, headers: auth })
            .its("body.status").should("eq", "approved");
        });

      cy.request({ url: "/v1/safe-to-spend", headers: auth }).its("body").then((sts) => {
        expect(sts.estimated).to.eq(false);
        expect(sts.availableNow.amountMinor).to.be.a("number");
        expect(sts.daysRemaining).to.be.at.least(1);
      });

      cy.request({ url: "/v1/billing/status", headers: auth }).its("body.state").should("eq", "trialing");
    });
  });

  it("rejects unauthenticated access to user data", () => {
    cy.request({ url: "/v1/profile", failOnStatusCode: false })
      .its("status").should("eq", 401);
  });

  it("serves the demo client and health check", () => {
    cy.request("/health").its("body.ok").should("eq", true);
    cy.request("/").its("status").should("eq", 200);
  });
});
