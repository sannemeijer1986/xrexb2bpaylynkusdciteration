(function () {
  var ANIMATION_MS = 220;
  var PROTOTYPE_SELECTED_SN_KEY = "xrex.paylynk.prototype.selectedSn.v1";
  var PROTOTYPE_SETUP_PROGRESS_KEY = "xrex.paylynk.prototype.setupProgress.v1";
  var PROTOTYPE_ACTIVATING_SELECTION_KEY = "xrex.paylynk.prototype.activatingSelection.v1";

  function showStubToast(msg) {
    var toast = document.getElementById("prototype-toast") || document.getElementById("wallet-toast");
    if (!toast) return;
    var text = toast.querySelector(".wallet-toast__text");
    if (text) text.textContent = msg || "Not in prototype";
    toast.removeAttribute("hidden");
    clearTimeout(showStubToast._t);
    showStubToast._t = setTimeout(function () {
      toast.setAttribute("hidden", "");
    }, 1800);
  }

  function animatePanelHeight(panel, expanded) {
    if (!panel) return;
    var token = String((Number(panel.getAttribute("data-anim-token")) || 0) + 1);
    panel.setAttribute("data-anim-token", token);
    panel.style.transition = "none";
    var current = panel.getBoundingClientRect().height;
    if (expanded) {
      panel.style.height = "auto";
      var target = panel.scrollHeight;
      panel.style.height = current + "px";
      panel.getBoundingClientRect();
      panel.style.transition = "height " + ANIMATION_MS + "ms ease, opacity " + ANIMATION_MS + "ms ease";
      panel.style.height = target + "px";
      panel.style.opacity = "1";
      var onOpenEnd = function (e) {
        if (e.propertyName !== "height") return;
        panel.removeEventListener("transitionend", onOpenEnd);
        if (panel.getAttribute("data-anim-token") !== token) return;
        if (panel.getAttribute("aria-hidden") === "false") {
          panel.style.height = "auto";
        }
      };
      panel.addEventListener("transitionend", onOpenEnd);
    } else {
      if (panel.style.height === "auto") {
        panel.style.height = panel.scrollHeight + "px";
      }
      panel.getBoundingClientRect();
      panel.style.transition = "height " + ANIMATION_MS + "ms ease, opacity " + ANIMATION_MS + "ms ease";
      panel.style.height = "0px";
      panel.style.opacity = "0";
    }
  }

  function refreshExpandedPanelHeight(panel) {
    if (!panel || panel.getAttribute("aria-hidden") === "true") return;

    var token = String((Number(panel.getAttribute("data-anim-token")) || 0) + 1);
    panel.setAttribute("data-anim-token", token);

    var startHeight = panel.getBoundingClientRect().height;
    panel.style.transition = "none";
    if (panel.style.height === "auto" || !panel.style.height) {
      panel.style.height = startHeight + "px";
    } else {
      startHeight = parseFloat(panel.style.height) || startHeight;
    }

    panel.style.height = "auto";
    var targetHeight = panel.scrollHeight;
    panel.style.height = startHeight + "px";
    panel.getBoundingClientRect();

    if (Math.abs(targetHeight - startHeight) < 1) {
      panel.style.height = "auto";
      return;
    }

    panel.style.transition = "height " + ANIMATION_MS + "ms ease";
    panel.style.height = targetHeight + "px";

    var onEnd = function (e) {
      if (e.propertyName !== "height") return;
      panel.removeEventListener("transitionend", onEnd);
      if (panel.getAttribute("data-anim-token") !== token) return;
      if (panel.getAttribute("aria-hidden") === "false") {
        panel.style.height = "auto";
      }
    };
    panel.addEventListener("transitionend", onEnd);
  }

  function setExpanded(item, expanded) {
    if (!item) return;
    var trigger = item.querySelector("[data-payment-method-trigger]");
    var panel = item.querySelector("[data-payment-method-panel]");
    item.classList.toggle("setup-payment-method--expanded", !!expanded);
    if (trigger) trigger.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (panel) {
      panel.setAttribute("aria-hidden", expanded ? "false" : "true");
      animatePanelHeight(panel, !!expanded);
    }
  }

  function initAccordion() {
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-payment-method-item]"));
    if (!items.length) return;

    items.forEach(function (item) {
      var panel = item.querySelector("[data-payment-method-panel]");
      if (panel) {
        panel.hidden = false;
        panel.style.height = "0px";
        panel.style.opacity = "0";
      }
    });

    items.forEach(function (item) {
      var trigger = item.querySelector("[data-payment-method-trigger]");
      if (!trigger) return;
      trigger.addEventListener("click", function () {
        var willExpand = !item.classList.contains("setup-payment-method--expanded");
        items.forEach(function (other) {
          setExpanded(other, other === item ? willExpand : false);
        });
      });
    });
  }

  function initActions() {
    document.querySelectorAll("[data-network-help]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        showStubToast("Not in prototype");
      });
    });

    function goToBankWhitelist(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      window.location.href = "whitelist-bank.html";
    }

    document.querySelectorAll("[data-bank-whitelist], [data-bank-whitelist-add]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (pageContext === "profile-payment-methods") {
          e.preventDefault();
          e.stopPropagation();
          showStubToast("Not in prototype");
          return;
        }
        goToBankWhitelist(e);
      });
    });


    function isNetworkSetupClickable(row) {
      if (!row || row.classList.contains("setup-network--complete")) return false;
      var cta = row.querySelector("[data-network-setup]");
      if (!cta) return false;
      var methodItem = row.closest("[data-payment-method-item]");
      if (methodItem && methodItem.classList.contains("setup-payment-method--state-complete")) return false;
      return true;
    }

    function runNetworkSetup(cta) {
      if (!cta) return;
      var methodItem = cta.closest("[data-payment-method-item]");
      var methodKind = methodItem ? methodItem.getAttribute("data-method-kind") : "";
      var labelEl = cta.querySelector("[data-network-setup-label]");
      var labelText = labelEl ? (labelEl.textContent || "").trim().toLowerCase() : "";
      var selectedSn = methodKind === "usdc" ? "usdc-erc20" : methodKind === "usdt" ? "usdt-erc20" : "none";
      var selectedCoin = methodKind === "usdc" ? "usdc" : methodKind === "usdt" ? "usdt" : "";
      var setupProgress = 1;
      try {
        setupProgress = parseInt((window.localStorage && window.localStorage.getItem(PROTOTYPE_SETUP_PROGRESS_KEY)) || "1", 10);
      } catch (_) {
        setupProgress = 1;
      }
      if (selectedSn !== "none") {
        try {
          window.localStorage && window.localStorage.setItem(PROTOTYPE_SELECTED_SN_KEY, selectedSn);
        } catch (_) {
          // Ignore storage failures in prototype mode.
        }
      }
      if (labelText !== "continue setup") {
        try {
          window.localStorage && window.localStorage.setItem(PROTOTYPE_SETUP_PROGRESS_KEY, "1");
          setupProgress = 1;
        } catch (_) {
          // Ignore storage failures in prototype mode.
        }
      }
      if ((selectedCoin === "usdt" || selectedCoin === "usdc") && Number.isFinite(setupProgress) && setupProgress >= 4) {
        try {
          window.sessionStorage &&
            window.sessionStorage.setItem(
              PROTOTYPE_ACTIVATING_SELECTION_KEY,
              JSON.stringify({ coin: selectedCoin }),
            );
        } catch (_) {
          // Ignore storage failures in prototype mode.
        }
        window.location.href = "activating-stablecoin.html";
        return;
      }
      window.location.href = "setup-wallet.html";
    }

    document.querySelectorAll(".setup-network--active").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (!isNetworkSetupClickable(row)) return;
        var cta = row.querySelector("[data-network-setup]");
        if (!cta) return;
        e.preventDefault();
        runNetworkSetup(cta);
      });
      row.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (!isNetworkSetupClickable(row)) return;
        var cta = row.querySelector("[data-network-setup]");
        if (!cta) return;
        e.preventDefault();
        runNetworkSetup(cta);
      });
      if (isNetworkSetupClickable(row)) {
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
      }
    });
  }

  function expandBankIfWhitelisted() {
    var bankItem = document.querySelector('[data-method-kind="bank"]');
    if (!bankItem || !bankItem.classList.contains("setup-payment-method--state-complete")) return;
    setExpanded(bankItem, true);
  }

  function syncBankPanelAfterWhitelistChange() {
    var bankItem = document.querySelector('[data-method-kind="bank"]');
    if (!bankItem) return;

    if (bankItem.classList.contains("setup-payment-method--state-complete")) {
      if (!bankItem.classList.contains("setup-payment-method--expanded")) {
        setExpanded(bankItem, true);
        return;
      }
    }

    if (bankItem.classList.contains("setup-payment-method--expanded")) {
      var panel = bankItem.querySelector("[data-payment-method-panel]");
      refreshExpandedPanelHeight(panel);
    }
  }

  var pageContext = document.body && document.body.getAttribute("data-prototype-context");
  if (pageContext === "payment-setup" || pageContext === "profile-payment-methods") {
    initAccordion();
    initActions();
    if (pageContext === "payment-setup") {
      document.addEventListener("paylynk:bank-whitelisted-changed", function () {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(syncBankPanelAfterWhitelistChange);
        });
      });
    }
  }
})();
