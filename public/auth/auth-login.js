/**
 * Login form for auth/login.html
 */
(function () {
  const form = document.getElementById("form");
  const errEl = document.getElementById("err");

  if (!form || !window.StaticAuthGate) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errEl.textContent = "";

    const pw = document.getElementById("pw").value;
    const valid = await StaticAuthGate.validatePassword(pw);

    if (!valid) {
      errEl.textContent = "Wrong password.";
      return;
    }

    StaticAuthGate.authenticate();
  });
})();
