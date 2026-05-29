(function () {
  const BANK_WHITELISTED_KEY = "xrex.paylynk.prototype.bankWhitelisted.v1";
  const LOADER_MS = 2000;

  function setBankWhitelistedStorage(enabled) {
    try {
      window.localStorage?.setItem(BANK_WHITELISTED_KEY, enabled ? "1" : "0");
    } catch (_) {
      /* ignore */
    }
  }

  function showLoader() {
    const loader = document.getElementById("verify-email-loader");
    if (!loader) return;
    loader.hidden = false;
    loader.setAttribute("aria-hidden", "false");
    document.body.classList.add("setup-dialog-is-open");
  }

  function hideLoader() {
    const loader = document.getElementById("verify-email-loader");
    if (!loader) return;
    loader.hidden = true;
    loader.setAttribute("aria-hidden", "true");
    document.body.classList.remove("setup-dialog-is-open");
  }

  function setFilled(root, filled) {
    root.classList.toggle("bank-whitelist--filled", filled);
    root.classList.toggle("bank-whitelist--empty", !filled);
    const saveBtn = root.querySelector("[data-bank-whitelist-save]");
    if (saveBtn && saveBtn.tagName === "BUTTON") {
      saveBtn.disabled = !filled;
      saveBtn.setAttribute("aria-disabled", filled ? "false" : "true");
    }
  }

  function initBankWhitelistPage() {
    if (document.body?.getAttribute("data-prototype-context") !== "bank-whitelist") return;

    const root = document.querySelector("[data-bank-whitelist-root]");
    const autofillTarget = document.querySelector("[data-bank-whitelist-autofill]");
    const saveBtn = document.querySelector("[data-bank-whitelist-save]");
    const cancelBtn = document.querySelector("[data-bank-whitelist-cancel]");

    if (!root) return;

    setFilled(root, false);

    autofillTarget?.addEventListener("click", function () {
      if (root.classList.contains("bank-whitelist--filled")) return;
      setFilled(root, true);
    });

    cancelBtn?.addEventListener("click", function (e) {
      e.preventDefault();
      window.location.href = "index.html";
    });

    saveBtn?.addEventListener("click", function () {
      if (saveBtn.disabled) return;
      showLoader();
      window.setTimeout(function () {
        setBankWhitelistedStorage(true);
        if (window.PaylynkPrototype?.setBankWhitelisted) {
          window.PaylynkPrototype.setBankWhitelisted(true);
        }
        if (window.PaylynkPrototype?.queuePaymentMethodAddedToast) {
          window.PaylynkPrototype.queuePaymentMethodAddedToast();
        }
        hideLoader();
        window.location.href = "index.html";
      }, LOADER_MS);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBankWhitelistPage);
  } else {
    initBankWhitelistPage();
  }
})();
