/**
 * Stand-in for the ES-module-only "jose" package, which Jest cannot load. Tests that merely
 * import the auth code (such as the route inventory) never verify a token; a test that does
 * must provide its own mock.
 */
export const createRemoteJWKSet = (): never => {
  throw new Error('jose is mocked in unit tests');
};
export const jwtVerify = (): never => {
  throw new Error('jose is mocked in unit tests');
};
