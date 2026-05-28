(function () {
  var ANIMATION_MS = 220;

  function showStubToast(msg) {
    var toast = document.getElementById("wallet-toast");
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
    document.querySelectorAll("[data-network-help], [data-bank-whitelist]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        showStubToast("Not in prototype");
      });
    });

    document.querySelectorAll("[data-network-setup]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        window.location.href = "setup-wallet.html";
      });
    });
  }

  if (document.body && document.body.getAttribute("data-prototype-context") === "payment-setup") {
    initAccordion();
    initActions();
  }
})();
