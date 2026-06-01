/**
 * Bank account row action menu on Add a payment method (Edit / Delete).
 */
(function () {
  var activeMenu = null;

  function positionMenu(btn, menu) {
    var rect = btn.getBoundingClientRect();
    menu.style.top = Math.round(rect.bottom + 4) + "px";
    menu.style.right = Math.round(window.innerWidth - rect.right) + "px";
    menu.style.left = "auto";
  }

  function clearMenuPosition(menu) {
    menu.style.top = "";
    menu.style.right = "";
    menu.style.left = "";
  }

  function repositionActiveMenu() {
    if (!activeMenu) return;
    positionMenu(activeMenu.btn, activeMenu.menu);
  }

  function showStubToast(msg) {
    var toast = document.getElementById("prototype-toast");
    if (!toast) return;
    var textEl = toast.querySelector(".wallet-toast__text");
    if (textEl) textEl.textContent = msg || "Not in prototype";
    toast.hidden = false;
    clearTimeout(showStubToast._t);
    showStubToast._t = window.setTimeout(function () {
      toast.hidden = true;
    }, 1800);
  }

  function closeAllMenus() {
    document.querySelectorAll(".setup-bank-account-menu.is-open").forEach(function (menu) {
      menu.classList.remove("is-open");
      menu.setAttribute("aria-hidden", "true");
      clearMenuPosition(menu);
    });
    document.querySelectorAll("[data-bank-account-menu][aria-expanded='true']").forEach(function (btn) {
      btn.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll(".setup-payment-method__bank-account-card.is-menu-open").forEach(function (card) {
      card.classList.remove("is-menu-open");
    });
    activeMenu = null;
  }

  function openMenu(card, btn, menu) {
    closeAllMenus();
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    btn.setAttribute("aria-expanded", "true");
    card.classList.add("is-menu-open");
    activeMenu = { card: card, btn: btn, menu: menu };
    positionMenu(btn, menu);
  }

  function closeMenu(card, btn, menu) {
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    btn.setAttribute("aria-expanded", "false");
    card.classList.remove("is-menu-open");
    clearMenuPosition(menu);
    if (activeMenu && activeMenu.menu === menu) activeMenu = null;
  }

  function toggleMenu(card, btn, menu) {
    if (menu.classList.contains("is-open")) {
      closeMenu(card, btn, menu);
    } else {
      openMenu(card, btn, menu);
    }
  }

  function bindCard(card) {
    var btn = card.querySelector("[data-bank-account-menu]");
    var menu = card.querySelector("[data-bank-account-menu-dropdown]");
    if (!btn || !menu) return;

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      toggleMenu(card, btn, menu);
    });

    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        toggleMenu(card, btn, menu);
      }
      if (e.key === "Escape") closeMenu(card, btn, menu);
    });

    menu.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    var editBtn = menu.querySelector("[data-bank-account-edit]");
    editBtn?.addEventListener("click", function (e) {
      e.preventDefault();
      closeMenu(card, btn, menu);
      showStubToast("Not in prototype");
    });

    var deleteBtn = menu.querySelector("[data-bank-account-delete]");
    deleteBtn?.addEventListener("click", function (e) {
      e.preventDefault();
      closeMenu(card, btn, menu);
      showStubToast("Not in prototype");
    });
  }

  function init() {
    var ctx = document.body?.getAttribute("data-prototype-context");
    if (ctx !== "payment-setup" && ctx !== "profile-payment-methods") return;
    document.querySelectorAll(".setup-payment-method__bank-account-card").forEach(bindCard);
    document.addEventListener("click", closeAllMenus);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllMenus();
    });
    window.addEventListener("resize", repositionActiveMenu);
    window.addEventListener("scroll", repositionActiveMenu, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
