/**
 * PayLynk static prototype — local state + floating controls (no backend).
 */
(() => {
  const STORAGE_PREFIX = "xrex.paylynk.prototype.";
  const EMPTY_KEY = `${STORAGE_PREFIX}empty.v1`;
  const LOGGED_IN_KEY = `${STORAGE_PREFIX}loggedIn.v1`;
  const ACCOUNT_CREATED_KEY = `${STORAGE_PREFIX}accountCreated.v1`;
  const CONSENT_AT_KEY = `${STORAGE_PREFIX}consentCompletedAtIso.v1`;
  const EMAIL_VERIFIED_AT_KEY = `${STORAGE_PREFIX}emailVerifiedAtIso.v1`;
  const PASSCODE_SET_AT_KEY = `${STORAGE_PREFIX}passcodeSetAtIso.v1`;
  const LOGGED_IN_SESSION_END_KEY = `${STORAGE_PREFIX}loggedInSessionEndsAtIso.v1`;
  const LOGGED_IN_SESSION_MS = 5 * 60 * 1000;
  const ACTIVATING_SELECTION_KEY = `${STORAGE_PREFIX}activatingSelection.v1`;
  const PAYMENT_METHOD_ADDED_TOAST_KEY = `${STORAGE_PREFIX}showPaymentMethodAddedToast.v1`;
  const USE_DEFAULT_STABLECOIN_KEY = `${STORAGE_PREFIX}useDefaultStablecoin.v1`;
  const JOURNEY_KEY = `${STORAGE_PREFIX}journey.v1`;

  function readUseDefaultStablecoin() {
    try {
      return window.localStorage?.getItem(USE_DEFAULT_STABLECOIN_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function syncUseDefaultStablecoinCheckboxes(enabled) {
    document.querySelectorAll("[data-prototype-use-default-stablecoin]").forEach((el) => {
      el.checked = enabled;
    });
  }

  /** Only user-driven toggles; programmatic .checked updates are not trusted. */
  function onUseDefaultStablecoinCheckboxChange(e) {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.matches("[data-prototype-use-default-stablecoin]")) return;
    if (!e.isTrusted) return;
    setUseDefaultStablecoin(input.checked);
  }

  function clearPickStablecoinSelection() {
    const root = document.querySelector("[data-pick-stablecoin-root]");
    if (!root) return;
    root.querySelectorAll('input[name="stablecoin-pick"]').forEach((inp) => {
      inp.checked = false;
    });
    syncPickStablecoinExpandableDetails();
    syncPickStablecoinContinueFromSelection();
  }

  function setUseDefaultStablecoin(enabled) {
    try {
      window.localStorage?.setItem(USE_DEFAULT_STABLECOIN_KEY, enabled ? "1" : "0");
    } catch (_) {
      /* ignore */
    }
    syncUseDefaultStablecoinCheckboxes(enabled);
    if (!enabled) {
      clearPickStablecoinSelection();
    }
    syncPickStablecoinDefaultStablecoinUi();
  }

  function readJourneyFromStorage() {
    try {
      const v = window.localStorage?.getItem(JOURNEY_KEY);
      return v === "paylynk" ? "paylynk" : "setup";
    } catch (_) {
      return "setup";
    }
  }

  function journeyHref(journey) {
    return journey === "paylynk" ? "paylynk.html" : "index.html";
  }

  function readActivatingSelectionCoin() {
    let coin = "usdt";
    try {
      const raw = window.sessionStorage?.getItem(ACTIVATING_SELECTION_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.coin === "usdc" || o.coin === "usdt") coin = o.coin;
      }
    } catch (_) {
      /* ignore */
    }
    return coin;
  }

  function readActivatingSelectionCoinSym() {
    const coin = readActivatingSelectionCoin();
    return coin === "usdc" ? "USDC" : "USDT";
  }

  function readLoggedInFromStorage() {
    try {
      return window.localStorage?.getItem(LOGGED_IN_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  /**
   * Resume URL for stablecoin setup from payment-setup (expects logged-in when p>=3,
   * except p<=2 which always goes to wallet creation).
   */
  function resolvePaymentSetupStablecoinResumeHref() {
    const p = states.setupProgress;
    const loggedIn = readLoggedInFromStorage();
    if (p <= 2) return "setup-wallet.html";
    if (p <= 3 && loggedIn) return "setup-wallet.html";
    if (p >= 4 && loggedIn) return "pick-stablecoin.html";
    return "setup-wallet.html";
  }

  function paymentSetupIncompleteNeedsVerifyModal() {
    return states.setupProgress >= 3 && !readLoggedInFromStorage();
  }

  const STATE_CONFIGS = {
    setupProgress: {
      storageKey: `${STORAGE_PREFIX}setupProgress.v1`,
      min: 1,
      max: 10,
      initial: 1,
      labels: {
        1: "Init",
        2: "Consented",
        3: "E-mail verified",
        4: "Passcode created",
        5: "Cur&Netw. selected",
        6: "Address generated",
        7: "Authorize auto-debit",
        8: "Auto-debit approved",
        9: "Auto-debit finalized",
        10: "...",
      },
    },
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const states = {};

  /** Set by initWalletModals so payment-setup can open verify email from index. */
  let openVerifyEmailModalRef = null;

  let loggedInTickId = null;

  /** One-shot: after 7 → 8, progress bar animates 50% → 75% instead of jumping. */
  let activatingProgress7to8AnimPending = false;
  let activatingProgress7to8TimerId = null;

  function cancelActivatingProgress7to8Anim() {
    if (activatingProgress7to8TimerId != null) {
      window.clearTimeout(activatingProgress7to8TimerId);
      activatingProgress7to8TimerId = null;
    }
  }

  /** 6 → 7: animate progress 25% → 50%, then open re-auth modal (activating page only). */
  let activatingReauth6to7AnimPending = false;
  let activatingReauth6to7T1 = null;
  let activatingReauth6to7T2 = null;

  function cancelActivatingReauth6to7Timers() {
    if (activatingReauth6to7T1 != null) {
      window.clearTimeout(activatingReauth6to7T1);
      activatingReauth6to7T1 = null;
    }
    if (activatingReauth6to7T2 != null) {
      window.clearTimeout(activatingReauth6to7T2);
      activatingReauth6to7T2 = null;
    }
  }

  function cancelActivatingReauth6to7Anim() {
    cancelActivatingReauth6to7Timers();
    activatingReauth6to7AnimPending = false;
  }

  let prototypeToastHideTimer = null;

  const PROTOTYPE_TOAST_DEFAULT_ICON = "assets/icon_info_blue.svg";

  function queuePaymentMethodAddedToast() {
    try {
      window.sessionStorage?.setItem(PAYMENT_METHOD_ADDED_TOAST_KEY, "1");
    } catch (_) {
      /* ignore */
    }
  }

  function consumePaymentMethodAddedToast() {
    try {
      const queued = window.sessionStorage?.getItem(PAYMENT_METHOD_ADDED_TOAST_KEY) === "1";
      window.sessionStorage?.removeItem(PAYMENT_METHOD_ADDED_TOAST_KEY);
      return queued;
    } catch (_) {
      return false;
    }
  }

  function hidePrototypeToast() {
    const toast = document.getElementById("prototype-toast");
    if (!toast) return;
    const iconEl = toast.querySelector(".wallet-toast__icon");
    if (iconEl) iconEl.src = PROTOTYPE_TOAST_DEFAULT_ICON;
    window.clearTimeout(prototypeToastHideTimer);
    prototypeToastHideTimer = null;
    toast.classList.remove("is-visible");
    const fallback = window.setTimeout(() => {
      if (!toast.classList.contains("is-visible")) toast.hidden = true;
    }, 400);
    const onEnd = () => {
      window.clearTimeout(fallback);
      if (!toast.classList.contains("is-visible")) toast.hidden = true;
      toast.removeEventListener("transitionend", onEnd);
    };
    toast.addEventListener("transitionend", onEnd);
  }

  function showPrototypeToast(message, opts = {}) {
    const toast = document.getElementById("prototype-toast");
    if (!toast) return;
    const textEl = toast.querySelector(".wallet-toast__text");
    const iconEl = toast.querySelector(".wallet-toast__icon");
    const text =
      typeof message === "string" && message.trim() ? message.trim() : "Not in prototype";
    if (textEl) textEl.textContent = text;
    if (iconEl) {
      iconEl.src = opts.success ? "assets/icon_success.svg" : PROTOTYPE_TOAST_DEFAULT_ICON;
    }
    window.clearTimeout(prototypeToastHideTimer);
    prototypeToastHideTimer = null;
    toast.hidden = false;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => toast.classList.add("is-visible"));
    });
    prototypeToastHideTimer = window.setTimeout(() => hidePrototypeToast(), 4500);
  }

  function stopLoggedInTimerTick() {
    if (loggedInTickId != null) {
      window.clearInterval(loggedInTickId);
      loggedInTickId = null;
    }
  }

  function updateLoggedInTimerDisplay() {
    const els = document.querySelectorAll("[data-prototype-logged-in-timer]");
    let isTrue = false;
    try {
      isTrue = window.localStorage?.getItem(LOGGED_IN_KEY) === "true";
    } catch (_) {
      /* ignore */
    }
    if (!isTrue) {
      els.forEach((el) => {
        el.textContent = "0:00";
      });
      return;
    }
    let endMs = NaN;
    try {
      const iso = window.localStorage?.getItem(LOGGED_IN_SESSION_END_KEY);
      if (iso) endMs = new Date(iso).getTime();
    } catch (_) {
      /* ignore */
    }
    if (!Number.isFinite(endMs)) {
      els.forEach((el) => {
        el.textContent = "0:00";
      });
      return;
    }
    const remain = Math.max(0, endMs - Date.now());
    const totalSec = Math.floor(remain / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const text = `${m}:${String(s).padStart(2, "0")}`;
    els.forEach((el) => {
      el.textContent = text;
    });
    if (remain <= 0 && loggedInTickId != null) {
      window.clearInterval(loggedInTickId);
      loggedInTickId = null;
    }
  }

  function startLoggedInTimerTick() {
    stopLoggedInTimerTick();
    updateLoggedInTimerDisplay();
    let endMs = NaN;
    try {
      const iso = window.localStorage?.getItem(LOGGED_IN_SESSION_END_KEY);
      if (iso) endMs = new Date(iso).getTime();
    } catch (_) {
      /* ignore */
    }
    if (!Number.isFinite(endMs)) return;
    const remain = Math.max(0, endMs - Date.now());
    if (remain <= 0) return;
    loggedInTickId = window.setInterval(updateLoggedInTimerDisplay, 1000);
  }

  /** Persist logged-in, sync all selects, and run or clear the 5:00 session timer. */
  function setLoggedInValue(isTrue) {
    const v = isTrue ? "true" : "false";
    try {
      window.localStorage?.setItem(LOGGED_IN_KEY, v);
    } catch (_) {
      /* ignore */
    }
    document.querySelectorAll("[data-prototype-logged-in]").forEach((sel) => {
      sel.value = v;
    });
    if (isTrue) {
      const end = new Date(Date.now() + LOGGED_IN_SESSION_MS).toISOString();
      try {
        window.localStorage?.setItem(LOGGED_IN_SESSION_END_KEY, end);
      } catch (_) {
        /* ignore */
      }
      startLoggedInTimerTick();
    } else {
      try {
        window.localStorage?.removeItem(LOGGED_IN_SESSION_END_KEY);
      } catch (_) {
        /* ignore */
      }
      stopLoggedInTimerTick();
      updateLoggedInTimerDisplay();
    }
  }

  /** Account created (prototype): persisted; auto-true when verify-email loader finishes. */
  function setAccountCreatedValue(isTrue) {
    const v = isTrue ? "true" : "false";
    try {
      window.localStorage?.setItem(ACCOUNT_CREATED_KEY, v);
    } catch (_) {
      /* ignore */
    }
    document.querySelectorAll("[data-prototype-account-created]").forEach((sel) => {
      const wasDisabled = sel.disabled;
      // Must be mutable: assigning .value while disabled can throw / be ignored (breaks 3→2 setup
      // progress before applySetupProgressToUi runs).
      sel.disabled = false;
      sel.value = v;
      sel.disabled = wasDisabled;
    });
  }

  function syncWalletTimelineFromProgress(p) {
    const root =
      document.querySelector('[data-prototype-context="wallet-setup"] .setup-timeline') ||
      document.querySelector(".setup-wallet-card .setup-timeline") ||
      document.querySelector(".setup-timeline");
    if (!root) return;
    const steps = Array.from(root.children).filter((el) =>
      el.classList.contains("setup-timeline__step"),
    );
    if (!steps.length) return;

    if (p >= 4) {
      steps.forEach((el) => {
        el.classList.remove(
          "setup-timeline__step--active",
          "setup-timeline__step--pending",
          "setup-timeline__step--done",
        );
        el.classList.add("setup-timeline__step--done");
      });
      return;
    }

    const step = clamp(p, 1, 3);
    steps.forEach((el, i) => {
      const n = i + 1;
      el.classList.remove(
        "setup-timeline__step--active",
        "setup-timeline__step--pending",
        "setup-timeline__step--done",
      );
      if (n < step) el.classList.add("setup-timeline__step--done");
      else if (n === step) el.classList.add("setup-timeline__step--active");
      else el.classList.add("setup-timeline__step--pending");
    });
  }

  function formatConsentDate(d) {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  }

  function syncConsentTimestamp() {
    const el = document.querySelector("[data-consent-at]");
    if (!el) return;
    const p = states.setupProgress;
    if (p < 2) {
      el.textContent = "";
      return;
    }
    let iso = null;
    try {
      iso = window.localStorage?.getItem(CONSENT_AT_KEY);
    } catch (_) {
      /* ignore */
    }
    if (!iso) {
      iso = new Date().toISOString();
      try {
        window.localStorage?.setItem(CONSENT_AT_KEY, iso);
      } catch (_) {
        /* ignore */
      }
    }
    const d = new Date(iso);
    el.textContent = Number.isFinite(d.getTime()) ? formatConsentDate(d) : "";
  }

  function syncEmailVerifiedTimestamp() {
    const el = document.querySelector("[data-email-verified-at]");
    if (!el) return;
    const p = states.setupProgress;
    if (p < 3) {
      el.textContent = "";
      return;
    }
    let iso = null;
    try {
      iso = window.localStorage?.getItem(EMAIL_VERIFIED_AT_KEY);
    } catch (_) {
      /* ignore */
    }
    if (!iso) {
      iso = new Date().toISOString();
      try {
        window.localStorage?.setItem(EMAIL_VERIFIED_AT_KEY, iso);
      } catch (_) {
        /* ignore */
      }
    }
    const d = new Date(iso);
    el.textContent = Number.isFinite(d.getTime()) ? formatConsentDate(d) : "";
  }

  function syncPasscodeTimestamp() {
    const el = document.querySelector("[data-passcode-set-at]");
    if (!el) return;
    const p = states.setupProgress;
    if (p < 4) {
      el.textContent = "";
      return;
    }
    let iso = null;
    try {
      iso = window.localStorage?.getItem(PASSCODE_SET_AT_KEY);
    } catch (_) {
      /* ignore */
    }
    if (!iso) {
      iso = new Date().toISOString();
      try {
        window.localStorage?.setItem(PASSCODE_SET_AT_KEY, iso);
      } catch (_) {
        /* ignore */
      }
    }
    const d = new Date(iso);
    el.textContent = Number.isFinite(d.getTime()) ? formatConsentDate(d) : "";
  }

  function syncPickStablecoinExpandableDetails() {
    const root = document.querySelector("[data-pick-stablecoin-root]");
    if (!root) return;
    const usdtDetails = root.querySelector("[data-pick-stablecoin-usdt-details]");
    const usdcDetails = root.querySelector("[data-pick-stablecoin-usdc-details]");
    const usdt = root.querySelector('input[name="stablecoin-pick"][value="usdt"]');
    const usdc = root.querySelector('input[name="stablecoin-pick"][value="usdc"]');
    if (usdtDetails && usdt) {
      if (usdt.checked) {
        usdtDetails.removeAttribute("hidden");
      } else {
        usdtDetails.setAttribute("hidden", "");
      }
    }
    if (usdcDetails && usdc) {
      if (usdc.checked) {
        usdcDetails.removeAttribute("hidden");
      } else {
        usdcDetails.setAttribute("hidden", "");
      }
    }
  }

  function syncPickStablecoinContinueFromSelection() {
    const root = document.querySelector("[data-pick-stablecoin-root]");
    if (!root) return;

    const useDefault = readUseDefaultStablecoin();
    const continueBtnDefault = document.getElementById("pick-stablecoin-continue-default");

    if (useDefault) {
      if (continueBtnDefault && continueBtnDefault.tagName === "BUTTON") {
        continueBtnDefault.disabled = false;
        continueBtnDefault.setAttribute("aria-disabled", "false");
      }
      return;
    }

    syncPickStablecoinExpandableDetails();
    const continueBtn =
      document.getElementById("pick-stablecoin-continue") ||
      root.querySelector('[data-pick-stablecoin-continue]:not(#pick-stablecoin-continue-default)');
    if (!continueBtn || continueBtn.tagName !== "BUTTON") return;
    const checked = root.querySelector('input[name="stablecoin-pick"]:checked');
    const enabled = !!checked;
    continueBtn.disabled = !enabled;
    continueBtn.setAttribute("aria-disabled", enabled ? "false" : "true");
  }

  function syncWalletContinueButton() {
    const btn = document.querySelector(".setup-actions--wallet .setup-button--primary");
    if (!btn || btn.tagName !== "BUTTON") return;
    btn.disabled = states.setupProgress < 4;
  }

  function applySetupProgressToUi() {
    const p = states.setupProgress;
    document.documentElement.setAttribute("data-prototype-setup-progress", String(p));
    syncWalletTimelineFromProgress(p);
    syncConsentTimestamp();
    syncEmailVerifiedTimestamp();
    syncPasscodeTimestamp();
    syncWalletContinueButton();
    syncPickStablecoinContinueFromSelection();
    syncPickStablecoinDefaultStablecoinUi();
    syncActivatingStablecoinStatusFromProgress();
    syncPaymentSetupFromProgress();
    syncAccountCreatedPrototypeControl();
  }

  function syncPickStablecoinDefaultStablecoinUi() {
    if (document.body?.getAttribute("data-prototype-context") !== "pick-stablecoin") return;
    const root = document.querySelector("[data-pick-stablecoin-root]");
    if (!root) return;

    const useDefault = readUseDefaultStablecoin();
    root.classList.toggle("pick-stablecoin-root--default-stablecoin", useDefault);
    document.documentElement.toggleAttribute("data-prototype-use-default-stablecoin", useDefault);

    const choiceView = root.querySelector("[data-pick-stablecoin-choice]");
    const defaultView = root.querySelector("[data-pick-stablecoin-default]");
    const actionsChoice = document.querySelector("[data-pick-stablecoin-actions-choice]");
    const defaultFooter = document.querySelector("[data-pick-stablecoin-default-footer]");
    const titleChoice = document.querySelector("[data-pick-stablecoin-title-choice]");
    const titleDefault = document.querySelector("[data-pick-stablecoin-title-default]");

    if (choiceView) choiceView.hidden = useDefault;
    if (defaultView) defaultView.hidden = !useDefault;
    if (actionsChoice) actionsChoice.hidden = useDefault;
    if (defaultFooter) defaultFooter.hidden = !useDefault;
    if (titleChoice) titleChoice.hidden = useDefault;
    if (titleDefault) titleDefault.hidden = !useDefault;

    try {
      document.title = useDefault
        ? "XREX PayLynk - USD stablecoin payments"
        : "XREX PayLynk - Pick a stablecoin";
    } catch (_) {
      /* ignore */
    }

    if (useDefault) {
      const usdt = root.querySelector('input[name="stablecoin-pick"][value="usdt"]');
      if (usdt && !usdt.checked) {
        usdt.checked = true;
      }
    }

    syncPickStablecoinContinueFromSelection();
  }

  /** When setup progress is 3+, account creation is implied — lock control to True. */
  function syncAccountCreatedPrototypeControl() {
    const locked = states.setupProgress >= 3;
    if (locked) {
      setAccountCreatedValue(true);
    }
    document.querySelectorAll("[data-prototype-account-created]").forEach((sel) => {
      if (locked) {
        sel.value = "true";
        sel.disabled = true;
        sel.setAttribute("aria-disabled", "true");
      } else {
        sel.disabled = false;
        sel.removeAttribute("aria-disabled");
      }
    });
  }

  function syncPaymentSetupFromProgress() {
    if (document.body?.getAttribute("data-prototype-context") !== "payment-setup") return;
    const p = states.setupProgress;
    const finalized = p >= 9;
    const nextBtn = document.querySelector("[data-payment-setup-next]");
    if (nextBtn && nextBtn.tagName === "BUTTON") {
      nextBtn.disabled = !finalized;
      nextBtn.setAttribute("aria-disabled", finalized ? "false" : "true");
    }
    const link = document.querySelector("[data-payment-setup-stablecoin-link]");
    if (link) {
      if (finalized) {
        link.setAttribute("tabindex", "-1");
        link.setAttribute("aria-disabled", "true");
      } else {
        link.removeAttribute("tabindex");
        link.removeAttribute("aria-disabled");
      }
    }
    const linked = document.querySelector("[data-payment-setup-linked]");
    if (linked) {
      linked.setAttribute("aria-hidden", finalized ? "false" : "true");
    }
  }

  function syncActivatingStablecoinStatusFromProgress() {
    if (document.body?.getAttribute("data-prototype-context") !== "activating-stablecoin") return;
    const p = states.setupProgress;
    const sym = readActivatingSelectionCoinSym();
    let pct = 0;
    let stepLabel = "Step 1 of 4";
    let title = "Generating payment address";
    let desc =
      "We’re generating your auto-debit payment address for payments to Halcyon Systems Corp. This may take a few minutes.";
    let isSetupComplete = false;

    if (p <= 5) {
      pct = 0;
      stepLabel = "Step 1 of 4";
      title = "Generating payment address";
      desc =
        "We’re generating your auto-debit payment address for payments to Halcyon Systems Corp. This may take a few minutes.";
    } else if (p === 6) {
      pct = 25;
      stepLabel = "Step 2 of 4";
      title = "Preparing wallet";
      desc =
        "We’re adding gas to your wallet to cover the fees needed to enable auto-debit. This may take a few minutes";
    } else if (p === 7) {
      pct = 50;
      stepLabel = "Step 3 of 4";
      title = "Authorize auto-debit to continue";
      desc =
        "Set up auto-debit for Halcyon Systems Corp. Approved payment requests will be automatically debited from a dedicated auto-debit wallet for this beneficiary.";
    } else if (p === 8) {
      pct = 75;
      stepLabel = "Step 4 of 4";
      title = "Enabling auto-debit";
      desc = "Your authorization is being confirmed on the blockchain. This may take a few minutes.";
    } else {
      isSetupComplete = true;
      pct = 100;
      stepLabel = "All steps completed";
      title = "Setup finished";
      desc = `${sym}: Ethereum network (ERC-20) has been activated`;
    }

    const in6to7ReauthAnim = activatingReauth6to7AnimPending && p === 7;
    if (in6to7ReauthAnim) {
      title = "Preparing wallet";
      desc =
        "We’re adding gas to your wallet to cover the fees needed to enable auto-debit. This may take a few minutes";
    }
    const isAuthorizeDebit = p === 7 && !in6to7ReauthAnim;
    const isContinueEnabled = isSetupComplete || isAuthorizeDebit;

    const runActivatingProgress7to8Anim = activatingProgress7to8AnimPending && p === 8;
    if (runActivatingProgress7to8Anim) {
      activatingProgress7to8AnimPending = false;
    }

    const fr = Math.max(0, Math.min(100, pct)) / 100;
    const titleEl = document.querySelector("[data-activating-status-title]");
    const descEl = document.querySelector("[data-activating-status-desc]");
    const progressEl = document.querySelector("[data-activating-progress]");
    const fillEl = progressEl?.querySelector(".activating-stablecoin-progress__fill");
    const stepLabelEl = document.querySelector("[data-activating-step-label]");
    const stepPctEl = document.querySelector("[data-activating-step-pct]");
    const liveIcon = document.querySelector("[data-activating-status-live-icon]");
    const hintEl = document.querySelector("[data-activating-hint]");
    const footerEl = document.querySelector(".activating-stablecoin-status__footer");
    const statusCard = document.querySelector(".activating-stablecoin-status");
    const cardRoot = document.querySelector("[data-activating-root]");
    const ctaWrap = document.querySelector("[data-activating-status-cta]");

    if (cardRoot) cardRoot.setAttribute("data-setup-progress", String(p));
    if (statusCard) statusCard.classList.toggle("activating-stablecoin-status--authorize", isAuthorizeDebit);

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
    if (stepLabelEl) stepLabelEl.textContent = stepLabel;
    if (stepPctEl) {
      if (in6to7ReauthAnim && activatingReauth6to7T1 == null && activatingReauth6to7T2 == null) {
        stepPctEl.textContent = "25%";
      } else if (!in6to7ReauthAnim) {
        stepPctEl.textContent = runActivatingProgress7to8Anim ? "50%" : `${pct}%`;
      }
    }
    if (progressEl) {
      progressEl.hidden = isAuthorizeDebit;
      progressEl.setAttribute("aria-hidden", isAuthorizeDebit ? "true" : "false");
      if (in6to7ReauthAnim && activatingReauth6to7T1 == null && activatingReauth6to7T2 == null) {
        const delayMs = 140;
        const transitionMs = 600;
        progressEl.style.setProperty("--activating-progress-fr", "0.25");
        progressEl.setAttribute("aria-valuenow", "25");
        void progressEl.offsetWidth;
        cancelActivatingReauth6to7Timers();
        activatingReauth6to7T1 = window.setTimeout(() => {
          activatingReauth6to7T1 = null;
          if (document.body?.getAttribute("data-prototype-context") !== "activating-stablecoin") return;
          if (states.setupProgress !== 7 || !activatingReauth6to7AnimPending) return;
          const pe = document.querySelector("[data-activating-progress]");
          const spe = document.querySelector("[data-activating-step-pct]");
          if (pe) {
            pe.style.setProperty("--activating-progress-fr", "0.5");
            pe.setAttribute("aria-valuenow", "50");
          }
          if (spe) spe.textContent = "50%";
          activatingReauth6to7T2 = window.setTimeout(() => {
            activatingReauth6to7T2 = null;
            if (document.body?.getAttribute("data-prototype-context") !== "activating-stablecoin") return;
            if (states.setupProgress !== 7) return;
            activatingReauth6to7AnimPending = false;
            openActivatingReauthModal();
            applySetupProgressToUi();
          }, transitionMs);
        }, delayMs);
      } else if (runActivatingProgress7to8Anim) {
        const frStart = 0.5;
        const frEnd = 0.75;
        const pctEnd = 75;
        const delayMs = 140;
        progressEl.style.setProperty("--activating-progress-fr", String(frStart));
        progressEl.setAttribute("aria-valuenow", "50");
        void progressEl.offsetWidth;
        cancelActivatingProgress7to8Anim();
        activatingProgress7to8TimerId = window.setTimeout(() => {
          activatingProgress7to8TimerId = null;
          if (document.body?.getAttribute("data-prototype-context") !== "activating-stablecoin") return;
          if (states.setupProgress !== 8) return;
          const pe = document.querySelector("[data-activating-progress]");
          const spe = document.querySelector("[data-activating-step-pct]");
          if (pe) {
            pe.style.setProperty("--activating-progress-fr", String(frEnd));
            pe.setAttribute("aria-valuenow", String(pctEnd));
          }
          if (spe) spe.textContent = `${pctEnd}%`;
        }, delayMs);
      } else {
        progressEl.style.setProperty("--activating-progress-fr", String(fr));
        progressEl.setAttribute("aria-valuenow", String(pct));
      }
    }
    if (fillEl) {
      fillEl.classList.toggle("activating-stablecoin-progress__fill--full", pct >= 100);
      fillEl.classList.toggle("activating-stablecoin-progress__fill--empty", pct <= 0 && !isSetupComplete);
      fillEl.classList.toggle("activating-stablecoin-progress__fill--success", isSetupComplete);
    }
    if (liveIcon) {
      if (isAuthorizeDebit) {
        liveIcon.hidden = true;
        liveIcon.setAttribute("aria-hidden", "true");
      } else {
        liveIcon.hidden = false;
        liveIcon.setAttribute("aria-hidden", "true");
      }
      if (isSetupComplete) {
        liveIcon.src = "assets/icon_success.svg";
        liveIcon.classList.add("activating-stablecoin-status__live-icon--success");
      } else if (!isAuthorizeDebit) {
        liveIcon.src = "assets/icon_loader_lightblue.svg";
        liveIcon.classList.remove("activating-stablecoin-status__live-icon--success");
      }
    }
    if (footerEl) {
      footerEl.hidden = isAuthorizeDebit;
      footerEl.setAttribute("aria-hidden", isAuthorizeDebit ? "true" : "false");
    }
    if (ctaWrap) {
      ctaWrap.hidden = !isAuthorizeDebit;
      ctaWrap.setAttribute("aria-hidden", isAuthorizeDebit ? "false" : "true");
    }
    if (hintEl) {
      hintEl.hidden = isSetupComplete;
      hintEl.setAttribute("aria-hidden", isSetupComplete ? "true" : "false");
    }
    const cardContinue = document.querySelector("[data-activating-continue-card]");
    if (cardContinue && cardContinue.tagName === "BUTTON") {
      if (isContinueEnabled) {
        cardContinue.disabled = false;
        cardContinue.removeAttribute("aria-disabled");
      } else {
        cardContinue.disabled = true;
        cardContinue.setAttribute("aria-disabled", "true");
      }
    }
    const footerContinue = document.querySelector("[data-activating-continue-footer]");
    if (footerContinue && footerContinue.tagName === "BUTTON") {
      if (isSetupComplete) {
        footerContinue.disabled = false;
        footerContinue.removeAttribute("aria-disabled");
      } else {
        footerContinue.disabled = true;
        footerContinue.setAttribute("aria-disabled", "true");
      }
    }
    const actionsCancel = document.querySelector("[data-activating-actions-cancel]");
    if (actionsCancel) {
      const hideCancel = p >= 9;
      actionsCancel.hidden = hideCancel;
      actionsCancel.setAttribute("aria-hidden", hideCancel ? "true" : "false");
    }
  }

  function getActivatingReauthModalsRoot() {
    return document.getElementById("activating-reauth-modals");
  }

  function openActivatingReauthModal() {
    const root = getActivatingReauthModalsRoot();
    if (!root || root.hidden === false) return;
    root.hidden = false;
    document.body.classList.add("wallet-modals-is-open");
    const panel = root.querySelector(".verify-email-modal__panel");
    window.requestAnimationFrame(() => {
      panel?.focus({ preventScroll: true });
    });
  }

  function closeActivatingReauthModal() {
    const root = getActivatingReauthModalsRoot();
    if (!root || root.hidden) return;
    root.hidden = true;
    document.body.classList.remove("wallet-modals-is-open");
  }

  function getSetupLeaveDialog() {
    return document.getElementById("setup-leave-dialog");
  }

  function openSetupLeaveDialog() {
    const dialog = getSetupLeaveDialog();
    if (!dialog || !dialog.hidden) return;
    dialog.hidden = false;
    document.body.classList.add("setup-dialog-is-open");
    const panel = dialog.querySelector(".setup-dialog__panel");
    window.requestAnimationFrame(() => {
      panel?.focus({ preventScroll: true });
    });
  }

  function closeSetupLeaveDialog() {
    const dialog = getSetupLeaveDialog();
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    document.body.classList.remove("setup-dialog-is-open");
  }

  function initSetupLeaveCancelDialog() {
    const dialog = getSetupLeaveDialog();
    if (!dialog) return;

    document.querySelectorAll("[data-setup-leave-cancel]").forEach((trigger) => {
      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        openSetupLeaveDialog();
      });
    });

    dialog.querySelectorAll("[data-setup-leave-dialog-dismiss]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        closeSetupLeaveDialog();
      });
    });

    dialog.querySelector("[data-setup-leave-dialog-continue]")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeSetupLeaveDialog();
    });

    dialog.querySelector("[data-setup-leave-dialog-leave]")?.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = journeyHref(readJourneyFromStorage());
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!dialog || dialog.hidden) return;
      closeSetupLeaveDialog();
    });
  }

  function initActivatingReauthModal() {
    const root = getActivatingReauthModalsRoot();
    if (!root) return;

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-wallet-modals-dismiss]")) {
        e.preventDefault();
        closeActivatingReauthModal();
      }
    });

    const authorizeBtn = root.querySelector("[data-activating-reauth-authorize]");
    authorizeBtn?.addEventListener("click", () => {
      closeActivatingReauthModal();
      setState("setupProgress", 8);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!root || root.hidden) return;
      closeActivatingReauthModal();
    });
  }

  function getLabel(group, value) {
    const cfg = STATE_CONFIGS[group];
    return cfg?.labels?.[value] ?? "";
  }

  function updateGroupUI(group) {
    const config = STATE_CONFIGS[group];
    if (!config) return;
    const value = states[group];
    document.querySelectorAll(`[data-state-group="${group}"]`).forEach((groupEl) => {
      const valueEl = groupEl.querySelector("[data-state-value]");
      const nameEl = groupEl.querySelector("[data-state-name]");
      const downBtn = groupEl.querySelector('[data-state-action="down"]');
      const upBtn = groupEl.querySelector('[data-state-action="up"]');
      if (valueEl) valueEl.textContent = String(value);
      if (nameEl) nameEl.textContent = getLabel(group, value);
      if (downBtn) downBtn.disabled = value <= config.min;
      if (upBtn) upBtn.disabled = value >= config.max;
    });
  }

  function setState(group, next, opts = {}) {
    const config = STATE_CONFIGS[group];
    if (!config) return;
    const prev = states[group];
    const clamped = clamp(parseInt(String(next), 10), config.min, config.max);
    if (!opts.force && prev === clamped) return clamped;
    states[group] = clamped;
    try {
      window.localStorage?.setItem(config.storageKey, String(clamped));
    } catch (_) {
      /* ignore */
    }
    updateGroupUI(group);
    if (group === "setupProgress") {
      cancelActivatingProgress7to8Anim();
      cancelActivatingReauth6to7Anim();
      activatingProgress7to8AnimPending = prev === 7 && clamped === 8;
      if (prev === 6 && clamped === 7) {
        activatingReauth6to7AnimPending = true;
      }
      const openReauthFromControls =
        document.body?.getAttribute("data-prototype-context") === "activating-stablecoin" &&
        ((prev === 6 && clamped === 7) || (prev === 8 && clamped === 7));
      if (prev === 3 && clamped === 2) {
        setLoggedInValue(false);
        setAccountCreatedValue(false);
      }
      if (prev === 2 && clamped === 3) {
        setLoggedInValue(true);
        setAccountCreatedValue(true);
      }
      applySetupProgressToUi();
      if (openReauthFromControls && prev === 8 && clamped === 7) {
        window.queueMicrotask(() => openActivatingReauthModal());
      }
    }
    return clamped;
  }

  const changeState = (group, delta) =>
    setState(group, (states[group] ?? 0) + delta);

  function loadStored(group) {
    const config = STATE_CONFIGS[group];
    try {
      const raw = window.localStorage?.getItem(config.storageKey);
      if (raw == null) return null;
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) return clamp(n, config.min, config.max);
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function initStates() {
    Object.keys(STATE_CONFIGS).forEach((group) => {
      const config = STATE_CONFIGS[group];
      const stored = loadStored(group);
      const fallback =
        typeof config.initial === "number" ? config.initial : config.min;
      states[group] = stored ?? fallback;
      updateGroupUI(group);
    });
    applySetupProgressToUi();
  }

  function initBadgeControls() {
    const badge = document.querySelector(".build-badge");
    if (!badge) return;
    const header = badge.querySelector(".build-badge__header");
    const toggleCollapse = () => {
      const isCollapsed = badge.classList.toggle("is-collapsed");
      if (header) header.setAttribute("aria-expanded", String(!isCollapsed));
    };

    header?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCollapse();
    });

    badge.addEventListener("click", (e) => {
      if (!badge.classList.contains("is-collapsed")) return;
      if (e.target.closest("[data-state-action]")) return;
      toggleCollapse();
    });

    badge.addEventListener("click", (e) => {
      const button = e.target.closest("[data-state-action]");
      if (!button) return;
      const groupEl = button.closest("[data-state-group]");
      const group = groupEl?.getAttribute("data-state-group");
      if (!group || !STATE_CONFIGS[group]) return;
      const action = button.getAttribute("data-state-action");
      if (action === "down") changeState(group, -1);
      if (action === "up") changeState(group, 1);
    });
  }

  /** Reserved — persists only; wire UI later. */
  function initEmptyCheckbox() {
    const input = document.querySelector("[data-prototype-empty]");
    if (!input) return;
    try {
      input.checked = window.localStorage?.getItem(EMPTY_KEY) === "1";
    } catch (_) {
      input.checked = false;
    }
    input.addEventListener("change", () => {
      try {
        window.localStorage?.setItem(EMPTY_KEY, input.checked ? "1" : "0");
      } catch (_) {
        /* ignore */
      }
    });
  }

  /** Logged-in dropdown + 5 min session timer (prototype controls). */
  function initLoggedInSelect() {
    const selects = document.querySelectorAll("[data-prototype-logged-in]");
    if (!selects.length) return;

    let stored = "false";
    try {
      stored = window.localStorage?.getItem(LOGGED_IN_KEY) === "true" ? "true" : "false";
    } catch (_) {
      /* ignore */
    }
    selects.forEach((sel) => {
      sel.value = stored;
    });

    if (stored === "true") {
      let endIso = null;
      try {
        endIso = window.localStorage?.getItem(LOGGED_IN_SESSION_END_KEY);
      } catch (_) {
        /* ignore */
      }
      if (!endIso) {
        try {
          window.localStorage?.setItem(
            LOGGED_IN_SESSION_END_KEY,
            new Date(Date.now() + LOGGED_IN_SESSION_MS).toISOString(),
          );
        } catch (_) {
          /* ignore */
        }
      }
      startLoggedInTimerTick();
    } else {
      updateLoggedInTimerDisplay();
    }

    selects.forEach((select) => {
      select.addEventListener("change", () => {
        setLoggedInValue(select.value === "true");
      });
    });
  }

  function initUseDefaultStablecoinCheckbox() {
    if (!document.querySelector("[data-prototype-use-default-stablecoin]")) return;

    try {
      const raw = window.localStorage?.getItem(USE_DEFAULT_STABLECOIN_KEY);
      if (raw !== "1" && raw !== "0") {
        window.localStorage?.setItem(USE_DEFAULT_STABLECOIN_KEY, "0");
      }
    } catch (_) {
      /* ignore */
    }

    syncUseDefaultStablecoinCheckboxes(readUseDefaultStablecoin());

    if (document.documentElement.hasAttribute("data-prototype-use-default-stablecoin-bound")) {
      return;
    }
    document.documentElement.setAttribute("data-prototype-use-default-stablecoin-bound", "");
    document.addEventListener("change", onUseDefaultStablecoinCheckboxChange);
  }

  function initJourneySelect() {
    const selects = document.querySelectorAll("[data-prototype-journey]");
    if (!selects.length) return;

    const stored = readJourneyFromStorage();
    selects.forEach((sel) => {
      sel.value = stored;
    });

    selects.forEach((select) => {
      select.addEventListener("change", () => {
        const journey = select.value === "paylynk" ? "paylynk" : "setup";
        try {
          window.localStorage?.setItem(JOURNEY_KEY, journey);
        } catch (_) {
          /* ignore */
        }
        document.querySelectorAll("[data-prototype-journey]").forEach((el) => {
          if (el !== select) el.value = journey;
        });
        const target = journeyHref(journey);
        const current = window.location.pathname.split("/").pop() || "index.html";
        if (current !== target) window.location.href = target;
      });
    });
  }

  /** Account created dropdown (prototype controls). */
  function initAccountCreatedSelect() {
    const selects = document.querySelectorAll("[data-prototype-account-created]");
    if (!selects.length) return;

    let stored = "false";
    try {
      stored = window.localStorage?.getItem(ACCOUNT_CREATED_KEY) === "true" ? "true" : "false";
    } catch (_) {
      /* ignore */
    }
    selects.forEach((sel) => {
      sel.value = stored;
    });

    selects.forEach((select) => {
      select.addEventListener("change", () => {
        if (states.setupProgress >= 3) {
          setAccountCreatedValue(true);
          select.value = "true";
          return;
        }
        setAccountCreatedValue(select.value === "true");
      });
    });

    syncAccountCreatedPrototypeControl();
  }

  function initTimelineAgreeButton() {
    document.querySelectorAll(".setup-timeline-agree").forEach((btn) => {
      btn.addEventListener("click", () => {
        setState("setupProgress", 2, { force: true });
      });
    });
  }

  function initWalletModals() {
    openVerifyEmailModalRef = null;
    const walletModals = document.getElementById("wallet-modals");
    if (!walletModals) return;

    const verifyDialog = document.getElementById("verify-email-dialog");
    const passcodeModal = document.getElementById("set-passcode-modal");
    const input = walletModals.querySelector("#verify-email-code-input");
    const emailDest = walletModals.querySelector(".verify-email-modal__email");
    const loader = document.getElementById("verify-email-loader");
    const loaderOtp = loader?.querySelector("[data-verify-email-loader-otp]");
    const loaderPreparing = loader?.querySelector("[data-wallet-preparing-loader]");
    const toast = document.getElementById("wallet-toast");
    const toastTextEl = toast?.querySelector(".wallet-toast__text");
    const passcodeWalletInput = document.getElementById("set-passcode-wallet-input");
    const passcodeConfirmInput = document.getElementById("set-passcode-confirm-input");
    const passcodeAck = document.getElementById("set-passcode-ack");
    const passcodeSubmit = document.getElementById("set-passcode-submit");
    let passcodePrototypeDemoApplied = false;
    let passcodeSubmitTimer = null;
    let passcodeSubmitPending = false;

    let lastFocus = null;
    let otpTimer = null;
    let otpPending = false;
    let toastHideTimer = null;

    function syncModalEmail() {
      const src =
        document.querySelector(
          ".setup-timeline__desc--verify .setup-timeline__email",
        ) ||
        document.querySelector("[data-payment-setup-verify-email-source] .setup-timeline__email") ||
        document.querySelector(".setup-timeline__email");
      if (src && emailDest) emailDest.textContent = src.textContent.trim();
    }

    function hideLoader() {
      if (!loader) return;
      loader.hidden = true;
      loader.setAttribute("aria-hidden", "true");
      loader.classList.remove("verify-email-loader--passcode");
      if (loaderOtp) loaderOtp.hidden = false;
      if (loaderPreparing) loaderPreparing.hidden = true;
    }

    function showLoader(mode = "otp") {
      if (!loader) return;
      const isPasscode = mode === "passcode";
      loader.classList.toggle("verify-email-loader--passcode", isPasscode);
      if (loaderOtp) loaderOtp.hidden = isPasscode;
      if (loaderPreparing) loaderPreparing.hidden = !isPasscode;
      loader.hidden = false;
      loader.setAttribute("aria-hidden", "false");
    }

    function clearOtpTimerOnly() {
      if (otpTimer) clearTimeout(otpTimer);
      otpTimer = null;
    }

    function abortPasscodeSubmit() {
      if (passcodeSubmitTimer) window.clearTimeout(passcodeSubmitTimer);
      passcodeSubmitTimer = null;
      passcodeSubmitPending = false;
      hideLoader();
      updatePasscodeSubmitState();
    }

    function abortOtpVerification() {
      clearOtpTimerOnly();
      otpPending = false;
      hideLoader();
    }

    function hideToast() {
      if (!toast) return;
      clearTimeout(toastHideTimer);
      toastHideTimer = null;
      toast.classList.remove("is-visible");
      const fallback = window.setTimeout(() => {
        if (!toast.classList.contains("is-visible")) toast.hidden = true;
      }, 400);
      const onEnd = () => {
        window.clearTimeout(fallback);
        if (!toast.classList.contains("is-visible")) toast.hidden = true;
        toast.removeEventListener("transitionend", onEnd);
      };
      toast.addEventListener("transitionend", onEnd);
    }

    function hideToastImmediate() {
      if (!toast) return;
      clearTimeout(toastHideTimer);
      toastHideTimer = null;
      toast.classList.remove("is-visible");
      toast.hidden = true;
    }

    function updatePasscodeSubmitState() {
      if (!passcodeSubmit) return;
      if (passcodeSubmitPending) {
        passcodeSubmit.disabled = true;
        return;
      }
      const w = passcodeWalletInput?.value ?? "";
      const c = passcodeConfirmInput?.value ?? "";
      const ok =
        !!passcodeAck?.checked &&
        w.length >= 8 &&
        w.length <= 25 &&
        c.length >= 8 &&
        c.length <= 25 &&
        w === c;
      passcodeSubmit.disabled = !ok;
    }

    function resetPasscodeForm() {
      passcodePrototypeDemoApplied = false;
      passcodeModal?.querySelector(".set-passcode-modal__rules")?.classList.remove("is-complete");
      if (passcodeWalletInput) {
        passcodeWalletInput.value = "";
        passcodeWalletInput.type = "password";
        passcodeWalletInput.readOnly = false;
      }
      if (passcodeConfirmInput) {
        passcodeConfirmInput.value = "";
        passcodeConfirmInput.type = "password";
        passcodeConfirmInput.readOnly = false;
      }
      if (passcodeAck) passcodeAck.checked = false;
      document.querySelectorAll("[data-passcode-visibility]").forEach((btn) => {
        btn.setAttribute("aria-pressed", "false");
        const tid = btn.getAttribute("data-passcode-target");
        const isConfirm = tid === "set-passcode-confirm-input";
        btn.setAttribute("aria-label", `Show ${isConfirm ? "confirm passcode" : "wallet passcode"}`);
      });
      updatePasscodeSubmitState();
    }

    function applyPasscodePrototypeDemo() {
      if (passcodePrototypeDemoApplied) return;
      passcodePrototypeDemoApplied = true;
      const demo = "Aa1!aaaa";
      if (passcodeWalletInput) {
        passcodeWalletInput.value = demo;
        passcodeWalletInput.readOnly = true;
      }
      if (passcodeConfirmInput) {
        passcodeConfirmInput.value = demo;
        passcodeConfirmInput.readOnly = true;
      }
      passcodeModal?.querySelector(".set-passcode-modal__rules")?.classList.add("is-complete");
      updatePasscodeSubmitState();
    }

    function showToast(message) {
      if (!toast) return;
      const text =
        typeof message === "string" && message.trim()
          ? message.trim()
          : "E-mail verified";
      if (toastTextEl) toastTextEl.textContent = text;
      clearTimeout(toastHideTimer);
      toast.hidden = false;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => toast.classList.add("is-visible"));
      });
      toastHideTimer = window.setTimeout(() => hideToast(), 4500);
    }

    function completeEmailVerification() {
      abortPasscodeSubmit();
      clearOtpTimerOnly();
      otpPending = false;
      hideLoader();

      const isPaymentSetup = document.body?.getAttribute("data-prototype-context") === "payment-setup";
      if (isPaymentSetup) {
        setLoggedInValue(true);
        if (input) input.value = "";
        if (verifyDialog) verifyDialog.hidden = true;
        walletModals.hidden = true;
        document.body.classList.remove("wallet-modals-is-open");
        hideToastImmediate();
        window.location.href = resolvePaymentSetupStablecoinResumeHref();
        return;
      }

      setAccountCreatedValue(true);
      if (input) input.value = "";
      if (verifyDialog) verifyDialog.hidden = true;
      setState("setupProgress", 3, { force: true });
      setLoggedInValue(true);
      walletModals.hidden = false;
      document.body.classList.add("wallet-modals-is-open");
      if (passcodeModal) {
        window.requestAnimationFrame(() => {
          if (document.body?.getAttribute("data-prototype-context") !== "wallet-setup") return;
          walletModals.hidden = false;
          if (verifyDialog) verifyDialog.hidden = true;
          passcodeModal.hidden = false;
          document.body.classList.add("wallet-modals-is-open");
          resetPasscodeForm();
        });
      }
      showToast();
    }

    function updateLoaderFromInput() {
      if (!input || !loader) return;
      if (input.value.length === 6) {
        showLoader();
        if (!otpPending) {
          otpPending = true;
          otpTimer = window.setTimeout(completeEmailVerification, 3000);
        }
      } else {
        abortOtpVerification();
      }
    }

    function openVerifyModal() {
      syncModalEmail();
      lastFocus = document.activeElement;
      walletModals.hidden = false;
      if (verifyDialog) verifyDialog.hidden = false;
      if (passcodeModal) passcodeModal.hidden = true;
      document.body.classList.add("wallet-modals-is-open");
      abortPasscodeSubmit();
      abortOtpVerification();
      if (input) input.value = "";
      window.requestAnimationFrame(() => input?.focus());
    }

    function openPasscodeModal() {
      lastFocus = document.activeElement;
      walletModals.hidden = false;
      if (verifyDialog) verifyDialog.hidden = true;
      if (passcodeModal) {
        passcodeModal.hidden = false;
        resetPasscodeForm();
      }
      document.body.classList.add("wallet-modals-is-open");
      abortPasscodeSubmit();
      abortOtpVerification();
    }

    function closeWalletModals() {
      abortOtpVerification();
      abortPasscodeSubmit();
      if (input) input.value = "";
      if (verifyDialog) verifyDialog.hidden = false;
      if (passcodeModal) passcodeModal.hidden = true;
      walletModals.hidden = true;
      document.body.classList.remove("wallet-modals-is-open");
      hideToastImmediate();
      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus();
      }
      lastFocus = null;
      resetPasscodeForm();
    }

    document.querySelectorAll(".setup-timeline-verify").forEach((btn) => {
      btn.addEventListener("click", () => openVerifyModal());
    });

    document.querySelectorAll(".setup-timeline-set-passcode").forEach((btn) => {
      btn.addEventListener("click", () => openPasscodeModal());
    });

    input?.addEventListener("input", () => updateLoaderFromInput());

    walletModals.addEventListener("click", (e) => {
      if (loader && !loader.hidden) return;
      if (e.target.closest("[data-wallet-modals-dismiss]")) closeWalletModals();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || walletModals.hidden) return;
      if (loader && !loader.hidden) {
        if (otpPending) {
          abortOtpVerification();
          if (input) input.value = "";
          e.preventDefault();
          return;
        }
        if (passcodeSubmitPending) {
          abortPasscodeSubmit();
          e.preventDefault();
          return;
        }
      }
      closeWalletModals();
    });

    document.querySelectorAll("[data-passcode-visibility]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tid = btn.getAttribute("data-passcode-target");
        const el = tid ? document.getElementById(tid) : null;
        if (!el || el.tagName !== "INPUT") return;
        const show = el.type === "password";
        el.type = show ? "text" : "password";
        btn.setAttribute("aria-pressed", show ? "true" : "false");
        const isConfirm = tid === "set-passcode-confirm-input";
        btn.setAttribute(
          "aria-label",
          show
            ? `Hide ${isConfirm ? "confirm passcode" : "wallet passcode"}`
            : `Show ${isConfirm ? "confirm passcode" : "wallet passcode"}`,
        );
      });
    });

    function onPasscodeFieldInput() {
      if (passcodePrototypeDemoApplied) return;
      const w = passcodeWalletInput?.value ?? "";
      const c = passcodeConfirmInput?.value ?? "";
      if (!w && !c) {
        passcodePrototypeDemoApplied = false;
        passcodeModal?.querySelector(".set-passcode-modal__rules")?.classList.remove("is-complete");
      }
      updatePasscodeSubmitState();
    }

    passcodeWalletInput?.addEventListener("focusin", applyPasscodePrototypeDemo);
    passcodeConfirmInput?.addEventListener("focusin", applyPasscodePrototypeDemo);

    passcodeWalletInput?.addEventListener("input", onPasscodeFieldInput);
    passcodeConfirmInput?.addEventListener("input", onPasscodeFieldInput);
    passcodeAck?.addEventListener("change", updatePasscodeSubmitState);

    passcodeSubmit?.addEventListener("click", () => {
      if (passcodeSubmit.disabled || passcodeSubmitPending) return;
      passcodeSubmitPending = true;
      updatePasscodeSubmitState();
      showLoader("passcode");
      passcodeSubmitTimer = window.setTimeout(() => {
        passcodeSubmitTimer = null;
        passcodeSubmitPending = false;
        hideLoader();
        setState("setupProgress", 4, { force: true });
        closeWalletModals();
        showToast("Wallet account ready");
      }, 3000);
    });

    openVerifyEmailModalRef = openVerifyModal;
  }

  function initWalletContinueToPickStablecoin() {
    const btn = document.querySelector("[data-wallet-continue-next]");
    if (!btn || btn.tagName !== "BUTTON") return;
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const href = btn.getAttribute("data-wallet-continue-next");
      if (href) window.location.href = href;
    });
  }

  function initPaymentSetupPage() {
    if (document.body?.getAttribute("data-prototype-context") !== "payment-setup") return;
    if (consumePaymentMethodAddedToast()) {
      window.requestAnimationFrame(() => {
        showPrototypeToast("Payment method added", { success: true });
      });
    }
    const nextBtn = document.querySelector("[data-payment-setup-next]");
    nextBtn?.addEventListener("click", () => {
      if (nextBtn.disabled) return;
      showPrototypeToast("Not in prototype");
    });
    const showMenuToast = () => showPrototypeToast("Not in prototype");
    const menu = document.querySelector("[data-payment-setup-linked-menu]");
    menu?.addEventListener("click", showMenuToast);
    menu?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showMenuToast();
      }
    });
    const link = document.querySelector("[data-payment-setup-stablecoin-link]");
    link?.addEventListener("click", (e) => {
      if (states.setupProgress >= 9) {
        e.preventDefault();
        return;
      }
      if (e.target.closest(".setup-option__incomplete")) {
        e.preventDefault();
        if (paymentSetupIncompleteNeedsVerifyModal()) {
          if (typeof openVerifyEmailModalRef === "function") {
            openVerifyEmailModalRef();
          } else {
            window.location.href = "setup-wallet.html";
          }
          return;
        }
        window.location.href = resolvePaymentSetupStablecoinResumeHref();
      }
    });
  }

  function initPickStablecoinPage() {
    const root = document.querySelector("[data-pick-stablecoin-root]");
    if (!root) return;
    const sync = () => {
      syncPickStablecoinContinueFromSelection();
    };
    root.querySelectorAll('input[name="stablecoin-pick"]').forEach((inp) => {
      inp.addEventListener("change", sync);
      inp.addEventListener("input", sync);
    });
    root.querySelectorAll("[data-pick-stablecoin-network-help]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
      });
    });
    root.addEventListener("click", (e) => {
      if (e.target.closest(".pick-stablecoin-option")) {
        window.requestAnimationFrame(sync);
      }
    });
    sync();
    syncPickStablecoinDefaultStablecoinUi();

    const goToActivating = () => {
      const useDefault = readUseDefaultStablecoin();
      let coin = "usdt";
      if (!useDefault) {
        const checked = root.querySelector('input[name="stablecoin-pick"]:checked');
        if (checked && (checked.value === "usdc" || checked.value === "usdt")) {
          coin = checked.value;
        }
      }
      const previousCoin = readActivatingSelectionCoin();
      const sameSelection = coin === previousCoin;
      const preserveProgress = states.setupProgress > 5 && sameSelection;
      try {
        window.sessionStorage?.setItem(
          ACTIVATING_SELECTION_KEY,
          JSON.stringify({ coin }),
        );
      } catch (_) {
        /* ignore */
      }
      if (!preserveProgress) {
        setState("setupProgress", 5, { force: true });
      }
      window.location.href = "activating-stablecoin.html";
    };

    document.querySelectorAll("[data-pick-stablecoin-continue]").forEach((btn) => {
      if (btn.tagName !== "BUTTON") return;
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        goToActivating();
      });
    });

    document.querySelectorAll("[data-pick-stablecoin-change]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setUseDefaultStablecoin(false);
      });
    });
  }

  function initActivatingStablecoinPage() {
    if (document.body?.getAttribute("data-prototype-context") !== "activating-stablecoin") return;
    const coin = readActivatingSelectionCoin();
    const sym = coin === "usdc" ? "USDC" : "USDT";
    const iconSrc = coin === "usdc" ? "assets/icon_usdc.svg" : "assets/icon_usdt.svg";
    const titleEl = document.querySelector("[data-activating-page-title]");
    const iconEl = document.querySelector("[data-activating-coin-icon]");
    const ledeEl = document.querySelector("[data-activating-lede]");
    if (titleEl) titleEl.textContent = `Activating ${sym}`;
    if (iconEl) {
      iconEl.src = iconSrc;
    }
    if (ledeEl) {
      ledeEl.textContent = `Setting up ${sym}: Ethereum network (ERC-20) for payments to Halcyon Systems Corp.`;
    }
    try {
      document.title = `XREX PayLynk - Activating ${sym}`;
    } catch (_) {
      /* ignore */
    }

    syncActivatingStablecoinStatusFromProgress();

    const goToPaymentSetupFromActivating = () => {
      if (states.setupProgress < 9) return;
      window.location.href = "index.html";
    };

    document.querySelectorAll("[data-activating-continue-card]").forEach((btn) => {
      if (btn.tagName !== "BUTTON") return;
      btn.addEventListener("click", () => {
        if (states.setupProgress === 7) {
          openActivatingReauthModal();
          return;
        }
        goToPaymentSetupFromActivating();
      });
    });

    document.querySelectorAll("[data-activating-continue-footer]").forEach((btn) => {
      if (btn.tagName !== "BUTTON") return;
      btn.addEventListener("click", () => {
        if (states.setupProgress < 9) return;
        queuePaymentMethodAddedToast();
        goToPaymentSetupFromActivating();
      });
    });

    const ACTIVATING_WAIT_SLIDES = [
      {
        img: "assets/placeholder-wait-1.svg",
        headline: "Placeholder title number one",
        body:
          "Nullam finibus, orci ac mollis sodales, magna lorem mollis nisl, et mattis eros metus nec orci.\n\nVestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; donec velit neque, auctor sit amet aliquam vel.",
      },
      {
        img: "assets/placeholder-wait-2.svg",
        headline: "Placeholder title number two",
        body:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio praesent libero sed cursus ante dapibus diam.\n\nSuspendisse potenti. Cras dapibus vivamus elementum semper nisi aenean vulputate eleifend tellus aenean leo ligula, porttitor eu consequat vitae.",
      },
      {
        img: "assets/placeholder-wait-3.svg",
        headline: "Placeholder title number three",
        body:
          "Curabitur ullamcorper ultricies nisi nam eget dui etiam rhoncus maecenas tempus, tellus eget condimentum rhoncus, sem quam semper libero.\n\nEtiam sit amet orci eget eros faucibus tincidunt duis leo sed fringilla mauris sit amet nibh donec sodales sagittis magna.",
      },
      {
        img: "assets/placeholder-wait-4.svg",
        headline: "Placeholder title number four",
        body:
          "Phasellus viverra nulla ut metus varius laoreet quisque rutrum aenean imperdiet etiam ultricies nisi vel augue curabitur ullamcorper.\n\nNam quam nunc, blandit vel luctus pulvinar hendrerit id lorem maecenas nec odio et ante tincidunt tempus donec vitae sapien.",
      },
    ];

    let idx = 1;
    const max = ACTIVATING_WAIT_SLIDES.length;
    const idxEl = document.querySelector("[data-activating-carousel-index]");
    const prevBtn = document.querySelector("[data-activating-carousel-prev]");
    const nextBtn = document.querySelector("[data-activating-carousel-next]");
    const carouselImg = document.querySelector("[data-activating-carousel-img]");
    const carouselHeadline = document.querySelector("[data-activating-carousel-headline]");
    const carouselBody = document.querySelector("[data-activating-carousel-body]");
    const syncCarousel = () => {
      if (idxEl) idxEl.textContent = `${idx}/${max}`;
      if (prevBtn) prevBtn.disabled = idx <= 1;
      if (nextBtn) nextBtn.disabled = idx >= max;
      const slide = ACTIVATING_WAIT_SLIDES[idx - 1];
      if (slide) {
        if (carouselImg) carouselImg.src = slide.img;
        if (carouselHeadline) carouselHeadline.textContent = slide.headline;
        if (carouselBody) carouselBody.textContent = slide.body;
      }
    };
    prevBtn?.addEventListener("click", () => {
      if (idx > 1) idx -= 1;
      syncCarousel();
    });
    nextBtn?.addEventListener("click", () => {
      if (idx < max) idx += 1;
      syncCarousel();
    });
    syncCarousel();
  }

  function syncPaylynkMethodExpandableDetails() {
    const root = document.querySelector("[data-paylynk-methods]");
    if (!root) return;

    const usdtDetails = root.querySelector("[data-paylynk-method-usdt-details]");
    const usdcDetails = root.querySelector("[data-paylynk-method-usdc-details]");
    const usdt = root.querySelector('input[name="paylynk-payment-method"][value="usdt"]');
    const usdc = root.querySelector('input[name="paylynk-payment-method"][value="usdc"]');

    if (usdtDetails && usdt) {
      if (usdt.checked) usdtDetails.removeAttribute("hidden");
      else usdtDetails.setAttribute("hidden", "");
    }
    if (usdcDetails && usdc) {
      if (usdc.checked) usdcDetails.removeAttribute("hidden");
      else usdcDetails.setAttribute("hidden", "");
    }
  }

  function initPaylynkPage() {
    if (document.body?.getAttribute("data-prototype-context") !== "paylynk") return;

    const methodsRoot = document.querySelector("[data-paylynk-methods]");
    if (methodsRoot) {
      const syncExpandables = () => syncPaylynkMethodExpandableDetails();
      methodsRoot.addEventListener("change", syncExpandables);
      syncExpandables();

      methodsRoot.querySelectorAll("[data-paylynk-fee-details]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showPrototypeToast("Not in prototype");
        });
      });

      methodsRoot.querySelectorAll("[data-paylynk-method-select]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showPrototypeToast("Not in prototype");
        });
      });
    }

    const swiftLabel = document.querySelector("[data-paylynk-method-swift]");
    swiftLabel?.addEventListener("click", (e) => {
      e.preventDefault();
      showPrototypeToast("Not in prototype");
    });
  }

  function resetPrototypeControlsState() {
    setUseDefaultStablecoin(false);

    document.querySelectorAll("[data-prototype-journey]").forEach((sel) => {
      sel.value = "setup";
    });
    try {
      window.localStorage?.setItem(JOURNEY_KEY, "setup");
    } catch (_) {
      /* ignore */
    }

    setLoggedInValue(false);
    setAccountCreatedValue(false);

    setState("setupProgress", 1, { force: true });

    document.querySelectorAll("[data-prototype-account-created]").forEach((sel) => {
      sel.disabled = false;
      sel.removeAttribute("aria-disabled");
      sel.value = "false";
    });
    try {
      window.localStorage?.setItem(ACCOUNT_CREATED_KEY, "false");
    } catch (_) {
      /* ignore */
    }
  }

  function initPrototypeReset() {
    const resetBtn = document.querySelector("[data-prototype-reset]");
    if (!resetBtn) return;
    resetBtn.addEventListener("click", () => {
      const emptyInput = document.querySelector("[data-prototype-empty]");
      if (emptyInput) {
        emptyInput.checked = false;
        try {
          window.localStorage?.setItem(EMPTY_KEY, "0");
        } catch (_) {
          /* ignore */
        }
      }

      resetPrototypeControlsState();

      try {
        window.localStorage?.removeItem(CONSENT_AT_KEY);
      } catch (_) {
        /* ignore */
      }
      try {
        window.localStorage?.removeItem(EMAIL_VERIFIED_AT_KEY);
      } catch (_) {
        /* ignore */
      }
      try {
        window.localStorage?.removeItem(PASSCODE_SET_AT_KEY);
      } catch (_) {
        /* ignore */
      }
      syncConsentTimestamp();
      syncEmailVerifiedTimestamp();
      syncPasscodeTimestamp();

      const wm = document.getElementById("wallet-modals");
      if (wm) {
        wm.hidden = true;
        document.body.classList.remove("wallet-modals-is-open");
        const v = document.getElementById("verify-email-dialog");
        const p = document.getElementById("set-passcode-modal");
        const inp = wm.querySelector("#verify-email-code-input");
        const ld = document.getElementById("verify-email-loader");
        const toastEl = document.getElementById("wallet-toast");
        if (v) v.hidden = false;
        if (p) p.hidden = true;
        if (inp) inp.value = "";
        if (ld) {
          ld.hidden = true;
          ld.setAttribute("aria-hidden", "true");
        }
        if (toastEl) {
          toastEl.hidden = true;
          toastEl.classList.remove("is-visible");
        }
      }

      if (prototypeToastHideTimer != null) {
        window.clearTimeout(prototypeToastHideTimer);
        prototypeToastHideTimer = null;
      }
      const protoToast = document.getElementById("prototype-toast");
      if (protoToast) {
        protoToast.hidden = true;
        protoToast.classList.remove("is-visible");
      }

      if (document.body?.getAttribute("data-prototype-context") === "pick-stablecoin") {
        window.location.href = "setup-wallet.html";
      }
      if (document.body?.getAttribute("data-prototype-context") === "activating-stablecoin") {
        window.location.href = "setup-wallet.html";
      }
      if (document.body?.getAttribute("data-prototype-context") === "paylynk") {
        window.location.href = "index.html";
      }
    });
  }

  function init() {
    initStates();
    initBadgeControls();
    initTimelineAgreeButton();
    initWalletModals();
    initWalletContinueToPickStablecoin();
    initPaymentSetupPage();
    initPickStablecoinPage();
    initActivatingStablecoinPage();
    initPaylynkPage();
    initActivatingReauthModal();
    initSetupLeaveCancelDialog();
    initUseDefaultStablecoinCheckbox();
    initJourneySelect();
    initEmptyCheckbox();
    initLoggedInSelect();
    initAccountCreatedSelect();
    initPrototypeReset();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
