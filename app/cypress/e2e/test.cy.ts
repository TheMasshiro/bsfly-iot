describe('App', () => {
  it('renders the app root', () => {
    cy.visit('/');
    cy.get('ion-app').should('exist');
  });
});
