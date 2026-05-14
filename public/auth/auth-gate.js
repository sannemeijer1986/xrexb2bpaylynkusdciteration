/**
 * Redirect gate for protected prototype pages. Load immediately after auth-config.js in <head>.
 */
(function () {
  const DEFAULTS = {
    cookieName: "paylynk_proto_auth",
    cookieValue: "1",
    loginPath: "auth/login.html",
    exclude: ["auth/login.html"],
  };

  const cfg = window.AuthGateConfig || { ...DEFAULTS, ...(window.AUTH_GATE_CONFIG || {}) };

  function hasCookie(name, value) {
    return document.cookie.split(";").some((c) => c.trim() === `${name}=${value}`);
  }

  function isExcluded(path) {
    return (cfg.exclude || []).some((p) => path === p || path.endsWith(p));
  }

  const path = window.location.pathname;
  if (isExcluded(path)) return;

  if (!hasCookie(cfg.cookieName, cfg.cookieValue)) {
    const next = encodeURIComponent(path + window.location.search + window.location.hash);
    window.location.replace(`${cfg.loginPath}?next=${next}`);
  }

  window.paylynkProtoLogout = function () {
    document.cookie = `${cfg.cookieName}=; Max-Age=0; Path=/; SameSite=Lax`;
    window.location.href = cfg.loginPath;
  };

  if (typeof window.StaticAuthGate === "undefined") {
    window.StaticAuthGate = { logout: window.paylynkProtoLogout };
  } else {
    window.StaticAuthGate.logout = window.paylynkProtoLogout;
  }
})();
