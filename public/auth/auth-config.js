/**
 * Prototype auth gate config. Override before load: window.AUTH_GATE_CONFIG = { ... }.
 * Password is verified as SHA-256 hex against passwordSha256Hex (same scheme as static HTML gates).
 */
(function () {
  const DEFAULTS = {
    passwordSha256Hex: "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",
    cookieName: "paylynk_proto_auth",
    cookieValue: "1",
    cookieDays: 7,
    loginPath: "auth/login.html",
    exclude: ["auth/login.html"],
  };

  window.AuthGateConfig = { ...DEFAULTS, ...(window.AUTH_GATE_CONFIG || {}) };
})();
