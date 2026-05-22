(function () {
            const walletEntryRoots = document.querySelectorAll("[data-pp-wallet-entry]");
            const requestOtpModal = document.getElementById("requestOtpModal");
            const modal = document.getElementById("verifyEmailModal");
            const closeBtn = document.getElementById("verifyEmailClose");
            const okayBtn = document.getElementById("verifyEmailOkay");
            const requestOtpClose = document.getElementById("requestOtpClose");
            const requestOtpCancel = document.getElementById("requestOtpCancel");
            const getVerificationCodeBtn = document.getElementById("getVerificationCodeBtn");
            const verifyInput = document.getElementById("verifyCodeInput");
            const loadingEl = document.getElementById("verifyEmailLoading");
            const walletLoadingModal = document.getElementById("walletLoadingModal");
            const walletPasscodeModal = document.getElementById("walletPasscodeModal");
            const walletPasscodeClose = document.getElementById("walletPasscodeClose");
            const walletPasscodeCancel = document.getElementById("walletPasscodeCancel");
            const walletPasscodeVerify = document.getElementById("walletPasscodeVerify");
            const walletPasscodeInput = document.getElementById("walletPasscodeInput");
            const walletPasscodeToggle = document.getElementById("walletPasscodeToggle");
            const walletModal = document.getElementById("walletModal");
            const walletModalClose = document.getElementById("walletModalClose");
            const walletLoadingMessage = document.getElementById("walletLoadingMessage");
            let verifyFlowRunning = false;
            var walletPasscodeNextAction = null;

            function isSessionActive() {
                if (typeof window.PaylynkPrototype?.isWalletPasscodeSessionActive === "function") {
                    return window.PaylynkPrototype.isWalletPasscodeSessionActive();
                }
                try {
                    if (window.localStorage?.getItem("xrex.paylynk.prototype.walletPasscode.v1") !== "active") return false;
                    var iso = window.localStorage?.getItem("xrex.paylynk.prototype.walletPasscodeSessionEndsAtIso.v1");
                    if (!iso) return false;
                    var endMs = new Date(iso).getTime();
                    return Number.isFinite(endMs) && endMs > Date.now();
                } catch (_) {
                    return false;
                }
            }
            function setSession() {
                if (typeof window.PaylynkPrototype?.activateWalletPasscodeSession === "function") {
                    window.PaylynkPrototype.activateWalletPasscodeSession();
                } else if (typeof window.PaylynkPrototype?.setWalletPasscodeValue === "function") {
                    window.PaylynkPrototype.setWalletPasscodeValue("active");
                }
            }
            function clearSession() {
                if (typeof window.PaylynkPrototype?.setWalletPasscodeValue === "function") {
                    window.PaylynkPrototype.setWalletPasscodeValue("inactive");
                }
            }
            function enableWalletSkeleton() {
                if (walletModal) walletModal.classList.add("pp-wallet-modal--skeleton");
            }

            function disableWalletSkeleton() {
                if (walletModal) walletModal.classList.remove("pp-wallet-modal--skeleton");
                if (walletModal && walletModal._skeletonTimer) {
                    clearTimeout(walletModal._skeletonTimer);
                    walletModal._skeletonTimer = null;
                }
            }

            function disableWalletSkeletonWithDelay(ms) {
                if (!walletModal) return;
                if (walletModal._skeletonTimer) clearTimeout(walletModal._skeletonTimer);
                walletModal._skeletonTimer = setTimeout(function () {
                    disableWalletSkeleton();
                }, typeof ms === "number" ? ms : 1500);
            }
            if (!modal) return;

            var activeWalletMenu = null;

            function closeAllWalletMenus() {
                document.querySelectorAll(".wallet-entry__dropdown.is-open").forEach(function (menu) {
                    menu.classList.remove("is-open");
                    menu.setAttribute("aria-hidden", "true");
                });
                document.querySelectorAll("[data-pp-wallet-menu][aria-expanded='true']").forEach(function (btn) {
                    btn.setAttribute("aria-expanded", "false");
                });
                document.querySelectorAll("[data-pp-wallet-entry].is-menu-hover").forEach(function (entry) {
                    entry.classList.remove("is-menu-hover");
                });
                activeWalletMenu = null;
            }

            function lockBackgroundScroll() {
                var y = window.scrollY || window.pageYOffset || 0;
                document.documentElement.style.overflow = "hidden";
                document.body.dataset.scrollY = String(y);
                document.body.style.position = "fixed";
                document.body.style.width = "100%";
                document.body.style.left = "0";
                document.body.style.right = "0";
                document.body.style.top = "-" + y + "px";
            }

            function unlockBackgroundScroll() {
                var y = parseInt(document.body.dataset.scrollY || "0", 10) || 0;
                document.documentElement.style.overflow = "";
                document.body.style.position = "";
                document.body.style.width = "";
                document.body.style.left = "";
                document.body.style.right = "";
                document.body.style.top = "";
                delete document.body.dataset.scrollY;
                window.scrollTo(0, y);
            }

            function isPrototypeLoggedInSessionActive() {
                if (typeof window.PaylynkPrototype?.isLoggedInSessionActive === "function") {
                    return window.PaylynkPrototype.isLoggedInSessionActive();
                }
                try {
                    if (window.localStorage?.getItem("xrex.paylynk.prototype.loggedIn.v1") !== "true") return false;
                    var iso = window.localStorage?.getItem("xrex.paylynk.prototype.loggedInSessionEndsAtIso.v1");
                    if (!iso) return false;
                    var endMs = new Date(iso).getTime();
                    return Number.isFinite(endMs) && endMs > Date.now();
                } catch (_) {
                    return false;
                }
            }

            function prepareWalletAssetsView() {
                if (typeof showAssetsView === "function") {
                    showAssetsView();
                } else if (typeof setActiveTab === "function") {
                    setActiveTab("assets");
                }
            }

            function revealWalletAfterLogin() {
                prepareWalletAssetsView();
                if (walletModal) walletModal.setAttribute("aria-hidden", "false");
                enableWalletSkeleton();
                disableWalletSkeletonWithDelay(1500);
            }

            function openWalletWithLoadingTransition(opts) {
                opts = opts || {};
                if (walletLoadingMessage) walletLoadingMessage.textContent = "Launching your wallet...";
                lockBackgroundScroll();
                walletLoadingModal.setAttribute("aria-hidden", "false");
                setTimeout(function () {
                    walletLoadingModal.setAttribute("aria-hidden", "true");
                    if (opts.requirePasscode) {
                        prepareWalletAssetsView();
                        if (walletModal) walletModal.setAttribute("aria-hidden", "true");
                        openWalletPasscodeModal();
                        return;
                    }
                    revealWalletAfterLogin();
                }, 900);
            }

            function openModal() {
                // Prototype “Logged in” + timer: skip email OTP only; passcode unless wallet session exists.
                if (isPrototypeLoggedInSessionActive()) {
                    if (isSessionActive()) {
                        openWalletWithLoadingTransition();
                    } else {
                        openWalletWithLoadingTransition({ requirePasscode: true });
                    }
                    return;
                }
                // Logged out or timer at 0:00 — full flow (OTP → code → loading → passcode).
                if (requestOtpModal) {
                    requestOtpModal.setAttribute("aria-hidden", "false");
                    lockBackgroundScroll();
                } else {
                    openVerifyModal();
                }
            }

            // Debug-only: open wallet directly (no loaders/sessions)
            function openWalletDirect() {
                if (!walletModal) return;
                walletLoadingModal && walletLoadingModal.setAttribute("aria-hidden", "true");
                requestOtpModal && requestOtpModal.setAttribute("aria-hidden", "true");
                modal && modal.setAttribute("aria-hidden", "true");
                walletModal.setAttribute("aria-hidden", "false");
                walletModal.classList.remove("pp-wallet-modal--settings-visible");
                if (typeof walletViewSettings !== "undefined" && walletViewSettings) {
                    walletViewSettings.setAttribute("hidden", "");
                    walletViewSettings.setAttribute("aria-hidden", "true");
                }
                if (typeof setActiveTab === "function") setActiveTab("assets");
                lockBackgroundScroll();
                if (typeof queueWalletViewOverflowUpdate === "function") {
                    requestAnimationFrame(function () {
                        queueWalletViewOverflowUpdate();
                    });
                }
            }

            function closeRequestOtpModal() {
                if (requestOtpModal) requestOtpModal.setAttribute("aria-hidden", "true");
                unlockBackgroundScroll();
            }

            function openVerifyModal() {
                if (requestOtpModal) requestOtpModal.setAttribute("aria-hidden", "true");
                if (verifyInput) {
                    verifyInput.value = "";
                    verifyInput.readOnly = false;
                }
                modal.setAttribute("aria-hidden", "false");
                lockBackgroundScroll();
                window.setTimeout(function () {
                    if (verifyInput) {
                        verifyInput.focus();
                        runVerifyInputFlow();
                    }
                }, 150);
            }

            function closeModal() {
                modal.setAttribute("aria-hidden", "true");
                if (loadingEl) loadingEl.setAttribute("aria-hidden", "true");
                if (walletLoadingModal) walletLoadingModal.setAttribute("aria-hidden", "true");
                if (walletPasscodeModal) walletPasscodeModal.setAttribute("aria-hidden", "true");
                if (walletModal) walletModal.setAttribute("aria-hidden", "true");
                verifyFlowRunning = false;
                if (verifyInput) verifyInput.readOnly = false;
                unlockBackgroundScroll();
            }

            function openWalletMenu(entry, moreBtn, moreMenu) {
                closeAllWalletMenus();
                moreMenu.classList.add("is-open");
                moreMenu.setAttribute("aria-hidden", "false");
                moreBtn.setAttribute("aria-expanded", "true");
                activeWalletMenu = { entry: entry, moreBtn: moreBtn, moreMenu: moreMenu };
            }

            function closeWalletMenu(entry, moreBtn, moreMenu) {
                moreMenu.classList.remove("is-open");
                moreMenu.setAttribute("aria-hidden", "true");
                moreBtn.setAttribute("aria-expanded", "false");
                entry.classList.remove("is-menu-hover");
                if (activeWalletMenu && activeWalletMenu.moreMenu === moreMenu) {
                    activeWalletMenu = null;
                }
            }

            function toggleWalletMenu(entry, moreBtn, moreMenu) {
                if (moreMenu.classList.contains("is-open")) {
                    closeWalletMenu(entry, moreBtn, moreMenu);
                } else {
                    openWalletMenu(entry, moreBtn, moreMenu);
                }
            }

            function openWalletFromEntry(entry, moreBtn, moreMenu) {
                closeWalletMenu(entry, moreBtn, moreMenu);
                openModal();
            }

            function bindWalletEntry(entry) {
                var moreBtn = entry.querySelector("[data-pp-wallet-menu]");
                var moreMenu = entry.querySelector("[data-pp-wallet-menu-dropdown]");
                if (!moreBtn || !moreMenu) return;

                entry.setAttribute("role", entry.getAttribute("role") || "button");
                if (!entry.hasAttribute("tabindex")) entry.setAttribute("tabindex", "0");

                entry.addEventListener("click", function (e) {
                    if (e.target.closest("[data-pp-wallet-menu]") || e.target.closest("[data-pp-wallet-menu-dropdown]")) return;
                    e.stopPropagation();
                    e.preventDefault();
                    openWalletFromEntry(entry, moreBtn, moreMenu);
                });
                entry.addEventListener("keydown", function (e) {
                    if (e.key === "Enter" || e.key === " ") {
                        if (e.target.closest("[data-pp-wallet-menu]")) return;
                        e.preventDefault();
                        e.stopPropagation();
                        openWalletFromEntry(entry, moreBtn, moreMenu);
                    }
                });

                moreBtn.addEventListener("click", function (e) {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleWalletMenu(entry, moreBtn, moreMenu);
                });
                moreBtn.addEventListener("keydown", function (e) {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleWalletMenu(entry, moreBtn, moreMenu);
                    }
                });

                moreBtn.addEventListener("mouseenter", function () {
                    entry.classList.add("is-menu-hover");
                });
                moreBtn.addEventListener("mouseleave", function () {
                    entry.classList.remove("is-menu-hover");
                });

                moreMenu.addEventListener("click", function (e) {
                    e.stopPropagation();
                });
                moreMenu.addEventListener("mouseenter", function () {
                    entry.classList.add("is-menu-hover");
                });
                moreMenu.addEventListener("mouseleave", function () {
                    entry.classList.remove("is-menu-hover");
                });

                moreMenu.querySelectorAll("a, [data-pp-wallet-open]").forEach(function (item) {
                    item.addEventListener("click", function (e) {
                        var href = item.getAttribute("href") || "";
                        var isExternal = href && href !== "#" && item.getAttribute("target") === "_blank";
                        var opensWallet = item.hasAttribute("data-pp-wallet-open");
                        if (!isExternal) e.preventDefault();
                        closeWalletMenu(entry, moreBtn, moreMenu);
                        if (opensWallet) openModal();
                    });
                });
            }

            walletEntryRoots.forEach(bindWalletEntry);

            document.addEventListener("click", function () {
                closeAllWalletMenus();
            });

            if (requestOtpModal) {
                requestOtpModal.addEventListener("click", function (e) {
                    if (e.target === requestOtpModal) closeRequestOtpModal();
                });
            }
            if (requestOtpClose) requestOtpClose.addEventListener("click", closeRequestOtpModal);
            if (requestOtpCancel) requestOtpCancel.addEventListener("click", closeRequestOtpModal);
            if (getVerificationCodeBtn) {
                getVerificationCodeBtn.addEventListener("click", function () {
                    if (requestOtpModal) requestOtpModal.setAttribute("aria-hidden", "true");
                    openVerifyModal();
                });
            }

            // Attach invisible bottom-left hotspot to open wallet directly
            var debugHotspot = document.querySelector(".pp-wallet-debug-hotspot");
            if (debugHotspot) {
                debugHotspot.addEventListener("click", function () {
                    openWalletDirect();
                });
            }

            modal.addEventListener("click", function (e) {
                if (e.target === modal) closeModal();
            });

            function runVerifyInputFlow() {
                if (!verifyInput || !walletLoadingModal || verifyFlowRunning) return;
                verifyFlowRunning = true;
                verifyInput.value = "123456";
                verifyInput.readOnly = true;

                if (walletLoadingMessage) walletLoadingMessage.textContent = "Launching your wallet...";
                setTimeout(function () {
                    modal.setAttribute("aria-hidden", "true");
                    if (loadingEl) loadingEl.setAttribute("aria-hidden", "true");
                    walletLoadingModal.setAttribute("aria-hidden", "false");
                    setTimeout(function () {
                        walletLoadingModal.setAttribute("aria-hidden", "true");
                        prepareWalletAssetsView();
                        if (walletModal) walletModal.setAttribute("aria-hidden", "true");
                        openWalletPasscodeModal();
                        verifyFlowRunning = false;
                    }, 900);
                }, 500);
            }

            function updateWalletPasscodeVerifyState() {
                if (!walletPasscodeInput || !walletPasscodeVerify) return;
                var enabled = (walletPasscodeInput.value || "").trim().length > 0;
                walletPasscodeVerify.disabled = !enabled;
                walletPasscodeVerify.classList.toggle("ew-btn--disabled", !enabled);
            }

            function openWalletPasscodeModal(nextAction) {
                if (!walletPasscodeModal) return;
                if (walletPasscodeModal.parentElement !== document.body) {
                    document.body.appendChild(walletPasscodeModal);
                }
                walletPasscodeNextAction = typeof nextAction === "function" ? nextAction : null;
                if (walletPasscodeInput) {
                    walletPasscodeInput.value = "";
                }
                updateWalletPasscodeVerifyState();
                walletPasscodeModal.classList.remove("pp-wallet-passcode-modal--closing");
                walletPasscodeModal.setAttribute("aria-hidden", "false");
                window.requestAnimationFrame(function () {
                    if (walletPasscodeInput) walletPasscodeInput.focus();
                });
            }

            function closeWalletPasscodeModal() {
                if (!walletPasscodeModal) return;
                if (walletPasscodeModal.getAttribute("aria-hidden") === "true") {
                    walletPasscodeModal.classList.remove("pp-wallet-passcode-modal--closing");
                    walletPasscodeNextAction = null;
                    return;
                }
                var dialog = walletPasscodeModal.querySelector(".pp-wallet-passcode-modal__dialog");
                if (!dialog) {
                    walletPasscodeModal.setAttribute("aria-hidden", "true");
                    walletPasscodeModal.classList.remove("pp-wallet-passcode-modal--closing");
                    walletPasscodeNextAction = null;
                    return;
                }
                walletPasscodeModal.classList.add("pp-wallet-passcode-modal--closing");
                var onAnimEnd = function (e) {
                    if (e.target !== dialog) return;
                    dialog.removeEventListener("animationend", onAnimEnd);
                    walletPasscodeModal.classList.remove("pp-wallet-passcode-modal--closing");
                    walletPasscodeModal.setAttribute("aria-hidden", "true");
                    walletPasscodeNextAction = null;
                };
                dialog.addEventListener("animationend", onAnimEnd);
            }

            if (walletPasscodeInput) {
                walletPasscodeInput.addEventListener("focus", function () {
                    if (!(walletPasscodeInput.value || "").trim()) {
                        walletPasscodeInput.value = "123456";
                    }
                    updateWalletPasscodeVerifyState();
                });
                walletPasscodeInput.addEventListener("click", function () {
                    if (!(walletPasscodeInput.value || "").trim()) {
                        walletPasscodeInput.value = "123456";
                    }
                    updateWalletPasscodeVerifyState();
                });
                walletPasscodeInput.addEventListener("input", updateWalletPasscodeVerifyState);
            }

            if (walletPasscodeVerify) {
                walletPasscodeVerify.addEventListener("click", function () {
                    if (walletPasscodeVerify.disabled) return;
                    var next = walletPasscodeNextAction;
                    closeWalletPasscodeModal();
                    if (typeof next === "function") {
                        // Withdraw flow: run the queued action.
                        next();
                    } else {
                        // Login flow: OTP + wallet passcode = full login.
                        setSession();
                        revealWalletAfterLogin();
                    }
                });
            }

            function handleWalletPasscodeDismiss() {
                var hasNext = typeof walletPasscodeNextAction === "function";
                closeWalletPasscodeModal();
                if (!hasNext) {
                    closeWalletModal();
                }
            }

            if (walletPasscodeToggle && walletPasscodeInput) {
                walletPasscodeToggle.addEventListener("click", function () {
                    var isHidden = walletPasscodeInput.type === "password";
                    walletPasscodeInput.type = isHidden ? "text" : "password";
                    var img = walletPasscodeToggle.querySelector("img");
                    if (img) {
                        img.src = isHidden ? "assets/icon-ew-eye-open-blue.svg" : "assets/icon-ew-eye-closed-blue.svg";
                    }
                    walletPasscodeToggle.setAttribute("aria-label", isHidden ? "Hide passcode" : "Show passcode");
                });
            }

            if (walletPasscodeCancel) {
                walletPasscodeCancel.addEventListener("click", function () {
                    handleWalletPasscodeDismiss();
                });
            }

            if (walletPasscodeClose) {
                walletPasscodeClose.addEventListener("click", function () {
                    handleWalletPasscodeDismiss();
                });
            }

            if (walletPasscodeModal) {
                walletPasscodeModal.addEventListener("click", function (e) {
                    if (e.target === walletPasscodeModal) {
                        handleWalletPasscodeDismiss();
                    }
                });
            }

            if (verifyInput) {
                verifyInput.addEventListener("focus", runVerifyInputFlow);
                verifyInput.addEventListener("input", function () {
                    if (verifyInput.readOnly) verifyInput.value = "123456";
                });
                verifyInput.addEventListener("keydown", function (e) {
                    if (verifyInput.readOnly) e.preventDefault();
                });
            }

            if (closeBtn) closeBtn.addEventListener("click", closeModal);
            if (okayBtn) okayBtn.addEventListener("click", closeModal);

            function closeWalletModal() {
                closeWalletCloseConfirm();
                hideWithdrawProcessingModal();
                closeWalletPasscodeModal();
                showListView();
                if (walletModal) walletModal.setAttribute("aria-hidden", "true");
                disableWalletSkeleton();
                unlockBackgroundScroll();
            }

            function isWalletOnHighestLevel() {
                if (!walletModal) return true;
                if (walletModal.classList.contains("pp-wallet-modal--withdraw-select-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-form-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-confirm-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-completed-view") || walletModal.classList.contains("pp-wallet-modal--export-key-view")) return false;
                return !walletModal.classList.contains("pp-wallet-modal--beneficiary-view");
            }

            var walletCloseConfirm = document.getElementById("walletCloseConfirm");
            var walletCloseConfirmBack = document.getElementById("walletCloseConfirmBack");
            var walletCloseConfirmClose = document.getElementById("walletCloseConfirmClose");

            function openWalletCloseConfirm() {
                if (walletCloseConfirm) {
                    walletCloseConfirm.setAttribute("aria-hidden", "false");
                }
            }

            function closeWalletCloseConfirm() {
                if (walletCloseConfirm) {
                    walletCloseConfirm.setAttribute("aria-hidden", "true");
                }
            }

            function onWalletCloseClick() {
                if (walletModal && walletModal.classList.contains("pp-wallet-modal--settings-visible")) {
                    openWalletCloseConfirm();
                    return;
                }
                if (isWalletOnHighestLevel()) {
                    closeWalletModal();
                } else {
                    openWalletCloseConfirm();
                }
            }

            if (walletModalClose) walletModalClose.addEventListener("click", onWalletCloseClick);
            if (walletCloseConfirmBack) {
                walletCloseConfirmBack.addEventListener("click", function () {
                    closeWalletCloseConfirm();
                    if (walletModal && walletModal.classList.contains("pp-wallet-modal--settings-visible")) {
                        showAssetsView();
                    } else if (walletModal && walletModal.classList.contains("pp-wallet-modal--export-key-view")) {
                        walletModal.classList.add("pp-wallet-modal--from-export-key");
                        var onTransitionEndFromExport = function (e) {
                            if (e.target && e.target.classList && e.target.classList.contains("pp-wallet-modal__view") && e.propertyName === "transform") {
                                walletModal.removeEventListener("transitionend", onTransitionEndFromExport);
                                walletModal.classList.remove("pp-wallet-modal--from-export-key");
                            }
                        };
                        walletModal.addEventListener("transitionend", onTransitionEndFromExport);
                        requestAnimationFrame(function () {
                            showAddressDetailView(currentBeneficiaryName, currentBeneficiaryInitials, currentNetworkName || "Ethereum (ERC-20)");
                        });
                    } else {
                        showListView();
                    }
                });
            }
            if (walletCloseConfirmClose) {
                walletCloseConfirmClose.addEventListener("click", function () {
                    closeWalletCloseConfirm();
                    closeWalletModal();
                });
            }
            if (walletCloseConfirm) {
                var backdrop = walletCloseConfirm.querySelector(".pp-wallet-close-confirm__backdrop");
                if (backdrop) backdrop.addEventListener("click", closeWalletCloseConfirm);
                var walletCloseConfirmDismiss = document.getElementById("walletCloseConfirmDismiss");
                if (walletCloseConfirmDismiss) walletCloseConfirmDismiss.addEventListener("click", closeWalletCloseConfirm);
            }

            // About / Export info dialogs (Settings)
            var walletAboutDialog = document.getElementById("walletAboutDialog");
            var walletAboutDialogDone = document.getElementById("walletAboutDialogDone");
            var walletAboutDialogDismiss = document.getElementById("walletAboutDialogDismiss");
            function openWalletAboutDialog() {
                if (walletAboutDialog) walletAboutDialog.setAttribute("aria-hidden", "false");
            }
            function closeWalletAboutDialog() {
                if (walletAboutDialog) walletAboutDialog.setAttribute("aria-hidden", "true");
            }
            if (walletAboutDialog) {
                var aboutBackdrop = walletAboutDialog.querySelector(".pp-wallet-close-confirm__backdrop");
                if (aboutBackdrop) aboutBackdrop.addEventListener("click", closeWalletAboutDialog);
            }
            if (walletAboutDialogDone) walletAboutDialogDone.addEventListener("click", closeWalletAboutDialog);
            if (walletAboutDialogDismiss) walletAboutDialogDismiss.addEventListener("click", closeWalletAboutDialog);

            var walletExportInfoDialog = document.getElementById("walletExportInfoDialog");
            var walletExportInfoDialogUnderstood = document.getElementById("walletExportInfoDialogUnderstood");
            var walletExportInfoDialogDismiss = document.getElementById("walletExportInfoDialogDismiss");
            function openWalletExportInfoDialog() {
                if (walletExportInfoDialog) walletExportInfoDialog.setAttribute("aria-hidden", "false");
            }
            function closeWalletExportInfoDialog() {
                if (walletExportInfoDialog) walletExportInfoDialog.setAttribute("aria-hidden", "true");
            }
            if (walletExportInfoDialog) {
                var exportInfoBackdrop = walletExportInfoDialog.querySelector(".pp-wallet-close-confirm__backdrop");
                if (exportInfoBackdrop) exportInfoBackdrop.addEventListener("click", closeWalletExportInfoDialog);
            }
            if (walletExportInfoDialogUnderstood) walletExportInfoDialogUnderstood.addEventListener("click", closeWalletExportInfoDialog);
            if (walletExportInfoDialogDismiss) walletExportInfoDialogDismiss.addEventListener("click", closeWalletExportInfoDialog);

            var walletBalanceInfoDialog = document.getElementById("walletBalanceInfoDialog");
            var walletBalanceInfoDialogUnderstood = document.getElementById("walletBalanceInfoDialogUnderstood");
            var walletBalanceInfoDialogDismiss = document.getElementById("walletBalanceInfoDialogDismiss");
            function openWalletBalanceInfoDialog() {
                if (walletBalanceInfoDialog) walletBalanceInfoDialog.setAttribute("aria-hidden", "false");
            }
            function closeWalletBalanceInfoDialog() {
                if (walletBalanceInfoDialog) walletBalanceInfoDialog.setAttribute("aria-hidden", "true");
            }
            if (walletBalanceInfoDialog) {
                var balanceInfoBackdrop = walletBalanceInfoDialog.querySelector(".pp-wallet-close-confirm__backdrop");
                if (balanceInfoBackdrop) balanceInfoBackdrop.addEventListener("click", closeWalletBalanceInfoDialog);
            }
            if (walletBalanceInfoDialogUnderstood) {
                walletBalanceInfoDialogUnderstood.addEventListener("click", closeWalletBalanceInfoDialog);
            }
            if (walletBalanceInfoDialogDismiss) {
                walletBalanceInfoDialogDismiss.addEventListener("click", closeWalletBalanceInfoDialog);
            }
            if (walletModal) {
                walletModal.querySelectorAll(".pp-wallet-modal__balance-info").forEach(function (btn) {
                    btn.addEventListener("click", function (e) {
                        e.preventDefault();
                        openWalletBalanceInfoDialog();
                    });
                });
            }

            // Beneficiary detail + Address detail views
            var walletModalBack = document.getElementById("walletModalBack");
            var walletModalDialog = walletModal && walletModal.querySelector(".pp-wallet-modal__dialog");
            var walletViews = walletModal && walletModal.querySelector(".pp-wallet-modal__views");
            var walletViewList = document.getElementById("walletViewList");
            var walletViewBeneficiary = document.getElementById("walletViewBeneficiary");
            var walletViewAddressDetail = document.getElementById("walletViewAddressDetail");
            var walletViewWithdrawSelect = document.getElementById("walletViewWithdrawSelect");
            var walletViewWithdrawForm = document.getElementById("walletViewWithdrawForm");
            var walletViewWithdrawConfirm = document.getElementById("walletViewWithdrawConfirm");
            var walletViewWithdrawCompleted = document.getElementById("walletViewWithdrawCompleted");
            var walletViewExportKey = document.getElementById("walletViewExportKey");
            var walletViewSaveKey = document.getElementById("walletViewSaveKey");
            var walletWithdrawProcessingModal = document.getElementById("walletWithdrawProcessingModal");
            var walletProcessingModalLabel = document.getElementById("walletProcessingModalLabel");
            var walletModalHeaderAvatar = document.getElementById("walletModalHeaderAvatar");
            var walletModalHeaderLabel = document.getElementById("walletModalHeaderLabel");
            var walletModalTitle = document.getElementById("walletModalTitle");
            var walletHeaderIconWrap = walletModal && walletModal.querySelector(".pp-wallet-modal__header-icon-wrap");
            var walletHeaderAvatarWrap = walletModal && walletModal.querySelector(".pp-wallet-modal__header-avatar-wrap");
            var walletHeaderAddressDetailWrap = walletModal && walletModal.querySelector(".pp-wallet-modal__header-address-detail-wrap");
            var walletHeaderWithdrawWrap = walletModal && walletModal.querySelector(".pp-wallet-modal__header-withdraw-wrap");
            var walletHeaderExportKeyWrap = walletModal && walletModal.querySelector(".pp-wallet-modal__header-export-key-wrap");
            var walletModalHeader = walletModal && walletModal.querySelector(".pp-wallet-modal__header");
            var WALLET_DEFAULT_LABEL = "abc1234@gmail.com";
            var WALLET_DEFAULT_TITLE = "Wallet account";
            var currentBeneficiaryName = "";
            var currentBeneficiaryInitials = "";
            var currentNetworkName = "";
            var currentExportPrivateKey = "";
            var currentExportFlowStep = "intro";
            var exportKeyFlowSkippedExplanation = false;
            var exportFlowTransitionTimer = null;
            var exportedAddressHidden = false;
            var exportedBeneficiaryName = "";
            var currentWithdrawAsset = "USDT";
            var currentWithdrawEntryPoint = "select-asset";

            var walletBeneficiaryDetailBalance = document.getElementById("walletBeneficiaryDetailBalance");

            function queueWalletViewOverflowUpdate() {
                if (!walletModal) return;
                if (walletModal._overflowRaf) cancelAnimationFrame(walletModal._overflowRaf);
                walletModal._overflowRaf = requestAnimationFrame(function () {
                    var views = walletModal.querySelectorAll(".pp-wallet-modal__view");
                    views.forEach(function (viewEl) {
                        var isActive = viewEl.getAttribute("aria-hidden") !== "true";
                        if (!isActive) {
                            viewEl.classList.remove("pp-wallet-modal__view--overflowing");
                            return;
                        }
                        var hasOverflow = viewEl.scrollHeight > (viewEl.clientHeight + 1);
                        viewEl.classList.toggle("pp-wallet-modal__view--overflowing", hasOverflow);
                    });
                });
            }

            window.addEventListener("resize", queueWalletViewOverflowUpdate);

            function showBeneficiaryView(name, initials, balance, balanceEmpty) {
                if (!walletModal || !walletViewBeneficiary || !walletViewList) return;
                currentBeneficiaryName = name || "";
                currentBeneficiaryInitials = initials || "";
                var wasWithdrawFlow = walletModal.classList.contains("pp-wallet-modal--withdraw-select-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-form-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-confirm-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-completed-view");
                walletModal.classList.remove("pp-wallet-modal--address-detail-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-select-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view-direct");
                walletModal.classList.remove("pp-wallet-modal--withdraw-confirm-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-completed-view");
                walletModal.classList.remove("pp-wallet-modal--export-key-view");
                walletModal.classList.add("pp-wallet-modal--beneficiary-view");
                if (walletModalDialog) walletModalDialog.classList.add("pp-wallet-modal__dialog--deeper");
                walletModalBack && walletModalBack.classList.remove("pp-wallet-modal__back--hidden");
                if (walletHeaderIconWrap) walletHeaderIconWrap.classList.add("pp-wallet-modal__header-icon-wrap--hidden");
                if (walletHeaderWithdrawWrap) {
                    walletHeaderWithdrawWrap.classList.add("pp-wallet-modal__header-withdraw-wrap--hidden");
                    walletHeaderWithdrawWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderExportKeyWrap) {
                    walletHeaderExportKeyWrap.classList.add("pp-wallet-modal__header-export-key-wrap--hidden");
                    walletHeaderExportKeyWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderAddressDetailWrap) {
                    walletHeaderAddressDetailWrap.classList.add("pp-wallet-modal__header-address-detail-wrap--hidden");
                    walletHeaderAddressDetailWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderAvatarWrap) {
                    walletHeaderAvatarWrap.classList.remove("pp-wallet-modal__header-avatar-wrap--hidden");
                    walletHeaderAvatarWrap.removeAttribute("aria-hidden");
                }
                if (walletModalHeaderAvatar) walletModalHeaderAvatar.textContent = initials || "?";
                if (walletModalHeaderLabel) walletModalHeaderLabel.textContent = "Beneficiary";
                if (walletModalTitle) walletModalTitle.textContent = name || "";
                if (walletBeneficiaryDetailBalance && balance != null) {
                    walletBeneficiaryDetailBalance.textContent = balance;
                    if (balanceEmpty) {
                        walletBeneficiaryDetailBalance.classList.add("pp-wallet-modal__item-balance--empty");
                    } else {
                        walletBeneficiaryDetailBalance.classList.remove("pp-wallet-modal__item-balance--empty");
                    }
                }
                var beneficiaryNetworkAddress = document.getElementById("walletBeneficiaryNetworkAddress");
                if (beneficiaryNetworkAddress) {
                    var isNovaQuill = (name || "").trim() === "NovaQuill Ltd";
                    var shortAddr = isNovaQuill ? "0x7a8b...5a6b" : "0x2134...1233f8";
                    beneficiaryNetworkAddress.textContent = shortAddr;
                }
                walletViewList.setAttribute("aria-hidden", "true");
                walletViewBeneficiary.removeAttribute("aria-hidden");
                if (walletViewAddressDetail) walletViewAddressDetail.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawSelect) walletViewWithdrawSelect.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawForm) walletViewWithdrawForm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawConfirm) walletViewWithdrawConfirm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawCompleted) walletViewWithdrawCompleted.setAttribute("aria-hidden", "true");
                if (walletViewExportKey) walletViewExportKey.setAttribute("aria-hidden", "true");
                if (walletViewSaveKey) walletViewSaveKey.setAttribute("aria-hidden", "true");
                if (wasWithdrawFlow) triggerWalletFooterFadeIn();
                walletModal.classList.add("pp-wallet-modal--header-from-right");
                setTimeout(function () { walletModal.classList.remove("pp-wallet-modal--header-from-right"); }, 250);
                queueWalletViewOverflowUpdate();
            }

            var walletAddressDetailBalance = document.getElementById("walletAddressDetailBalance");

            function isPaylynkErc20Activated(coin) {
                if (typeof window.PaylynkPrototype?.isPaylynkErc20Activated === "function") {
                    return window.PaylynkPrototype.isPaylynkErc20Activated(coin);
                }
                try {
                    var key = coin === "usdc"
                        ? "xrex.paylynk.prototype.usdcErc20Activated.v1"
                        : "xrex.paylynk.prototype.usdtErc20Activated.v1";
                    return window.localStorage?.getItem(key) === "1";
                } catch (_) {
                    return false;
                }
            }

            function syncAddressDetailStablecoinAssets(beneficiaryName) {
                var assetsList = document.getElementById("walletAddressDetailAssetsList");
                var assetsEmpty = document.getElementById("walletAddressDetailAssetsEmpty");
                if (!assetsList) return;
                var isNovaQuill = (beneficiaryName || "").trim() === "NovaQuill Ltd";
                var usdtItem = assetsList.querySelector('[data-wallet-address-asset="usdt"]');
                var usdcItem = assetsList.querySelector('[data-wallet-address-asset="usdc"]');
                if (isNovaQuill) {
                    if (usdtItem) usdtItem.setAttribute("hidden", "");
                    if (usdcItem) usdcItem.setAttribute("hidden", "");
                } else {
                    if (usdtItem) {
                        if (isPaylynkErc20Activated("usdt")) usdtItem.removeAttribute("hidden");
                        else usdtItem.setAttribute("hidden", "");
                    }
                    if (usdcItem) {
                        if (isPaylynkErc20Activated("usdc")) usdcItem.removeAttribute("hidden");
                        else usdcItem.setAttribute("hidden", "");
                    }
                }
                var hasVisibleStablecoin =
                    !isNovaQuill &&
                    ((usdtItem && !usdtItem.hasAttribute("hidden")) || (usdcItem && !usdcItem.hasAttribute("hidden")));
                assetsList.hidden = !hasVisibleStablecoin;
                if (assetsEmpty) {
                    assetsEmpty.hidden = hasVisibleStablecoin;
                    assetsEmpty.setAttribute("aria-hidden", hasVisibleStablecoin ? "true" : "false");
                }
            }

            function syncWithdrawSelectAssets() {
                if (!walletViewWithdrawSelect) return;
                var list = walletViewWithdrawSelect.querySelector(".pp-wallet-modal__list");
                if (!list) return;
                var usdtItem = list.querySelector('[data-wallet-withdraw-asset="usdt"]');
                var usdcItem = list.querySelector('[data-wallet-withdraw-asset="usdc"]');
                var ethItem = list.querySelector('[data-wallet-withdraw-asset="eth"]');
                if (usdtItem) {
                    if (isPaylynkErc20Activated("usdt")) usdtItem.removeAttribute("hidden");
                    else usdtItem.setAttribute("hidden", "");
                }
                if (usdcItem) {
                    if (isPaylynkErc20Activated("usdc")) usdcItem.removeAttribute("hidden");
                    else usdcItem.setAttribute("hidden", "");
                }
                if (ethItem) ethItem.setAttribute("hidden", "");
            }

            function triggerWalletFooterFadeIn() {
                if (!walletModal) return;
                walletModal.classList.remove("pp-wallet-modal--footer-fade-in");
                void walletModal.offsetHeight;
                walletModal.classList.add("pp-wallet-modal--footer-fade-in");
                clearTimeout(walletModal._footerFadeInTimer);
                walletModal._footerFadeInTimer = setTimeout(function () {
                    walletModal.classList.remove("pp-wallet-modal--footer-fade-in");
                }, 220);
            }

            function showAddressDetailView(beneficiaryName, beneficiaryInitials, networkName) {
                if (!walletModal || !walletViewAddressDetail || !walletViewBeneficiary) return;
                currentNetworkName = networkName || "";
                var wasWithdrawFlow = walletModal.classList.contains("pp-wallet-modal--withdraw-select-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-form-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-confirm-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-completed-view");
                walletModal.classList.remove("pp-wallet-modal--wallet-account-view");
                walletModal.classList.add("pp-wallet-modal--beneficiary-view");
                walletModal.classList.add("pp-wallet-modal--address-detail-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-select-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view-direct");
                walletModal.classList.remove("pp-wallet-modal--withdraw-confirm-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-completed-view");
                walletModal.classList.remove("pp-wallet-modal--export-key-view");
                walletModal.classList.remove("pp-wallet-modal--save-key-view");
                if (walletViewSaveKey) walletViewSaveKey.setAttribute("aria-hidden", "true");
                if (walletModalDialog) walletModalDialog.classList.add("pp-wallet-modal__dialog--deeper");
                walletModalBack && walletModalBack.classList.remove("pp-wallet-modal__back--hidden");
                if (walletHeaderIconWrap) walletHeaderIconWrap.classList.add("pp-wallet-modal__header-icon-wrap--hidden");
                if (walletHeaderAvatarWrap) {
                    walletHeaderAvatarWrap.classList.add("pp-wallet-modal__header-avatar-wrap--hidden");
                    walletHeaderAvatarWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderWithdrawWrap) {
                    walletHeaderWithdrawWrap.classList.add("pp-wallet-modal__header-withdraw-wrap--hidden");
                    walletHeaderWithdrawWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderAddressDetailWrap) {
                    walletHeaderAddressDetailWrap.classList.remove("pp-wallet-modal__header-address-detail-wrap--hidden");
                    walletHeaderAddressDetailWrap.removeAttribute("aria-hidden");
                }
                if (walletHeaderExportKeyWrap) {
                    walletHeaderExportKeyWrap.classList.add("pp-wallet-modal__header-export-key-wrap--hidden");
                    walletHeaderExportKeyWrap.setAttribute("aria-hidden", "true");
                }
                if (walletModalHeaderLabel) walletModalHeaderLabel.textContent = beneficiaryName || "";
                if (walletModalTitle) walletModalTitle.textContent = networkName || "";
                if (walletAddressDetailBalance) {
                    walletAddressDetailBalance.textContent = "$0.00";
                    walletAddressDetailBalance.classList.add("pp-wallet-modal__balance-amount--empty");
                }
                syncAddressDetailStablecoinAssets(beneficiaryName);
                var addressValueRow = walletModal.querySelector(".pp-wallet-modal__address-value-row");
                var addressValueEl = document.getElementById("walletAddressDetailValue");
                var activityLink = document.getElementById("walletAddressDetailActivityLink");
                if (addressValueRow || addressValueEl || activityLink) {
                    var isNovaQuillAddr = (beneficiaryName || "").trim() === "NovaQuill Ltd";
                    var fullAddr = isNovaQuillAddr ? "0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b" : "0x21341234123412341234123412341233f8";
                    var shortAddr = fullAddr.slice(0, 6) + "..." + fullAddr.slice(-6);
                    if (addressValueRow) addressValueRow.setAttribute("data-copy-value", fullAddr);
                    if (addressValueEl) addressValueEl.textContent = shortAddr;
                    if (activityLink) activityLink.href = "https://etherscan.io/address/" + encodeURIComponent(fullAddr);
                }
                walletViewList.setAttribute("aria-hidden", "true");
                walletViewBeneficiary.setAttribute("aria-hidden", "true");
                walletViewAddressDetail.removeAttribute("aria-hidden");
                if (walletViewWithdrawSelect) walletViewWithdrawSelect.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawForm) walletViewWithdrawForm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawConfirm) walletViewWithdrawConfirm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawCompleted) walletViewWithdrawCompleted.setAttribute("aria-hidden", "true");
                if (walletViewExportKey) walletViewExportKey.setAttribute("aria-hidden", "true");
                if (walletViewSaveKey) walletViewSaveKey.setAttribute("aria-hidden", "true");
                if (wasWithdrawFlow) triggerWalletFooterFadeIn();
                walletModal.classList.add("pp-wallet-modal--header-from-right");
                setTimeout(function () { walletModal.classList.remove("pp-wallet-modal--header-from-right"); }, 250);
                queueWalletViewOverflowUpdate();
            }

            function showExportPrivateKeyView() {
                if (!walletModal || !walletViewExportKey || !walletViewAddressDetail) return;
                walletModal.classList.remove("pp-wallet-modal--wallet-account-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-select-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view-direct");
                walletModal.classList.remove("pp-wallet-modal--withdraw-confirm-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-completed-view");
                walletModal.classList.add("pp-wallet-modal--export-key-view");
                if (walletHeaderIconWrap) walletHeaderIconWrap.classList.add("pp-wallet-modal__header-icon-wrap--hidden");
                if (walletHeaderAvatarWrap) {
                    walletHeaderAvatarWrap.classList.add("pp-wallet-modal__header-avatar-wrap--hidden");
                    walletHeaderAvatarWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderAddressDetailWrap) {
                    walletHeaderAddressDetailWrap.classList.add("pp-wallet-modal__header-address-detail-wrap--hidden");
                    walletHeaderAddressDetailWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderWithdrawWrap) {
                    walletHeaderWithdrawWrap.classList.add("pp-wallet-modal__header-withdraw-wrap--hidden");
                    walletHeaderWithdrawWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderExportKeyWrap) {
                    walletHeaderExportKeyWrap.classList.remove("pp-wallet-modal__header-export-key-wrap--hidden");
                    walletHeaderExportKeyWrap.removeAttribute("aria-hidden");
                }
                if (walletModalHeaderLabel) walletModalHeaderLabel.textContent = "";
                if (walletModalTitle) walletModalTitle.textContent = "Export private key";
                var introBeneficiaryEl = document.getElementById("walletExportIntroBeneficiary");
                if (introBeneficiaryEl) introBeneficiaryEl.textContent = currentBeneficiaryName || "AGP Technology";
                var introAddressEl = document.getElementById("walletExportIntroAddress");
                var addressValueEl = document.getElementById("walletAddressDetailValue");
                var exportAddressEl = document.getElementById("walletExportKeyAddress");
                if (exportAddressEl && addressValueEl) exportAddressEl.textContent = addressValueEl.textContent || "0x2134...1233f8";
                if (introAddressEl && addressValueEl) introAddressEl.textContent = addressValueEl.textContent || "0x2134...1233f8";
                var introNetworkEl = document.getElementById("walletExportIntroNetwork");
                var exportCopyBtn = document.getElementById("walletExportKeyAddressCopy");
                var addressRow = walletModal && walletModal.querySelector(".pp-wallet-modal__address-value-row");
                if (exportCopyBtn && addressRow) exportCopyBtn.setAttribute("data-copy-value", addressRow.getAttribute("data-copy-value") || "");
                var exportNetworkEl = document.getElementById("walletExportKeyNetwork");
                if (exportNetworkEl) exportNetworkEl.textContent = currentNetworkName || "Ethereum (ERC-20)";
                var exportBeneficiaryEl = document.getElementById("walletExportKeyBeneficiary");
                if (exportBeneficiaryEl) exportBeneficiaryEl.textContent = currentBeneficiaryName || "AGP Technology";
                if (introNetworkEl) introNetworkEl.textContent = currentNetworkName || "Ethereum (ERC-20)";
                var consentCheckbox = document.getElementById("walletExportKeyConsent");
                var revealBtn = document.getElementById("walletExportKeyRevealBtn");
                if (consentCheckbox) {
                    consentCheckbox.checked = false;
                }
                if (revealBtn) {
                    revealBtn.disabled = true;
                    revealBtn.classList.add("ew-btn--disabled");
                }
                if (walletViewList) walletViewList.setAttribute("aria-hidden", "true");
                if (walletViewBeneficiary) walletViewBeneficiary.setAttribute("aria-hidden", "true");
                if (walletViewAddressDetail) walletViewAddressDetail.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawSelect) walletViewWithdrawSelect.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawForm) walletViewWithdrawForm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawConfirm) walletViewWithdrawConfirm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawCompleted) walletViewWithdrawCompleted.setAttribute("aria-hidden", "true");
                if (walletViewSaveKey) walletViewSaveKey.setAttribute("aria-hidden", "true");
                walletModal.classList.remove("pp-wallet-modal--save-key-view");
                walletViewExportKey.removeAttribute("aria-hidden");
                exportKeyFlowSkippedExplanation = false;
                setExportKeyFlowStep("intro", true);
                if (walletModalBack) walletModalBack.classList.remove("pp-wallet-modal__back--hidden");
                walletModal.classList.add("pp-wallet-modal--header-from-right");
                setTimeout(function () { walletModal.classList.remove("pp-wallet-modal--header-from-right"); }, 250);
                queueWalletViewOverflowUpdate();
            }

            function goBackFromExportKeyToAddressDetail() {
                if (!walletModal) return;
                walletModal.classList.add("pp-wallet-modal--from-export-key");
                var onTransitionEndFromExport = function (e) {
                    if (e.target && e.target.classList && e.target.classList.contains("pp-wallet-modal__view") && e.propertyName === "transform") {
                        walletModal.removeEventListener("transitionend", onTransitionEndFromExport);
                        walletModal.classList.remove("pp-wallet-modal--from-export-key");
                    }
                };
                walletModal.addEventListener("transitionend", onTransitionEndFromExport);
                requestAnimationFrame(function () {
                    showAddressDetailView(currentBeneficiaryName, currentBeneficiaryInitials, currentNetworkName || "Ethereum (ERC-20)");
                });
            }

            function setExportKeyFlowStep(step, immediate) {
                var pages = {
                    intro: document.getElementById("walletExportKeyPageIntro"),
                    risk1: document.getElementById("walletExportKeyPageRisk1"),
                    risk2: document.getElementById("walletExportKeyPageRisk2"),
                    risk3: document.getElementById("walletExportKeyPageRisk3"),
                    confirm: document.getElementById("walletExportKeyPageConfirm")
                };
                var order = ["intro", "risk1", "risk2", "risk3", "confirm"];
                var target = pages[step] ? step : "intro";
                var current = pages[currentExportFlowStep] ? currentExportFlowStep : target;
                var currentPage = pages[current];
                var targetPage = pages[target];
                if (!targetPage) return;
                if (target === current && !immediate) return;

                if (exportFlowTransitionTimer) {
                    clearTimeout(exportFlowTransitionTimer);
                    exportFlowTransitionTimer = null;
                }

                Object.keys(pages).forEach(function (key) {
                    var page = pages[key];
                    if (!page) return;
                    page.classList.remove("is-enter-right", "is-enter-left", "is-exit-left", "is-exit-right", "is-active");
                    if (key !== current && key !== target) page.setAttribute("hidden", "");
                });

                if (immediate || !currentPage || current === target) {
                    Object.keys(pages).forEach(function (key) {
                        var page = pages[key];
                        if (!page) return;
                        if (key === target) {
                            page.removeAttribute("hidden");
                            page.classList.add("is-active");
                        } else {
                            page.setAttribute("hidden", "");
                        }
                    });
                    currentExportFlowStep = target;
                    if (target === "confirm") {
                        var consentEl = document.getElementById("walletExportKeyConsent");
                        var revealEl = document.getElementById("walletExportKeyRevealBtn");
                        if (consentEl) consentEl.checked = false;
                        if (revealEl) { revealEl.disabled = true; revealEl.classList.add("ew-btn--disabled"); }
                    }
                    if (typeof queueWalletViewOverflowUpdate === "function") queueWalletViewOverflowUpdate();
                    return;
                }

                var isForward = order.indexOf(target) >= order.indexOf(current);
                currentPage.removeAttribute("hidden");
                targetPage.removeAttribute("hidden");
                targetPage.classList.add(isForward ? "is-enter-right" : "is-enter-left");
                currentPage.classList.add("is-active");

                requestAnimationFrame(function () {
                    currentPage.classList.remove("is-active");
                    currentPage.classList.add(isForward ? "is-exit-left" : "is-exit-right");
                    targetPage.classList.add("is-active");
                    targetPage.classList.remove("is-enter-right", "is-enter-left");
                });

                exportFlowTransitionTimer = setTimeout(function () {
                    currentPage.classList.remove("is-exit-left", "is-exit-right", "is-active");
                    currentPage.setAttribute("hidden", "");
                    targetPage.classList.remove("is-enter-right", "is-enter-left");
                    targetPage.classList.add("is-active");
                    exportFlowTransitionTimer = null;
                    if (target === "confirm") {
                        var consentEl = document.getElementById("walletExportKeyConsent");
                        var revealEl = document.getElementById("walletExportKeyRevealBtn");
                        if (consentEl) consentEl.checked = false;
                        if (revealEl) { revealEl.disabled = true; revealEl.classList.add("ew-btn--disabled"); }
                    }
                    if (typeof queueWalletViewOverflowUpdate === "function") queueWalletViewOverflowUpdate();
                }, 300);

                currentExportFlowStep = target;
            }

            function showWithdrawFormView(assetName, entryPoint) {
                if (!walletModal || !walletViewWithdrawForm) return;
                var addressInput = document.getElementById("walletWithdrawAddress");
                var amountInput = document.getElementById("walletWithdrawAmount");
                if (addressInput) { addressInput.value = ""; if (typeof resizeWithdrawAddressTextarea === "function") resizeWithdrawAddressTextarea(); if (typeof updateWithdrawAddressClearVisibility === "function") updateWithdrawAddressClearVisibility(); }
                if (amountInput) amountInput.value = "";
                var addressHint = document.getElementById("walletWithdrawAddressHint");
                var addressHintText = document.getElementById("walletWithdrawAddressHintText");
                var addressHintCheck = document.getElementById("walletWithdrawAddressHintCheck");
                if (addressHint && addressHintText && addressHintCheck) {
                    addressHintText.textContent = "Must be an Ethereum (ERC-20) address";
                    addressHint.classList.remove("pp-wallet-withdraw-form__hint--address-pasted");
                    addressHintCheck.setAttribute("aria-hidden", "true");
                }
                currentWithdrawAsset = (assetName || "USDT").trim();
                currentWithdrawEntryPoint = entryPoint === "address-detail" ? "address-detail" : "select-asset";
                var currencyEl = document.getElementById("walletWithdrawCurrency");
                var availableEl = document.getElementById("walletWithdrawAvailable");
                if (currencyEl) currencyEl.textContent = currentWithdrawAsset;
                if (availableEl) {
                    if (currentWithdrawAsset === "ETH") availableEl.textContent = "0.05 ETH";
                    else if (currentWithdrawAsset === "USDC") availableEl.textContent = "32.41 USDC";
                    else availableEl.textContent = "32.41 USDT";
                }
                if (typeof updateWithdrawReviewButton === "function") updateWithdrawReviewButton();
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view-direct");
                if (currentWithdrawEntryPoint === "address-detail") {
                    walletModal.classList.add("pp-wallet-modal--withdraw-form-view-direct");
                }
                walletModal.classList.remove("pp-wallet-modal--withdraw-completed-view");
                walletModal.classList.add("pp-wallet-modal--withdraw-form-view");
                // Ensure Withdraw icon is shown in header (not Address detail)
                if (walletHeaderIconWrap) walletHeaderIconWrap.classList.add("pp-wallet-modal__header-icon-wrap--hidden");
                if (walletHeaderAvatarWrap) {
                    walletHeaderAvatarWrap.classList.add("pp-wallet-modal__header-avatar-wrap--hidden");
                    walletHeaderAvatarWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderAddressDetailWrap) {
                    walletHeaderAddressDetailWrap.classList.add("pp-wallet-modal__header-address-detail-wrap--hidden");
                    walletHeaderAddressDetailWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderWithdrawWrap) {
                    walletHeaderWithdrawWrap.classList.remove("pp-wallet-modal__header-withdraw-wrap--hidden");
                    walletHeaderWithdrawWrap.removeAttribute("aria-hidden");
                }
                if (walletModalHeaderLabel) walletModalHeaderLabel.textContent = "Withdraw";
                if (walletModalTitle) walletModalTitle.textContent = "Withdraw " + currentWithdrawAsset;
                if (walletViewWithdrawSelect) walletViewWithdrawSelect.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawConfirm) walletViewWithdrawConfirm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawCompleted) walletViewWithdrawCompleted.setAttribute("aria-hidden", "true");
                if (walletViewExportKey) walletViewExportKey.setAttribute("aria-hidden", "true");
                if (walletViewSaveKey) walletViewSaveKey.setAttribute("aria-hidden", "true");
                walletViewWithdrawForm.removeAttribute("aria-hidden");
                walletModal.classList.add("pp-wallet-modal--header-from-right");
                setTimeout(function () { walletModal.classList.remove("pp-wallet-modal--header-from-right"); }, 250);
                queueWalletViewOverflowUpdate();
            }

            function showWithdrawConfirmView() {
                var addressInput = document.getElementById("walletWithdrawAddress");
                var amountInput = document.getElementById("walletWithdrawAmount");
                var toAddr = (addressInput && addressInput.value) ? addressInput.value.trim() : "";
                var amount = (amountInput && amountInput.value) ? amountInput.value.trim() : "";
                var asset = currentWithdrawAsset || "USDT";
                var amountLabel = amount && asset ? amount + " " + asset : (asset === "ETH" ? "0.05 ETH" : "32.41 USDT");
                var assetIcon = document.getElementById("walletConfirmAssetIcon");
                if (assetIcon && assetIcon.querySelector("img")) {
                    var iconSrc = "assets/icon-ew-currency-USDT.svg";
                    if (asset === "ETH") iconSrc = "assets/icon-ew-currency-ETH.svg";
                    else if (asset === "USDC") iconSrc = "assets/icon_usdc.svg";
                    assetIcon.querySelector("img").src = iconSrc;
                }
                var confirmAmount = document.getElementById("walletConfirmAmount");
                if (confirmAmount) confirmAmount.textContent = amountLabel;
                var confirmToAddr = document.getElementById("walletConfirmToAddress");
                if (confirmToAddr) confirmToAddr.textContent = toAddr || "0x742d35Cc6634C0532925a3b80532925a3b844Bc454e4438f44e";
                var fromAddr = (currentBeneficiaryName || "").trim() === "NovaQuill Ltd" ? "0x7a8b...5a6b" : "0x2134...1233f8";
                var confirmFrom = document.getElementById("walletConfirmFromAddress");
                if (confirmFrom) confirmFrom.textContent = fromAddr;
                var confirmNetwork = document.getElementById("walletConfirmNetwork");
                if (confirmNetwork) confirmNetwork.textContent = currentNetworkName || "Ethereum (ERC-20)";
                if (walletModal && walletViewWithdrawConfirm) {
                    hideWithdrawProcessingModal();
                    walletModal.classList.add("pp-wallet-modal--withdraw-form-view");
                    if (currentWithdrawEntryPoint === "address-detail") {
                        walletModal.classList.add("pp-wallet-modal--withdraw-form-view-direct");
                    } else {
                        walletModal.classList.remove("pp-wallet-modal--withdraw-form-view-direct");
                    }
                    walletModal.classList.remove("pp-wallet-modal--withdraw-completed-view");
                    walletModal.classList.add("pp-wallet-modal--withdraw-confirm-view");
                    if (walletModalTitle) walletModalTitle.textContent = "Confirm withdrawal";
                    walletViewWithdrawForm.setAttribute("aria-hidden", "true");
                    if (walletViewWithdrawCompleted) walletViewWithdrawCompleted.setAttribute("aria-hidden", "true");
                    if (walletViewExportKey) walletViewExportKey.setAttribute("aria-hidden", "true");
                if (walletViewSaveKey) walletViewSaveKey.setAttribute("aria-hidden", "true");
                    walletViewWithdrawConfirm.removeAttribute("aria-hidden");
                    if (walletModalBack) walletModalBack.classList.remove("pp-wallet-modal__back--hidden");
                    walletModal.classList.add("pp-wallet-modal--header-from-right");
                    setTimeout(function () { walletModal.classList.remove("pp-wallet-modal--header-from-right"); }, 250);
                    queueWalletViewOverflowUpdate();
                }
            }

            function showWithdrawProcessingModal() {
                if (walletWithdrawProcessingModal) walletWithdrawProcessingModal.setAttribute("aria-hidden", "false");
            }

            function showSaveKeyView() {
                if (!walletModal || !walletViewSaveKey) return;
                walletModal.classList.remove("pp-wallet-modal--wallet-account-view");
                walletModal.classList.remove("pp-wallet-modal--export-key-view");
                walletModal.classList.add("pp-wallet-modal--save-key-view");
                if (walletModalHeaderLabel) walletModalHeaderLabel.textContent = "";
                if (walletModalTitle) walletModalTitle.textContent = "Save your private key";
                var pkEl = document.getElementById("walletSaveKeyPrivateKeyValue");
                if (pkEl) pkEl.textContent = currentExportPrivateKey || "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce036f9f8f6d8c1a5b7c9d2";
                var saveKeyAddressEl = document.getElementById("walletSaveKeyAddress");
                var addressValueEl = document.getElementById("walletAddressDetailValue");
                if (saveKeyAddressEl && addressValueEl) saveKeyAddressEl.textContent = addressValueEl.textContent || "0x2134...1233f8";
                var saveKeyAddressCopyBtn = document.getElementById("walletSaveKeyAddressCopy");
                var addressRow = walletModal && walletModal.querySelector(".pp-wallet-modal__address-value-row");
                if (saveKeyAddressCopyBtn && addressRow) saveKeyAddressCopyBtn.setAttribute("data-copy-value", addressRow.getAttribute("data-copy-value") || "");
                var saveKeyNetworkEl = document.getElementById("walletSaveKeyNetwork");
                if (saveKeyNetworkEl) saveKeyNetworkEl.textContent = currentNetworkName || "Ethereum (ERC-20)";
                var saveKeyConsent = document.getElementById("walletSaveKeyConsent");
                var saveKeyDoneBtn = document.getElementById("walletSaveKeyDoneBtn");
                if (saveKeyConsent) saveKeyConsent.checked = false;
                if (saveKeyDoneBtn) {
                    saveKeyDoneBtn.disabled = true;
                    saveKeyDoneBtn.classList.add("ew-btn--disabled");
                }
                if (walletViewExportKey) walletViewExportKey.setAttribute("aria-hidden", "true");
                walletViewSaveKey.removeAttribute("aria-hidden");
                walletModal.classList.add("pp-wallet-modal--header-from-right");
                setTimeout(function () { walletModal.classList.remove("pp-wallet-modal--header-from-right"); }, 250);
                if (typeof queueWalletViewOverflowUpdate === "function") queueWalletViewOverflowUpdate();
            }

            function hideWithdrawProcessingModal() {
                if (walletWithdrawProcessingModal) walletWithdrawProcessingModal.setAttribute("aria-hidden", "true");
            }

            function showWithdrawCompletedView() {
                if (!walletModal || !walletViewWithdrawCompleted) return;
                walletModal.classList.remove("pp-wallet-modal--beneficiary-view");
                walletModal.classList.remove("pp-wallet-modal--address-detail-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-select-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view-direct");
                walletModal.classList.remove("pp-wallet-modal--withdraw-confirm-view");
                walletModal.classList.add("pp-wallet-modal--withdraw-completed-view");
                if (walletModalTitle) walletModalTitle.textContent = "Withdrawal submitted";
                if (walletViewList) walletViewList.setAttribute("aria-hidden", "true");
                if (walletViewBeneficiary) walletViewBeneficiary.setAttribute("aria-hidden", "true");
                if (walletViewAddressDetail) walletViewAddressDetail.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawSelect) walletViewWithdrawSelect.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawConfirm) walletViewWithdrawConfirm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawForm) walletViewWithdrawForm.setAttribute("aria-hidden", "true");
                if (walletViewExportKey) walletViewExportKey.setAttribute("aria-hidden", "true");
                if (walletViewSaveKey) walletViewSaveKey.setAttribute("aria-hidden", "true");
                walletViewWithdrawCompleted.removeAttribute("aria-hidden");
                if (walletModalBack) walletModalBack.classList.add("pp-wallet-modal__back--hidden");
                walletModal.classList.add("pp-wallet-modal--header-from-right");
                setTimeout(function () { walletModal.classList.remove("pp-wallet-modal--header-from-right"); }, 250);
                queueWalletViewOverflowUpdate();
            }

            function hideWithdrawConfirmView() {
                if (!walletModal || !walletViewWithdrawConfirm || !walletViewWithdrawForm) return;
                hideWithdrawProcessingModal();
                walletModal.classList.remove("pp-wallet-modal--withdraw-confirm-view");
                walletViewWithdrawConfirm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawCompleted) walletViewWithdrawCompleted.setAttribute("aria-hidden", "true");
                if (walletViewExportKey) walletViewExportKey.setAttribute("aria-hidden", "true");
                if (walletViewSaveKey) walletViewSaveKey.setAttribute("aria-hidden", "true");
                walletViewWithdrawForm.removeAttribute("aria-hidden");
                if (walletModalTitle) walletModalTitle.textContent = "Withdraw " + (currentWithdrawAsset || "USDT");
                walletModal.classList.add("pp-wallet-modal--header-from-left");
                setTimeout(function () { walletModal.classList.remove("pp-wallet-modal--header-from-left"); }, 250);
                queueWalletViewOverflowUpdate();
            }

            // Debug: open wallet → show loader (3s) → Withdrawal submitted page (same as real flow, for styling)
            function openWalletToProcessingThenCompletedView() {
                openWalletDirect();
                currentBeneficiaryName = currentBeneficiaryName || "Acme Corp";
                currentBeneficiaryInitials = currentBeneficiaryInitials || "AC";
                currentNetworkName = currentNetworkName || "Ethereum (ERC-20)";
                var confirmAmount = document.getElementById("walletConfirmAmount");
                var confirmToAddr = document.getElementById("walletConfirmToAddress");
                var confirmFrom = document.getElementById("walletConfirmFromAddress");
                var confirmNetwork = document.getElementById("walletConfirmNetwork");
                var confirmGas = document.getElementById("walletConfirmGasFee");
                var assetIconEl = document.getElementById("walletConfirmAssetIcon");
                if (confirmAmount) confirmAmount.textContent = "32.41 USDT";
                if (confirmToAddr) confirmToAddr.textContent = "0x742d35Cc6634C0532925a3b80532925a3b844Bc454e4438f44e";
                if (confirmFrom) confirmFrom.textContent = "0x2134...1233f8";
                if (confirmNetwork) confirmNetwork.textContent = "Ethereum (ERC-20)";
                if (confirmGas) confirmGas.textContent = "0.02 ETH";
                if (assetIconEl && assetIconEl.querySelector("img")) assetIconEl.querySelector("img").src = "assets/icon-ew-currency-USDT.svg";
                if (walletProcessingModalLabel) walletProcessingModalLabel.textContent = "Submitting";
                showWithdrawProcessingModal();
                setTimeout(function () {
                    var amountEl = document.getElementById("walletConfirmAmount");
                    var toAddrEl = document.getElementById("walletConfirmToAddress");
                    var fromEl = document.getElementById("walletConfirmFromAddress");
                    var networkEl = document.getElementById("walletConfirmNetwork");
                    var gasEl = document.getElementById("walletConfirmGasFee");
                    var assetIconSrc = document.getElementById("walletConfirmAssetIcon");
                    var completedAmount = document.getElementById("walletCompletedAmount");
                    var completedToAddr = document.getElementById("walletCompletedToAddress");
                    var completedFrom = document.getElementById("walletCompletedFromAddress");
                    var completedNetwork = document.getElementById("walletCompletedNetwork");
                    var completedGas = document.getElementById("walletCompletedGasFee");
                    var completedAssetIcon = document.getElementById("walletCompletedAssetIcon");
                    if (completedAmount && amountEl) completedAmount.textContent = amountEl.textContent || "32.41 USDT";
                    if (completedToAddr && toAddrEl) completedToAddr.textContent = toAddrEl.textContent || "";
                    if (completedFrom && fromEl) completedFrom.textContent = fromEl.textContent || "0x2134...1233f8";
                    if (completedNetwork && networkEl) completedNetwork.textContent = networkEl.textContent || "Ethereum (ERC-20)";
                    if (completedGas && gasEl) completedGas.textContent = gasEl.textContent || "0.02 ETH";
                    if (completedAssetIcon && assetIconSrc) {
                        var img = completedAssetIcon.querySelector("img");
                        var srcImg = assetIconSrc.querySelector("img");
                        if (img && srcImg && srcImg.src) img.src = srcImg.src;
                    }
                    hideWithdrawProcessingModal();
                    showWithdrawCompletedView();
                }, 3000);
            }

            // Debug: open wallet and jump straight to Confirm withdrawal view (for styling)
            function openWalletToConfirmView() {
                openWalletDirect();
                if (!walletModal || !walletViewWithdrawConfirm) return;
                var confirmAmount = document.getElementById("walletConfirmAmount");
                var confirmToAddr = document.getElementById("walletConfirmToAddress");
                var confirmFrom = document.getElementById("walletConfirmFromAddress");
                var confirmNetwork = document.getElementById("walletConfirmNetwork");
                var assetIcon = document.getElementById("walletConfirmAssetIcon");
                if (confirmAmount) confirmAmount.textContent = "32.41 USDT";
                if (confirmToAddr) confirmToAddr.textContent = "0x742d35Cc6634C0532925a3b80532925a3b844Bc454e4438f44e";
                if (confirmFrom) confirmFrom.textContent = "0x2134...1233f8";
                if (confirmNetwork) confirmNetwork.textContent = "Ethereum (ERC-20)";
                if (assetIcon && assetIcon.querySelector("img")) assetIcon.querySelector("img").src = "assets/icon-ew-currency-USDT.svg";
                hideWithdrawProcessingModal();
                walletModal.classList.add("pp-wallet-modal--withdraw-form-view", "pp-wallet-modal--withdraw-form-view-direct", "pp-wallet-modal--withdraw-confirm-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-completed-view");
                if (walletHeaderIconWrap) walletHeaderIconWrap.classList.add("pp-wallet-modal__header-icon-wrap--hidden");
                if (walletHeaderAvatarWrap) {
                    walletHeaderAvatarWrap.classList.add("pp-wallet-modal__header-avatar-wrap--hidden");
                    walletHeaderAvatarWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderAddressDetailWrap) {
                    walletHeaderAddressDetailWrap.classList.add("pp-wallet-modal__header-address-detail-wrap--hidden");
                    walletHeaderAddressDetailWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderWithdrawWrap) {
                    walletHeaderWithdrawWrap.classList.remove("pp-wallet-modal__header-withdraw-wrap--hidden");
                    walletHeaderWithdrawWrap.removeAttribute("aria-hidden");
                }
                if (walletModalHeaderLabel) walletModalHeaderLabel.textContent = "Withdraw";
                if (walletModalTitle) walletModalTitle.textContent = "Confirm withdrawal";
                if (walletViewList) walletViewList.setAttribute("aria-hidden", "true");
                if (walletViewBeneficiary) walletViewBeneficiary.setAttribute("aria-hidden", "true");
                if (walletViewAddressDetail) walletViewAddressDetail.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawSelect) walletViewWithdrawSelect.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawForm) walletViewWithdrawForm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawCompleted) walletViewWithdrawCompleted.setAttribute("aria-hidden", "true");
                walletViewWithdrawConfirm.removeAttribute("aria-hidden");
                if (walletModalBack) walletModalBack.classList.remove("pp-wallet-modal__back--hidden");
                walletModal.classList.add("pp-wallet-modal--header-from-right");
                setTimeout(function () { walletModal.classList.remove("pp-wallet-modal--header-from-right"); }, 250);
                queueWalletViewOverflowUpdate();
            }

            // Temp: shortcut to jump directly to Export private key for easier styling
            function openWalletToExportKeyView() {
                openWalletDirect();
                currentBeneficiaryName = currentBeneficiaryName || "Acme Corp";
                currentBeneficiaryInitials = currentBeneficiaryInitials || "AC";
                currentNetworkName = currentNetworkName || "Ethereum (ERC-20)";
                requestAnimationFrame(function () {
                    showExportPrivateKeyView();
                });
            }
            var closeConfirmDebugHotspot = document.querySelector(".pp-wallet-close-confirm-debug-hotspot");
            if (closeConfirmDebugHotspot) {
                closeConfirmDebugHotspot.addEventListener("click", function () { openWalletToExportKeyView(); });
            }

            function showWithdrawSelectView() {
                if (!walletModal || !walletViewWithdrawSelect || !walletViewAddressDetail) return;
                walletModal.classList.remove("pp-wallet-modal--footer-fade-in");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view-direct");
                walletModal.classList.remove("pp-wallet-modal--withdraw-confirm-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-completed-view");
                walletModal.classList.add("pp-wallet-modal--withdraw-select-view");
                currentWithdrawEntryPoint = "select-asset";
                if (walletHeaderIconWrap) walletHeaderIconWrap.classList.add("pp-wallet-modal__header-icon-wrap--hidden");
                if (walletHeaderAvatarWrap) {
                    walletHeaderAvatarWrap.classList.add("pp-wallet-modal__header-avatar-wrap--hidden");
                    walletHeaderAvatarWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderAddressDetailWrap) {
                    walletHeaderAddressDetailWrap.classList.add("pp-wallet-modal__header-address-detail-wrap--hidden");
                    walletHeaderAddressDetailWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderWithdrawWrap) {
                    walletHeaderWithdrawWrap.classList.remove("pp-wallet-modal__header-withdraw-wrap--hidden");
                    walletHeaderWithdrawWrap.removeAttribute("aria-hidden");
                }
                if (walletModalHeaderLabel) walletModalHeaderLabel.textContent = "Withdraw";
                if (walletModalTitle) walletModalTitle.textContent = "Select asset";
                walletViewAddressDetail.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawForm) walletViewWithdrawForm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawConfirm) walletViewWithdrawConfirm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawCompleted) walletViewWithdrawCompleted.setAttribute("aria-hidden", "true");
                if (walletViewExportKey) walletViewExportKey.setAttribute("aria-hidden", "true");
                if (walletViewSaveKey) walletViewSaveKey.setAttribute("aria-hidden", "true");
                walletViewWithdrawSelect.removeAttribute("aria-hidden");
                syncWithdrawSelectAssets();
                walletModal.classList.add("pp-wallet-modal--header-from-right");
                setTimeout(function () { walletModal.classList.remove("pp-wallet-modal--header-from-right"); }, 250);
                queueWalletViewOverflowUpdate();
            }

            function showListView() {
                if (!walletModal || !walletViewBeneficiary || !walletViewList) return;
                var wasWithdrawFlow = walletModal.classList.contains("pp-wallet-modal--withdraw-select-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-form-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-confirm-view") || walletModal.classList.contains("pp-wallet-modal--withdraw-completed-view");
                walletModal.classList.remove("pp-wallet-modal--beneficiary-view");
                walletModal.classList.remove("pp-wallet-modal--address-detail-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-select-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view-direct");
                walletModal.classList.remove("pp-wallet-modal--withdraw-confirm-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-completed-view");
                walletModal.classList.remove("pp-wallet-modal--export-key-view");
                walletModal.classList.remove("pp-wallet-modal--save-key-view");
                walletModalBack && walletModalBack.classList.add("pp-wallet-modal__back--hidden");
                if (walletHeaderIconWrap) walletHeaderIconWrap.classList.remove("pp-wallet-modal__header-icon-wrap--hidden");
                if (walletHeaderAvatarWrap) {
                    walletHeaderAvatarWrap.classList.add("pp-wallet-modal__header-avatar-wrap--hidden");
                    walletHeaderAvatarWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderAddressDetailWrap) {
                    walletHeaderAddressDetailWrap.classList.add("pp-wallet-modal__header-address-detail-wrap--hidden");
                    walletHeaderAddressDetailWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderWithdrawWrap) {
                    walletHeaderWithdrawWrap.classList.add("pp-wallet-modal__header-withdraw-wrap--hidden");
                    walletHeaderWithdrawWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderExportKeyWrap) {
                    walletHeaderExportKeyWrap.classList.add("pp-wallet-modal__header-export-key-wrap--hidden");
                    walletHeaderExportKeyWrap.setAttribute("aria-hidden", "true");
                }
                if (walletModalHeaderLabel) walletModalHeaderLabel.textContent = WALLET_DEFAULT_LABEL;
                if (walletModalTitle) walletModalTitle.textContent = WALLET_DEFAULT_TITLE;
                walletViewList.removeAttribute("aria-hidden");
                walletViewBeneficiary.setAttribute("aria-hidden", "true");
                if (walletViewAddressDetail) walletViewAddressDetail.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawSelect) walletViewWithdrawSelect.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawForm) walletViewWithdrawForm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawConfirm) walletViewWithdrawConfirm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawCompleted) walletViewWithdrawCompleted.setAttribute("aria-hidden", "true");
                if (walletViewExportKey) walletViewExportKey.setAttribute("aria-hidden", "true");
                if (walletViewSaveKey) walletViewSaveKey.setAttribute("aria-hidden", "true");
                if (wasWithdrawFlow) triggerWalletFooterFadeIn();
                walletModal.classList.add("pp-wallet-modal--header-from-left");
                setTimeout(function () { walletModal.classList.remove("pp-wallet-modal--header-from-left"); }, 250);
                queueWalletViewOverflowUpdate();
            }

            function showListViewFromSaveKey() {
                if (!walletModal || !walletViewBeneficiary || !walletViewList) return;
                walletModal.classList.add("pp-wallet-modal--wallet-account-view");
                walletModal.classList.remove("pp-wallet-modal--beneficiary-view");
                walletModal.classList.remove("pp-wallet-modal--address-detail-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-select-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-form-view-direct");
                walletModal.classList.remove("pp-wallet-modal--withdraw-confirm-view");
                walletModal.classList.remove("pp-wallet-modal--withdraw-completed-view");
                walletModal.classList.remove("pp-wallet-modal--export-key-view");
                walletModal.classList.remove("pp-wallet-modal--save-key-view");
                walletModalBack && walletModalBack.classList.add("pp-wallet-modal__back--hidden");
                if (walletHeaderIconWrap) walletHeaderIconWrap.classList.remove("pp-wallet-modal__header-icon-wrap--hidden");
                if (walletHeaderAvatarWrap) {
                    walletHeaderAvatarWrap.classList.add("pp-wallet-modal__header-avatar-wrap--hidden");
                    walletHeaderAvatarWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderAddressDetailWrap) {
                    walletHeaderAddressDetailWrap.classList.add("pp-wallet-modal__header-address-detail-wrap--hidden");
                    walletHeaderAddressDetailWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderWithdrawWrap) {
                    walletHeaderWithdrawWrap.classList.add("pp-wallet-modal__header-withdraw-wrap--hidden");
                    walletHeaderWithdrawWrap.setAttribute("aria-hidden", "true");
                }
                if (walletHeaderExportKeyWrap) {
                    walletHeaderExportKeyWrap.classList.add("pp-wallet-modal__header-export-key-wrap--hidden");
                    walletHeaderExportKeyWrap.setAttribute("aria-hidden", "true");
                }
                if (walletModalHeaderLabel) walletModalHeaderLabel.textContent = WALLET_DEFAULT_LABEL;
                if (walletModalTitle) walletModalTitle.textContent = WALLET_DEFAULT_TITLE;
                walletViewList.removeAttribute("aria-hidden");
                walletViewBeneficiary.setAttribute("aria-hidden", "true");
                if (walletViewAddressDetail) walletViewAddressDetail.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawSelect) walletViewWithdrawSelect.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawForm) walletViewWithdrawForm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawConfirm) walletViewWithdrawConfirm.setAttribute("aria-hidden", "true");
                if (walletViewWithdrawCompleted) walletViewWithdrawCompleted.setAttribute("aria-hidden", "true");
                if (walletViewExportKey) walletViewExportKey.setAttribute("aria-hidden", "true");
                if (walletViewSaveKey) walletViewSaveKey.setAttribute("aria-hidden", "true");
                if (typeof triggerWalletFooterFadeIn === "function") triggerWalletFooterFadeIn();
                queueWalletViewOverflowUpdate();
            }

            function clearWalletTransitionOverlay() {
                if (!walletViews) return;
                var existingOverlay = walletViews.querySelector(".pp-wallet-modal__transition-overlay");
                if (existingOverlay && existingOverlay.parentNode) existingOverlay.parentNode.removeChild(existingOverlay);
            }

            function stripCloneIds(root) {
                if (!root || !root.querySelectorAll) return;
                if (root.removeAttribute) root.removeAttribute("id");
                var idNodes = root.querySelectorAll("[id]");
                for (var i = 0; i < idNodes.length; i++) {
                    idNodes[i].removeAttribute("id");
                }
            }

            function animateSaveKeyToListTransition() {
                if (!walletModal || !walletViews || !walletViewSaveKey || !walletViewList) {
                    showListViewFromSaveKey();
                    return;
                }
                clearWalletTransitionOverlay();
                walletModal.classList.remove("pp-wallet-modal--save-to-list");
                walletModal.classList.remove("pp-wallet-modal--wallet-account-view");
                walletModal.classList.remove("pp-wallet-modal--save-key-done");
                var overlay = document.createElement("div");
                // Reverse slide, same as back direction on withdraw flow
                overlay.className = "pp-wallet-modal__transition-overlay pp-wallet-modal__transition-overlay--reverse";
                var fromClone = walletViewSaveKey.cloneNode(true);
                var toClone = walletViewList.cloneNode(true);
                stripCloneIds(fromClone);
                stripCloneIds(toClone);
                fromClone.classList.add("pp-wallet-modal__transition-panel", "pp-wallet-modal__transition-panel--from");
                toClone.classList.add("pp-wallet-modal__transition-panel", "pp-wallet-modal__transition-panel--to");
                fromClone.setAttribute("aria-hidden", "true");
                toClone.setAttribute("aria-hidden", "true");
                fromClone.removeAttribute("hidden");
                toClone.removeAttribute("hidden");
                if (typeof walletViewSaveKey.scrollTop === "number") fromClone.scrollTop = walletViewSaveKey.scrollTop;
                if (typeof walletViewList.scrollTop === "number") toClone.scrollTop = walletViewList.scrollTop;
                overlay.appendChild(fromClone);
                overlay.appendChild(toClone);
                walletViews.appendChild(overlay);
                walletModal.classList.add("pp-wallet-modal--skip-view-animation");
                showListViewFromSaveKey();
                var finished = false;
                function cleanupTransition() {
                    if (finished) return;
                    finished = true;
                    overlay.removeEventListener("transitionend", onOverlayTransitionEnd);
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    walletModal.classList.remove("pp-wallet-modal--skip-view-animation");
                }
                function onOverlayTransitionEnd(e) {
                    if (e.target !== toClone || e.propertyName !== "transform") return;
                    cleanupTransition();
                }
                overlay.addEventListener("transitionend", onOverlayTransitionEnd);
                requestAnimationFrame(function () {
                    overlay.classList.add("pp-wallet-modal__transition-overlay--active");
                });
                setTimeout(cleanupTransition, 400);
            }

            function onWalletBackClick() {
                if (walletModal && walletModal.classList.contains("pp-wallet-modal--export-key-view")) {
                    if (currentExportFlowStep === "confirm") {
                        setExportKeyFlowStep(exportKeyFlowSkippedExplanation ? "intro" : "risk3");
                        return;
                    }
                    if (currentExportFlowStep === "risk3") {
                        setExportKeyFlowStep("risk2");
                        return;
                    }
                    if (currentExportFlowStep === "risk2") {
                        setExportKeyFlowStep("risk1");
                        return;
                    }
                    if (currentExportFlowStep === "risk1") {
                        setExportKeyFlowStep("intro");
                        return;
                    }
                    walletModal.classList.add("pp-wallet-modal--from-export-key");
                    var onTransitionEnd = function (e) {
                        if (e.target && e.target.classList && e.target.classList.contains("pp-wallet-modal__view") && e.propertyName === "transform") {
                            walletModal.removeEventListener("transitionend", onTransitionEnd);
                            walletModal.classList.remove("pp-wallet-modal--from-export-key");
                        }
                    };
                    walletModal.addEventListener("transitionend", onTransitionEnd);
                    requestAnimationFrame(function () {
                        showAddressDetailView(currentBeneficiaryName, currentBeneficiaryInitials, currentNetworkName || "Ethereum (ERC-20)");
                    });
                    return;
                }
                if (walletModal && walletModal.classList.contains("pp-wallet-modal--withdraw-completed-view")) {
                    showWithdrawConfirmView();
                    return;
                }
                if (walletModal && walletModal.classList.contains("pp-wallet-modal--withdraw-confirm-view")) {
                    hideWithdrawConfirmView();
                    return;
                }
                if (walletModal && walletModal.classList.contains("pp-wallet-modal--withdraw-form-view")) {
                    if (currentWithdrawEntryPoint === "address-detail") {
                        showAddressDetailView(currentBeneficiaryName, currentBeneficiaryInitials, currentNetworkName || "Ethereum (ERC-20)");
                    } else {
                        // Back from Withdraw form (entered via Select asset) → go back to Select asset view
                        showWithdrawSelectView();
                    }
                    return;
                }
                if (walletModal && walletModal.classList.contains("pp-wallet-modal--withdraw-select-view")) {
                    showAddressDetailView(currentBeneficiaryName, currentBeneficiaryInitials, currentNetworkName || "Ethereum (ERC-20)");
                    return;
                }
                if (walletModal && walletModal.classList.contains("pp-wallet-modal--address-detail-view")) {
                    showBeneficiaryView(currentBeneficiaryName, currentBeneficiaryInitials, null, false);
                } else {
                    showListView();
                }
            }

            var walletViewSettings = document.getElementById("walletViewSettings");
            var walletTabAssets = document.getElementById("walletTabAssets");
            var walletTabSettings = document.getElementById("walletTabSettings");
            var walletTabAssetsIcon = document.getElementById("walletTabAssetsIcon");
            var walletTabSettingsIcon = document.getElementById("walletTabSettingsIcon");
            var lastAssetsHeaderLabel = "";
            var lastAssetsHeaderTitle = "";
            var lastAssetsBackHidden = true;
            var lastAssetsAddressDetailWrapHidden = true;

            function setActiveTab(activeTab) {
                if (!walletTabAssets || !walletTabSettings || !walletModal) return;
                var isAssets = activeTab === "assets";
                walletTabAssets.classList.toggle("pp-wallet-modal__tab--active", isAssets);
                walletTabSettings.classList.toggle("pp-wallet-modal__tab--active", !isAssets);
                walletTabAssets.setAttribute("aria-current", isAssets ? "page" : "false");
                walletTabSettings.setAttribute("aria-current", !isAssets ? "page" : "false");
                if (walletTabAssetsIcon) walletTabAssetsIcon.src = isAssets ? "assets/icon-ew-tab-assets-filled.svg" : "assets/icon-ew-tab-assets-outline.svg";
                if (walletTabSettingsIcon) walletTabSettingsIcon.src = isAssets ? "assets/icon-ew-tab-settings-outline.svg" : "assets/icon-ew-tab-settings-filled.svg";
            }

            function showSettingsView() {
                if (!walletModal || !walletViewSettings) return;
                lastAssetsHeaderLabel = walletModalHeaderLabel ? (walletModalHeaderLabel.textContent || "") : "";
                lastAssetsHeaderTitle = walletModalTitle ? (walletModalTitle.textContent || "") : "";
                lastAssetsBackHidden = walletModalBack ? walletModalBack.classList.contains("pp-wallet-modal__back--hidden") : true;
                lastAssetsAddressDetailWrapHidden = walletHeaderAddressDetailWrap ? walletHeaderAddressDetailWrap.classList.contains("pp-wallet-modal__header-address-detail-wrap--hidden") : true;
                walletModal.classList.add("pp-wallet-modal--header-no-transition");
                walletModal.classList.add("pp-wallet-modal--settings-visible");
                if (walletModalHeader) walletModalHeader.classList.add("pp-wallet-modal__header--settings-tab");
                walletViewSettings.removeAttribute("hidden");
                walletViewSettings.setAttribute("aria-hidden", "false");
                if (walletModalTitle) walletModalTitle.textContent = "Settings";
                if (walletModalHeaderLabel) walletModalHeaderLabel.textContent = "";
                if (walletModalBack) walletModalBack.classList.add("pp-wallet-modal__back--hidden");
                if (walletHeaderAddressDetailWrap) { walletHeaderAddressDetailWrap.classList.add("pp-wallet-modal__header-address-detail-wrap--hidden"); walletHeaderAddressDetailWrap.setAttribute("aria-hidden", "true"); }
                setActiveTab("settings");
                requestAnimationFrame(function () { walletModal.classList.remove("pp-wallet-modal--header-no-transition"); });
            }

            function showAssetsView() {
                if (!walletModal || !walletViewSettings) return;
                walletModal.classList.add("pp-wallet-modal--header-no-transition");
                walletModal.classList.remove("pp-wallet-modal--settings-visible");
                if (walletModalHeader) walletModalHeader.classList.remove("pp-wallet-modal__header--settings-tab");
                walletViewSettings.setAttribute("hidden", "");
                walletViewSettings.setAttribute("aria-hidden", "true");
                if (walletModalHeaderLabel) walletModalHeaderLabel.textContent = lastAssetsHeaderLabel || WALLET_DEFAULT_LABEL;
                if (walletModalTitle) walletModalTitle.textContent = lastAssetsHeaderTitle || WALLET_DEFAULT_TITLE;
                if (walletModalBack) {
                    if (lastAssetsBackHidden) walletModalBack.classList.add("pp-wallet-modal__back--hidden");
                    else walletModalBack.classList.remove("pp-wallet-modal__back--hidden");
                }
                if (walletHeaderAddressDetailWrap) {
                    if (lastAssetsAddressDetailWrapHidden) { walletHeaderAddressDetailWrap.classList.add("pp-wallet-modal__header-address-detail-wrap--hidden"); walletHeaderAddressDetailWrap.setAttribute("aria-hidden", "true"); }
                    else { walletHeaderAddressDetailWrap.classList.remove("pp-wallet-modal__header-address-detail-wrap--hidden"); walletHeaderAddressDetailWrap.removeAttribute("aria-hidden"); }
                }
                setActiveTab("assets");
                requestAnimationFrame(function () { walletModal.classList.remove("pp-wallet-modal--header-no-transition"); });
            }

            if (walletModalBack) walletModalBack.addEventListener("click", onWalletBackClick);
            if (walletTabAssets) {
                walletTabAssets.addEventListener("click", function (e) {
                    e.preventDefault();
                    if (this.classList.contains("pp-wallet-modal__tab--active")) return;
                    showAssetsView();
                });
            }
            if (walletModal) {
                walletModal.querySelectorAll(".pp-wallet-modal__refresh, .pp-wallet-modal__action-btn").forEach(function (el) {
                    el.addEventListener("click", function (e) {
                        if (el.tagName === "A" && el.getAttribute("href") && el.getAttribute("href") !== "#") return;
                        e.preventDefault();
                    });
                });
                var addressValueRow = walletModal && walletModal.querySelector(".pp-wallet-modal__address-value-row");
                var walletSnackbar = document.getElementById("walletSnackbar");
                if (addressValueRow && walletSnackbar) {
                    addressValueRow.addEventListener("click", function () {
                        var value = addressValueRow.getAttribute("data-copy-value") || (addressValueRow.querySelector(".pp-wallet-modal__address-value") && addressValueRow.querySelector(".pp-wallet-modal__address-value").textContent) || "";
                        if (value && navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(value).then(function () {
                                var iconEl = document.getElementById("walletSnackbarIcon");
                                if (iconEl) iconEl.src = "assets/icon-ew-check.svg";
                                if (walletSnackbarText) walletSnackbarText.textContent = "Copied to clipboard";
                                walletSnackbar.setAttribute("aria-hidden", "false");
                                walletSnackbar.classList.add("pp-wallet-snackbar--visible");
                                clearTimeout(walletSnackbar._hideTimer);
                                clearTimeout(walletSnackbar._resetTimer);
                                walletSnackbar._hideTimer = setTimeout(function () {
                                    walletSnackbar.classList.remove("pp-wallet-snackbar--visible");
                                    walletSnackbar.setAttribute("aria-hidden", "true");
                                }, 2800);
                            });
                        }
                    });
                }
                var walletModalWithdrawBtn = document.getElementById("walletModalWithdrawBtn");
                var walletSnackbarText = document.getElementById("walletSnackbarText");
                var walletSnackbarIcon = document.getElementById("walletSnackbarIcon");
                function showWalletSnackbar(message, iconSrc) {
                    if (!walletSnackbar) return;
                    clearTimeout(walletSnackbar._hideTimer);
                    clearTimeout(walletSnackbar._resetTimer);
                    var wasVisible = walletSnackbar.classList.contains("pp-wallet-snackbar--visible");
                    if (walletSnackbarIcon && iconSrc) walletSnackbarIcon.src = iconSrc;
                    if (walletSnackbarText && message) walletSnackbarText.textContent = message;
                    if (wasVisible) {
                        walletSnackbar.classList.remove("pp-wallet-snackbar--visible");
                        walletSnackbar.setAttribute("aria-hidden", "true");
                        void walletSnackbar.offsetHeight;
                        requestAnimationFrame(function () {
                            requestAnimationFrame(function () {
                                walletSnackbar.setAttribute("aria-hidden", "false");
                                walletSnackbar.classList.add("pp-wallet-snackbar--visible");
                                walletSnackbar._hideTimer = setTimeout(function () {
                                    walletSnackbar.classList.remove("pp-wallet-snackbar--visible");
                                    walletSnackbar.setAttribute("aria-hidden", "true");
                                    walletSnackbar._resetTimer = setTimeout(function () {
                                        if (walletSnackbarIcon) walletSnackbarIcon.src = "assets/icon-ew-check.svg";
                                        if (walletSnackbarText) walletSnackbarText.textContent = "Copied to clipboard";
                                    }, 300);
                                }, 2800);
                            });
                        });
                    } else {
                        walletSnackbar.setAttribute("aria-hidden", "false");
                        walletSnackbar.classList.add("pp-wallet-snackbar--visible");
                        walletSnackbar._hideTimer = setTimeout(function () {
                            walletSnackbar.classList.remove("pp-wallet-snackbar--visible");
                            walletSnackbar.setAttribute("aria-hidden", "true");
                            walletSnackbar._resetTimer = setTimeout(function () {
                                if (walletSnackbarIcon) walletSnackbarIcon.src = "assets/icon-ew-check.svg";
                                if (walletSnackbarText) walletSnackbarText.textContent = "Copied to clipboard";
                            }, 300);
                        }, 2800);
                    }
                }
                if (walletTabSettings) {
                    walletTabSettings.addEventListener("click", function (e) {
                        e.preventDefault();
                        showWalletSnackbar("Not in prototype", "assets/icon_info_blue.svg");
                    });
                }
                var walletModalMoreBtn = document.getElementById("walletModalMoreBtn");
                if (walletModalMoreBtn) {
                    walletModalMoreBtn.addEventListener("click", function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        showWalletSnackbar("Not in prototype", "assets/icon_info_blue.svg");
                    });
                }
                document.addEventListener("paylynk:erc20-activated-changed", function () {
                    if (walletModal && walletModal.classList.contains("pp-wallet-modal--address-detail-view")) {
                        syncAddressDetailStablecoinAssets(currentBeneficiaryName);
                    }
                    if (walletModal && walletModal.classList.contains("pp-wallet-modal--withdraw-select-view")) {
                        syncWithdrawSelectAssets();
                    }
                });
                var walletPrototypeToast = document.getElementById("walletPrototypeToast");
                var walletPrototypeToastText = document.getElementById("walletPrototypeToastText");
                function showWalletPrototypeToast(message) {
                    if (!walletPrototypeToast) return;
                    if (walletPrototypeToastText && message) walletPrototypeToastText.textContent = message;
                    walletPrototypeToast.setAttribute("aria-hidden", "false");
                    walletPrototypeToast.classList.add("pp-wallet-prototype-toast--visible");
                }
                if (walletPrototypeToast) {
                    walletPrototypeToast.addEventListener("click", function () {
                        if (!walletPrototypeToast.classList.contains("pp-wallet-prototype-toast--visible")) return;
                        walletPrototypeToast.classList.remove("pp-wallet-prototype-toast--visible");
                        walletPrototypeToast.setAttribute("aria-hidden", "true");
                    });
                }
                var walletExportKeyAddressCopy = document.getElementById("walletExportKeyAddressCopy");
                if (walletExportKeyAddressCopy && walletSnackbar) {
                    walletExportKeyAddressCopy.addEventListener("click", function () {
                        var value = walletExportKeyAddressCopy.getAttribute("data-copy-value") || (document.getElementById("walletExportKeyAddress") && document.getElementById("walletExportKeyAddress").textContent) || "";
                        if (value && navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(value).then(function () {
                                showWalletSnackbar("Copied to clipboard", "assets/icon-ew-check.svg");
                            });
                        }
                    });
                }
                if (walletModalWithdrawBtn) {
                    walletModalWithdrawBtn.addEventListener("click", function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if ((currentBeneficiaryName || "").trim() === "NovaQuill Ltd") {
                            if (walletSnackbar) showWalletSnackbar("No available assets", "assets/icon-ew-warning.svg");
                        } else {
                            showWithdrawSelectView();
                        }
                    });
                }
                var walletSettingsAboutItem = document.getElementById("walletSettingsAboutItem");
                var walletSettingsExportItem = document.getElementById("walletSettingsExportItem");
                var walletSettingsSignOut = document.getElementById("walletSettingsSignOut");
                if (walletSettingsAboutItem) {
                    walletSettingsAboutItem.addEventListener("click", function (e) {
                        e.preventDefault();
                        if (typeof openWalletAboutDialog === "function") openWalletAboutDialog();
                    });
                }
                if (walletSettingsExportItem) {
                    walletSettingsExportItem.addEventListener("click", function (e) {
                        e.preventDefault();
                        if (typeof openWalletExportInfoDialog === "function") openWalletExportInfoDialog();
                    });
                }
                if (walletSettingsSignOut) {
                    walletSettingsSignOut.addEventListener("click", function (e) {
                        e.preventDefault();
                        if (typeof openWalletSignOutConfirm === "function") openWalletSignOutConfirm();
                    });
                }
                (function wireExportKeyView() {
                    var introSkipBtn = document.getElementById("walletExportIntroSkipBtn");
                    var introCancelBtn = document.getElementById("walletExportIntroCancelBtn");
                    var introContinueBtn = document.getElementById("walletExportIntroContinueBtn");
                    var risk1BackBtn = document.getElementById("walletExportRisk1BackBtn");
                    var risk1ContinueBtn = document.getElementById("walletExportRisk1ContinueBtn");
                    var risk2BackBtn = document.getElementById("walletExportRisk2BackBtn");
                    var risk2ContinueBtn = document.getElementById("walletExportRisk2ContinueBtn");
                    var risk3BackBtn = document.getElementById("walletExportRisk3BackBtn");
                    var risk3ContinueBtn = document.getElementById("walletExportRisk3ContinueBtn");
                    var consentCheckbox = document.getElementById("walletExportKeyConsent");
                    var revealBtn = document.getElementById("walletExportKeyRevealBtn");
                    var cancelBtn = document.getElementById("walletExportKeyCancelBtn");
                    function updateRevealButton() {
                        if (!revealBtn || !consentCheckbox) return;
                        var checked = consentCheckbox.checked === true;
                        revealBtn.disabled = !checked;
                        revealBtn.classList.toggle("ew-btn--disabled", !checked);
                    }
                    if (consentCheckbox && revealBtn) {
                        consentCheckbox.addEventListener("change", updateRevealButton);
                    }
                    if (introCancelBtn) {
                        introCancelBtn.addEventListener("click", function (e) {
                            e.preventDefault();
                            goBackFromExportKeyToAddressDetail();
                        });
                    }
                    if (introContinueBtn) {
                        introContinueBtn.addEventListener("click", function (e) {
                            e.preventDefault();
                            exportKeyFlowSkippedExplanation = false;
                            setExportKeyFlowStep("risk1");
                        });
                    }
                    if (introSkipBtn) {
                        introSkipBtn.addEventListener("click", function (e) {
                            e.preventDefault();
                            exportKeyFlowSkippedExplanation = true;
                            setExportKeyFlowStep("confirm");
                        });
                    }
                    if (risk1BackBtn) {
                        risk1BackBtn.addEventListener("click", function (e) {
                            e.preventDefault();
                            setExportKeyFlowStep("intro");
                        });
                    }
                    if (risk1ContinueBtn) {
                        risk1ContinueBtn.addEventListener("click", function (e) {
                            e.preventDefault();
                            setExportKeyFlowStep("risk2");
                        });
                    }
                    if (risk2BackBtn) {
                        risk2BackBtn.addEventListener("click", function (e) {
                            e.preventDefault();
                            setExportKeyFlowStep("risk1");
                        });
                    }
                    if (risk2ContinueBtn) {
                        risk2ContinueBtn.addEventListener("click", function (e) {
                            e.preventDefault();
                            setExportKeyFlowStep("risk3");
                        });
                    }
                    if (risk3BackBtn) {
                        risk3BackBtn.addEventListener("click", function (e) {
                            e.preventDefault();
                            setExportKeyFlowStep("risk2");
                        });
                    }
                    if (risk3ContinueBtn) {
                        risk3ContinueBtn.addEventListener("click", function (e) {
                            e.preventDefault();
                            setExportKeyFlowStep("confirm");
                        });
                    }
                    if (cancelBtn) {
                        cancelBtn.addEventListener("click", function (e) {
                            e.preventDefault();
                            setExportKeyFlowStep(exportKeyFlowSkippedExplanation ? "intro" : "risk3");
                        });
                    }
                    if (revealBtn) {
                        revealBtn.addEventListener("click", function (e) {
                            e.preventDefault();
                            if (revealBtn.disabled) return;
                            if (typeof openWalletPasscodeModal !== "function") return;
                            openWalletPasscodeModal(function () {
                                currentExportPrivateKey = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce036f9f8f6d8c1a5b7c9d2";
                                if (walletProcessingModalLabel) walletProcessingModalLabel.textContent = "Preparing export";
                                showWithdrawProcessingModal();
                                setTimeout(function () {
                                    hideWithdrawProcessingModal();
                                    showSaveKeyView();
                                    if (typeof showWalletSnackbar === "function") showWalletSnackbar("Private key ready to save", "assets/icon-ew-check.svg");
                                }, 1500);
                            });
                        });
                    }
                })();
                (function wireSaveKeyView() {
                    var saveKeyConsent = document.getElementById("walletSaveKeyConsent");
                    var saveKeyDoneBtn = document.getElementById("walletSaveKeyDoneBtn");
                    function updateSaveKeyDoneButton() {
                        if (!saveKeyDoneBtn || !saveKeyConsent) return;
                        var checked = saveKeyConsent.checked === true;
                        saveKeyDoneBtn.disabled = !checked;
                        saveKeyDoneBtn.classList.toggle("ew-btn--disabled", !checked);
                    }
                    if (saveKeyConsent && saveKeyDoneBtn) {
                        saveKeyConsent.addEventListener("change", updateSaveKeyDoneButton);
                    }
                    var saveKeyPkCopy = document.getElementById("walletSaveKeyPrivateKeyCopy");
                    if (saveKeyPkCopy && walletSnackbar) {
                        saveKeyPkCopy.addEventListener("click", function () {
                            var valueEl = document.getElementById("walletSaveKeyPrivateKeyValue");
                            var value = (valueEl && valueEl.textContent) ? valueEl.textContent.trim() : "";
                            if (value && navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(value).then(function () {
                                    showWalletSnackbar("Copied to clipboard", "assets/icon-ew-check.svg");
                                });
                            }
                        });
                    }
                    var saveKeyAddressCopy = document.getElementById("walletSaveKeyAddressCopy");
                    if (saveKeyAddressCopy && walletSnackbar) {
                        saveKeyAddressCopy.addEventListener("click", function () {
                            var value = saveKeyAddressCopy.getAttribute("data-copy-value") || (document.getElementById("walletSaveKeyAddress") && document.getElementById("walletSaveKeyAddress").textContent) || "";
                            if (value && navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(value).then(function () {
                                    showWalletSnackbar("Copied to clipboard", "assets/icon-ew-check.svg");
                                });
                            }
                        });
                    }
                })();
                var walletSaveKeyDoneBtn = document.getElementById("walletSaveKeyDoneBtn");
                if (walletSaveKeyDoneBtn) {
                    walletSaveKeyDoneBtn.addEventListener("click", function (e) {
                        e.preventDefault();
                        if (walletSaveKeyDoneBtn.disabled) return;
                        exportedBeneficiaryName = currentBeneficiaryName || "";
                        exportedAddressHidden = true;
                        var listItems = walletViewList && walletViewList.querySelectorAll(".pp-wallet-modal__item[data-beneficiary-name]");
                        if (listItems) {
                            for (var i = 0; i < listItems.length; i++) {
                                if (listItems[i].getAttribute("data-beneficiary-name") === exportedBeneficiaryName) {
                                    listItems[i].classList.add("pp-wallet-modal__item--hidden-by-export");
                                    break;
                                }
                            }
                        }
                        if (walletModal) {
                            walletModal.classList.remove("pp-wallet-modal--save-to-list");
                            walletModal.classList.remove("pp-wallet-modal--wallet-account-view");
                            walletModal.classList.remove("pp-wallet-modal--save-key-done");
                        }
                        animateSaveKeyToListTransition();
                    });
                }
                if (walletViewList) {
                    walletViewList.addEventListener("click", function (e) {
                        if (!exportedAddressHidden) return;
                        e.preventDefault();
                        e.stopPropagation();
                        exportedAddressHidden = false;
                        var item = walletViewList && walletViewList.querySelector(".pp-wallet-modal__item--hidden-by-export");
                        if (item) item.classList.remove("pp-wallet-modal__item--hidden-by-export");
                        if (typeof showWalletPrototypeToast === "function") showWalletPrototypeToast("Beneficiary list has been reset");
                    });
                }
                walletModal.addEventListener("click", function (e) {
                    var beneficiaryItem = e.target && e.target.closest && e.target.closest(".pp-wallet-modal__item[data-beneficiary-name]");
                    if (beneficiaryItem) {
                        e.preventDefault();
                        var name = beneficiaryItem.getAttribute("data-beneficiary-name") || "";
                        var initials = beneficiaryItem.getAttribute("data-beneficiary-initials") || "";
                        var balance = beneficiaryItem.getAttribute("data-beneficiary-balance") || "$0.00";
                        var balanceEmpty = beneficiaryItem.getAttribute("data-beneficiary-balance-empty") === "true";
                        showBeneficiaryView(name, initials, balance, balanceEmpty);
                        return;
                    }
                    var networkRow = e.target && e.target.closest && e.target.closest(".pp-wallet-modal__item--network[data-network-name]");
                    if (networkRow) {
                        e.preventDefault();
                        var networkName = networkRow.getAttribute("data-network-name") || "";
                        showAddressDetailView(currentBeneficiaryName, currentBeneficiaryInitials, networkName);
                        return;
                    }
                    // Asset row on address-detail view: ETH → unavailable dropdown; USDT/USDC → withdraw dropdown
                    var addressDetailView = document.getElementById("walletViewAddressDetail");
                    var assetItem = e.target && e.target.closest && e.target.closest(".pp-wallet-modal__item");
                    if (addressDetailView && assetItem && addressDetailView.contains(assetItem) && assetItem.querySelector(".pp-wallet-modal__asset-icon")) {
                        e.preventDefault();
                        e.stopPropagation();
                        var nameEl = assetItem.querySelector(".pp-wallet-modal__item-name");
                        var assetName = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : "";
                        if (assetName === "ETH") {
                            openEwDropdown(
                                [{ variant: "withdraw-unavailable", iconSrc: "assets/icon_ew_withdrawunavailable.svg" }],
                                e
                            );
                            return;
                        }
                        if (assetName) {
                            openEwDropdown(
                                [{ iconSrc: "assets/icon-ew-withdraw.svg", label: "Withdraw " + assetName, action: "withdraw" }],
                                e
                            );
                        }
                        return;
                    }
                    // Asset row in Select asset view: go to withdraw form (address + amount)
                    var assetSelectItem = e.target && e.target.closest && e.target.closest(".pp-wallet-modal__item--asset-select");
                    if (walletViewWithdrawSelect && assetSelectItem && walletViewWithdrawSelect.contains(assetSelectItem)) {
                        e.preventDefault();
                        var nameEl = assetSelectItem.querySelector(".pp-wallet-modal__item-name");
                        var assetName = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : "";
                        if (assetName === "ETH" && typeof openWalletGasAssetConfirm === "function") {
                            openWalletGasAssetConfirm(function () {
                                showWithdrawFormView(assetName, "select-asset");
                            });
                        } else if (assetName) {
                            showWithdrawFormView(assetName, "select-asset");
                        }
                    }
                });
            }

            function updateWithdrawReviewButton() {
                var addressInput = document.getElementById("walletWithdrawAddress");
                var amountInput = document.getElementById("walletWithdrawAmount");
                var reviewBtn = document.getElementById("walletWithdrawReviewBtn");
                if (!reviewBtn) return;
                var hasAddress = addressInput && (addressInput.value || "").trim().length > 0;
                var hasAmount = amountInput && (amountInput.value || "").trim().length > 0;
                var enabled = hasAddress && hasAmount;
                reviewBtn.disabled = !enabled;
                reviewBtn.classList.toggle("ew-btn--disabled", !enabled);
            }

            function resizeWithdrawAddressTextarea() {
                var el = document.getElementById("walletWithdrawAddress");
                if (!el || el.nodeName !== "TEXTAREA") return;
                el.style.height = "auto";
                var sh = el.scrollHeight;
                el.style.height = Math.min(sh, 120) + "px";
            }

            function updateWithdrawAddressClearVisibility() {
                var addressInput = document.getElementById("walletWithdrawAddress");
                var clearBtn = document.getElementById("walletWithdrawAddressClear");
                if (!addressInput || !clearBtn) return;
                var hasValue = (addressInput.value || "").trim().length > 0;
                if (hasValue) clearBtn.removeAttribute("hidden"); else clearBtn.setAttribute("hidden", "");
            }

            (function wireWithdrawForm() {
                var addressInput = document.getElementById("walletWithdrawAddress");
                var amountInput = document.getElementById("walletWithdrawAmount");
                var pasteBtn = document.getElementById("walletWithdrawPaste");
                var maxBtn = document.getElementById("walletWithdrawMax");
                var reviewBtn = document.getElementById("walletWithdrawReviewBtn");
                var availableEl = document.getElementById("walletWithdrawAvailable");
                var addressHint = document.getElementById("walletWithdrawAddressHint");
                var addressHintText = document.getElementById("walletWithdrawAddressHintText");
                var addressHintCheck = document.getElementById("walletWithdrawAddressHintCheck");
                var PASTED_ADDRESS = "0x159DE91E070Ec542BA2EE1eE53E2cb2cFd18FD84";
                function setAddressHintPasted(pasted) {
                    if (!addressHint || !addressHintText || !addressHintCheck) return;
                    if (pasted) {
                        addressHintText.textContent = "Ethereum (ERC-20) address";
                        addressHint.classList.add("pp-wallet-withdraw-form__hint--address-pasted");
                        addressHintCheck.removeAttribute("aria-hidden");
                    } else {
                        addressHintText.textContent = "Must be an Ethereum (ERC-20) address";
                        addressHint.classList.remove("pp-wallet-withdraw-form__hint--address-pasted");
                        addressHintCheck.setAttribute("aria-hidden", "true");
                    }
                }
                function updateAddressHintByValue() {
                    if (!addressInput) return;
                    var value = (addressInput.value || "").trim();
                    setAddressHintPasted(value.toLowerCase() === PASTED_ADDRESS.toLowerCase());
                }
                if (pasteBtn && addressInput) {
                    pasteBtn.addEventListener("click", function () {
                        addressInput.value = PASTED_ADDRESS;
                        updateWithdrawAddressClearVisibility();
                        updateWithdrawReviewButton();
                        updateAddressHintByValue();
                        requestAnimationFrame(function () {
                            requestAnimationFrame(function () {
                                resizeWithdrawAddressTextarea();
                            });
                        });
                        if (typeof showWalletSnackbar === "function") {
                            showWalletSnackbar("Pasted from clipboard", "assets/icon-ew-check.svg");
                        }
                    });
                }
                if (addressInput) {
                    addressInput.addEventListener("paste", function () {
                        setTimeout(function () {
                            updateAddressHintByValue();
                            updateWithdrawAddressClearVisibility();
                            updateWithdrawReviewButton();
                            resizeWithdrawAddressTextarea();
                            queueWalletViewOverflowUpdate();
                        }, 0);
                    });
                }
                if (maxBtn && amountInput && availableEl) {
                    maxBtn.addEventListener("click", function () {
                        var raw = (availableEl.textContent || "").trim();
                        var m = raw.match(/[\d.]+/);
                        if (m) amountInput.value = m[0];
                        updateWithdrawReviewButton();
                    });
                }
                if (addressInput) {
                    addressInput.addEventListener("input", function () {
                        updateAddressHintByValue();
                        resizeWithdrawAddressTextarea();
                        updateWithdrawAddressClearVisibility();
                        updateWithdrawReviewButton();
                        queueWalletViewOverflowUpdate();
                    });
                }
                var clearBtn = document.getElementById("walletWithdrawAddressClear");
                if (clearBtn && addressInput) {
                    clearBtn.addEventListener("click", function () {
                        addressInput.value = "";
                        updateAddressHintByValue();
                        resizeWithdrawAddressTextarea();
                        updateWithdrawAddressClearVisibility();
                        updateWithdrawReviewButton();
                        queueWalletViewOverflowUpdate();
                    });
                }
                if (amountInput) amountInput.addEventListener("input", updateWithdrawReviewButton);
                if (reviewBtn) reviewBtn.addEventListener("click", function () { if (!this.disabled) showWithdrawConfirmView(); });
            })();

            (function wireWithdrawConfirmView() {
                var cancelBtn = document.getElementById("walletConfirmCancelBtn");
                var confirmBtn = document.getElementById("walletConfirmWithdrawBtn");
                if (cancelBtn) cancelBtn.addEventListener("click", hideWithdrawConfirmView);
                if (confirmBtn) confirmBtn.addEventListener("click", function () {
                    openWalletPasscodeModal(function () {
                        if (walletProcessingModalLabel) walletProcessingModalLabel.textContent = "Submitting";
                        showWithdrawProcessingModal();
                        setTimeout(function () {
                            var amountEl = document.getElementById("walletConfirmAmount");
                            var toAddrEl = document.getElementById("walletConfirmToAddress");
                            var fromEl = document.getElementById("walletConfirmFromAddress");
                            var networkEl = document.getElementById("walletConfirmNetwork");
                            var gasEl = document.getElementById("walletConfirmGasFee");
                            var assetIconEl = document.getElementById("walletConfirmAssetIcon");
                            var completedAmount = document.getElementById("walletCompletedAmount");
                            var completedToAddr = document.getElementById("walletCompletedToAddress");
                            var completedFrom = document.getElementById("walletCompletedFromAddress");
                            var completedNetwork = document.getElementById("walletCompletedNetwork");
                            var completedGas = document.getElementById("walletCompletedGasFee");
                            var completedAssetIcon = document.getElementById("walletCompletedAssetIcon");
                            if (completedAmount && amountEl) completedAmount.textContent = amountEl.textContent || "32.41 USDT";
                            if (completedToAddr && toAddrEl) completedToAddr.textContent = toAddrEl.textContent || "";
                            if (completedFrom && fromEl) completedFrom.textContent = fromEl.textContent || "0x2134...1233f8";
                            if (completedNetwork && networkEl) completedNetwork.textContent = networkEl.textContent || "Ethereum (ERC-20)";
                            if (completedGas && gasEl) completedGas.textContent = gasEl.textContent || "0.02 ETH";
                            if (completedAssetIcon && assetIconEl) {
                                var img = completedAssetIcon.querySelector("img");
                                var srcImg = assetIconEl && assetIconEl.querySelector("img");
                                if (img && srcImg && srcImg.src) img.src = srcImg.src;
                            }
                            hideWithdrawProcessingModal();
                            showWithdrawCompletedView();
                        }, 3000);
                    });
                });
                var doneBtn = document.getElementById("walletWithdrawCompletedDoneBtn");
                if (doneBtn) {
                    doneBtn.addEventListener("click", function () {
                        hideWithdrawProcessingModal();
                        if (!walletModal || !walletViewWithdrawCompleted) return;
                        var beneficiaryName = currentBeneficiaryName || "Beneficiary";
                        var beneficiaryInitials = currentBeneficiaryInitials || "B";
                        var networkName = currentNetworkName || "Ethereum (ERC-20)";
                        walletModal.classList.add("pp-wallet-modal--completed-to-address-detail");
                        var onTransitionEnd = function (e) {
                            if (e.target && e.target.classList && e.target.classList.contains("pp-wallet-modal__view") && e.propertyName === "transform") {
                                walletModal.removeEventListener("transitionend", onTransitionEnd);
                                walletModal.classList.remove("pp-wallet-modal--completed-to-address-detail");
                            }
                        };
                        walletModal.addEventListener("transitionend", onTransitionEnd);
                        requestAnimationFrame(function () {
                            showAddressDetailView(beneficiaryName, beneficiaryInitials, networkName);
                        });
                    });
                }
            })();

            function isWithdrawUnavailableDropdownItem(it) {
                return it && it.variant === "withdraw-unavailable";
            }

            function applyEwDropdownShell(dropdown, items) {
                if (!dropdown) return;
                var withdrawUnavailable =
                    items && items.length === 1 && isWithdrawUnavailableDropdownItem(items[0]);
                dropdown.classList.toggle("pp-ew-dropdown--withdraw-unavailable", withdrawUnavailable);
            }

            function buildEwDropdownListHtml(items) {
                return items.map(function (it) {
                    if (isWithdrawUnavailableDropdownItem(it)) {
                        return (
                            "<li class=\"pp-ew-dropdown__item pp-ew-dropdown__item--withdraw-unavailable\" role=\"menuitem\" data-action=\"withdraw-unavailable\" aria-disabled=\"true\">" +
                            "<span class=\"pp-ew-dropdown__icon\"><img src=\"" +
                            (it.iconSrc || "assets/icon_ew_withdrawunavailable.svg") +
                            "\" alt=\"\" width=\"28\" height=\"28\" /></span>" +
                            "<span class=\"pp-ew-dropdown__label\">" +
                            "<span class=\"pp-ew-dropdown__label-primary\">Withdraw</span> " +
                            "<span class=\"pp-ew-dropdown__label-muted\">not available</span>" +
                            "</span></li>"
                        );
                    }
                    return (
                        "<li class=\"pp-ew-dropdown__item\" role=\"menuitem\" data-action=\"" +
                        (it.action || "") +
                        "\">" +
                        "<span class=\"pp-ew-dropdown__icon\"><img src=\"" +
                        (it.iconSrc || "") +
                        "\" alt=\"\" width=\"20\" height=\"20\" /></span>" +
                        "<span class=\"pp-ew-dropdown__label\">" +
                        (it.label || "") +
                        "</span></li>"
                    );
                }).join("");
            }

            // Reusable EW dropdown: items = [{ iconSrc, label, action, variant? }], position from clickEvent (Material-style)
            function openEwDropdown(items, clickEvent) {
                var dropdown = document.getElementById("ppEwDropdown");
                var listEl = dropdown && dropdown.querySelector("#ppEwDropdownList");
                if (!dropdown || !listEl || !items || !items.length) return;
                var wasOpen = dropdown.classList.contains("is-open");
                var x = (clickEvent && typeof clickEvent.clientX === "number") ? clickEvent.clientX + 8 : 8;
                var y = (clickEvent && typeof clickEvent.clientY === "number") ? clickEvent.clientY + 8 : 8;
                listEl.innerHTML = buildEwDropdownListHtml(items);
                applyEwDropdownShell(dropdown, items);
                if (wasOpen) {
                    var parent = dropdown.parentNode;
                    var clone = dropdown.cloneNode(true);
                    clone.id = "ppEwDropdown";
                    var cloneList = clone.querySelector("#ppEwDropdownList");
                    if (cloneList) cloneList.innerHTML = buildEwDropdownListHtml(items);
                    applyEwDropdownShell(clone, items);
                    clone.style.left = x + "px";
                    clone.style.top = y + "px";
                    clone.classList.remove("is-open");
                    clone.setAttribute("aria-hidden", "true");
                    parent.replaceChild(clone, dropdown);
                    dropdown = clone;
                } else {
                    dropdown.style.left = x + "px";
                    dropdown.style.top = y + "px";
                }
                function show() {
                    var el = document.getElementById("ppEwDropdown");
                    if (!el) return;
                    var dropdownRect = el.getBoundingClientRect();
                    var x2 = x;
                    var y2 = y;
                    if (y2 + dropdownRect.height > window.innerHeight - 16) y2 = window.innerHeight - dropdownRect.height - 16;
                    if (y2 < 16) y2 = 16;
                    if (x2 + dropdownRect.width > window.innerWidth - 16) x2 = window.innerWidth - dropdownRect.width - 16;
                    if (x2 < 16) x2 = 16;
                    el.style.left = x2 + "px";
                    el.style.top = y2 + "px";
                    el.classList.add("is-open");
                    el.setAttribute("aria-hidden", "false");
                }
                if (wasOpen) requestAnimationFrame(function () { requestAnimationFrame(show); });
                else show();
            }
            function closeEwDropdown() {
                var dropdown = document.getElementById("ppEwDropdown");
                if (dropdown) {
                    dropdown.classList.remove("is-open");
                    dropdown.classList.remove("pp-ew-dropdown--withdraw-unavailable");
                    dropdown.setAttribute("aria-hidden", "true");
                }
            }
            var walletDisableAutodebitConfirm = document.getElementById("walletDisableAutodebitConfirm");
            var walletGasAssetConfirm = document.getElementById("walletGasAssetConfirm");
            var walletSignOutConfirm = document.getElementById("walletSignOutConfirm");
            function openDisableAutodebitConfirm() {
                if (walletDisableAutodebitConfirm) walletDisableAutodebitConfirm.setAttribute("aria-hidden", "false");
            }
            function closeDisableAutodebitConfirm() {
                if (walletDisableAutodebitConfirm) walletDisableAutodebitConfirm.setAttribute("aria-hidden", "true");
            }
            if (walletDisableAutodebitConfirm) {
                var understoodBtn = document.getElementById("walletDisableAutodebitConfirmUnderstood");
                var dismissBtn = document.getElementById("walletDisableAutodebitConfirmDismiss");
                var autodebitBackdrop = walletDisableAutodebitConfirm.querySelector(".pp-wallet-close-confirm__backdrop");
                if (understoodBtn) understoodBtn.addEventListener("click", closeDisableAutodebitConfirm);
                if (dismissBtn) dismissBtn.addEventListener("click", closeDisableAutodebitConfirm);
                if (autodebitBackdrop) autodebitBackdrop.addEventListener("click", closeDisableAutodebitConfirm);
            }

            var walletGasAssetContinue = document.getElementById("walletGasAssetContinue");
            var walletGasAssetCancel = document.getElementById("walletGasAssetCancel");
            var walletGasAssetDismiss = document.getElementById("walletGasAssetConfirmDismiss");
            var walletGasAssetUnderstood = document.getElementById("walletGasAssetUnderstood");
            var walletGasAssetActionsConfirm = walletGasAssetConfirm
                ? walletGasAssetConfirm.querySelector(".pp-wallet-close-confirm__actions--confirm")
                : null;
            var walletGasAssetActionsInfo = walletGasAssetConfirm
                ? walletGasAssetConfirm.querySelector(".pp-wallet-close-confirm__actions--info")
                : null;
            var walletGasAssetNextAction = null;

            function setWalletGasAssetConfirmMode(mode) {
                var infoOnly = mode === "info";
                if (walletGasAssetConfirm) {
                    walletGasAssetConfirm.classList.toggle("pp-wallet-close-confirm--info-only", infoOnly);
                }
                if (walletGasAssetActionsConfirm) walletGasAssetActionsConfirm.hidden = infoOnly;
                if (walletGasAssetActionsInfo) walletGasAssetActionsInfo.hidden = !infoOnly;
            }

            function openWalletGasAssetConfirm(nextAction) {
                if (typeof nextAction === "function") {
                    setWalletGasAssetConfirmMode("confirm");
                    walletGasAssetNextAction = nextAction;
                } else {
                    setWalletGasAssetConfirmMode("info");
                    walletGasAssetNextAction = null;
                }
                if (walletGasAssetConfirm) walletGasAssetConfirm.setAttribute("aria-hidden", "false");
            }
            function closeWalletGasAssetConfirm() {
                if (walletGasAssetConfirm) {
                    walletGasAssetConfirm.setAttribute("aria-hidden", "true");
                    walletGasAssetConfirm.classList.remove("pp-wallet-close-confirm--info-only");
                }
                if (walletGasAssetActionsConfirm) walletGasAssetActionsConfirm.hidden = false;
                if (walletGasAssetActionsInfo) walletGasAssetActionsInfo.hidden = true;
                walletGasAssetNextAction = null;
            }
            function handleWalletGasAssetCancel() {
                walletGasAssetNextAction = null;
                closeWalletGasAssetConfirm();
            }
            function handleWalletGasAssetContinue() {
                var cb = walletGasAssetNextAction;
                walletGasAssetNextAction = null;
                closeWalletGasAssetConfirm();
                if (typeof cb === "function") cb();
            }
            if (walletGasAssetConfirm) {
                var walletGasAssetBackdrop = walletGasAssetConfirm.querySelector(".pp-wallet-close-confirm__backdrop");
                if (walletGasAssetContinue) walletGasAssetContinue.addEventListener("click", handleWalletGasAssetContinue);
                if (walletGasAssetCancel) walletGasAssetCancel.addEventListener("click", handleWalletGasAssetCancel);
                if (walletGasAssetDismiss) walletGasAssetDismiss.addEventListener("click", handleWalletGasAssetCancel);
                if (walletGasAssetUnderstood) walletGasAssetUnderstood.addEventListener("click", handleWalletGasAssetCancel);
                if (walletGasAssetBackdrop) walletGasAssetBackdrop.addEventListener("click", handleWalletGasAssetCancel);
            }

            function openWalletSignOutConfirm() {
                if (walletSignOutConfirm) walletSignOutConfirm.setAttribute("aria-hidden", "false");
            }

            function closeWalletSignOutConfirm() {
                if (walletSignOutConfirm) walletSignOutConfirm.setAttribute("aria-hidden", "true");
            }

            if (walletSignOutConfirm) {
                var signOutCancel = document.getElementById("walletSignOutConfirmCancel");
                var signOutConfirm = document.getElementById("walletSignOutConfirmConfirm");
                var signOutDismiss = document.getElementById("walletSignOutConfirmDismiss");
                var signOutBackdrop = walletSignOutConfirm.querySelector(".pp-wallet-close-confirm__backdrop");
                if (signOutCancel) signOutCancel.addEventListener("click", closeWalletSignOutConfirm);
                if (signOutDismiss) signOutDismiss.addEventListener("click", closeWalletSignOutConfirm);
                if (signOutBackdrop) signOutBackdrop.addEventListener("click", closeWalletSignOutConfirm);
                if (signOutConfirm) {
                    signOutConfirm.addEventListener("click", function () {
                        closeWalletSignOutConfirm();
                        clearSession();
                        closeWalletModal();
                    });
                }
            }
            document.addEventListener("click", function (e) {
                var dropdown = document.getElementById("ppEwDropdown");
                if (!dropdown || !dropdown.classList.contains("is-open")) return;
                if (dropdown.contains(e.target)) {
                    var item = e.target.closest && e.target.closest(".pp-ew-dropdown__item");
                    if (item) {
                        closeEwDropdown();
                        var action = item.getAttribute("data-action");
                        if (action === "withdraw-unavailable") {
                            openWalletGasAssetConfirm("info");
                            return;
                        }
                        if (action === "export-private-key") {
                            showExportPrivateKeyView();
                        }
                        if (action === "disable-auto-debit") openDisableAutodebitConfirm();
                        if (action === "withdraw") {
                            var labelEl = item.querySelector(".pp-ew-dropdown__label");
                            var labelText = (labelEl && labelEl.textContent) ? labelEl.textContent.trim() : "";
                            var assetName = labelText.replace(/^Withdraw\s+/i, "").trim();
                            if (assetName === "ETH" && typeof openWalletGasAssetConfirm === "function") {
                                openWalletGasAssetConfirm(function () {
                                    showWithdrawFormView(assetName, "address-detail");
                                });
                            } else if (assetName) {
                                showWithdrawFormView(assetName, "address-detail");
                            }
                        }
                    }
                    return;
                }
                closeEwDropdown();
            });
            window.PpWalletFlow = {
                open: openModal,
                openDirect: openWalletDirect,
                clearSession: clearSession,
            };
        })();
