describe("Hardware page", () => {
  it("redirects unauthenticated users to welcome", () => {
    cy.visit("/hardware");

    cy.location("pathname", { timeout: 10000 }).should("eq", "/welcome");
    cy.document().its("body.innerText").should("include", "BSFly");
    cy.document().its("body.innerText").should("include", "terms and conditions");
  });
});