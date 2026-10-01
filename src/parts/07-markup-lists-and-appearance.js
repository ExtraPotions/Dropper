  function dropperGemSvg(className) {
    return `<svg class="${className}" viewBox="0 0 1024 1024" aria-hidden="true"><polygon points="494,210 285,500 430,590" fill="#D9B5FF"/><polygon points="494,210 430,590 494,470" fill="#9B5AF9"/><polygon points="285,500 285,685 430,590" fill="#8C39F2"/><polygon points="285,685 494,842 430,590" fill="#5417B3"/><polygon points="430,590 494,470 494,842" fill="#7428E8"/><polygon points="530,210 739,500 594,590" fill="#AEB0C2"/><polygon points="530,210 594,590 530,470" fill="#6A6E87"/><polygon points="739,500 739,685 594,590" fill="#4E5268"/><polygon points="739,685 530,842 594,590" fill="#242633"/><polygon points="594,590 530,470 530,842" fill="#3F4254"/><rect x="502" y="205" width="20" height="650" rx="10" fill="#101017"/></svg>`;
  }

  function mountUi() {
    if (ui) return ui;
    const host = document.createElement("div");
    host.id = "tdh-root";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>${css()}</style>
      <div class="cluster" id="tdh-cluster">
        <aside id="tdh-tools-dock" data-exp-part="dock" role="region" aria-labelledby="tdh-rail-title">
          <div class="menu-head">
            <div class="header-brand">
              <div class="header-icon" aria-hidden="true">
                ${dropperGemSvg("menu-icon")}
              </div>
              <div class="header-copy">
                <div class="header-title-row">
                  <h2 id="tdh-rail-title">Dropper</h2>
                  <button type="button" id="tdh-header-version" aria-label="View Dropper v${APP_VERSION} Changelog" title="View Changelog">v${APP_VERSION}</button>
                </div>
                <div id="tdh-rail-subtitle">Twitch Drops: Track and Redeem</div>
              </div>
            </div>
            <div class="header-actions">
              <button type="button" id="tdh-rail-close" aria-label="Close">×</button>
            </div>
          </div>
          <div class="header-divider"></div>
          <div class="toast" id="tdh-toast" hidden></div>
          <div class="update-notice" id="tdh-update-notice" data-exp-update-notice="1" hidden>
            <button type="button" class="update-dismiss" id="tdh-update-dismiss" aria-label="Dismiss Update Notice">×</button>
            <div class="update-head">
              <div class="update-heading">
                <div class="update-kicker" id="tdh-update-kicker">What's New</div>
                <div class="update-title" id="tdh-update-title"></div>
              </div>
              <div class="update-version" id="tdh-update-version"></div>
            </div>
            <div class="update-text" id="tdh-update-text"></div>
            <ul class="update-list" id="tdh-update-list"></ul>
            <div class="update-footer">
              <button type="button" class="update-release" id="tdh-update-release">GitHub Release</button>
              <a class="update-action" id="tdh-update-action" href="#" target="_blank" rel="noopener noreferrer" role="button">View Update</a>
            </div>
          </div>
          <div class="badge-only-progress-slot" id="tdh-badge-only-progress-slot" aria-label="Drop progress" hidden></div>
          <section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-drops-body"><span class="fl-tool-title">Drops</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-drops-body">
            ${switchHtml("tdh-claim-drops", "Auto-Claim Drops", "", settings.claimDrops)}
            ${switchHtml("tdh-claim-bonus", "Auto-Claim Bonus Chests", "Attempts Free Bonus Claims. A Click Is Not Counted As Confirmation.", settings.claimBonus)}
            <div class="auth-required" id="tdh-auth-required" hidden>
              <span>Twitch Login Required</span>
              <button type="button" class="life-btn" id="tdh-twitch-login">Open Twitch Login</button>
            </div>
            <div class="account-link-warning" id="tdh-account-link-warning" role="alert" hidden>
              <div class="account-link-warning-copy">
                <strong>Game Account Not Linked</strong>
                <span id="tdh-account-link-detail">This campaign requires a linked game account before Twitch can award progress.</span>
              </div>
              <button type="button" class="life-btn" id="tdh-account-link-open">Open Connections</button>
            </div>
            <div class="deadline-status" id="tdh-deadline-status" data-tone="muted" role="status" hidden></div>
            <details class="campaign-manager" id="tdh-open-campaigns">
              <summary><span class="campaign-manager-title">Open Campaigns</span><span class="campaign-manager-summary" id="tdh-open-campaign-summary">Loading…</span></summary>
              <div class="mini-row campaign-strategy-row"><span>Campaign Order</span><select class="select-lite" id="tdh-campaign-strategy"><option value="priority">My Priority</option><option value="deadline">Ending Soonest</option><option value="completion">Closest to Completion</option><option value="shortest">Shortest Remaining</option></select></div>
              <div class="campaign-manager-note" id="tdh-campaign-order-note">Check a game to ignore it until its latest campaign ends. Use ↑ and ↓ to rank games. The selected Campaign Order controls how viable campaigns are chosen.</div>
              <div class="campaign-game-list" id="tdh-open-campaign-list"></div>
            </details>
            <details class="eligibility-chip" id="tdh-reward-eligibility" data-tone="muted">
              <summary><span id="tdh-eligibility-summary" role="status">? Eligibility Not Verified</span><span class="eligibility-checklist-count" id="tdh-eligibility-checklist-summary">Checking…</span></summary>
              <div class="eligibility-detail" id="tdh-eligibility-detail">Dropper does not yet have enough information to verify this stream.</div>
              <div class="eligibility-checklist-list" id="tdh-eligibility-checklist-list"></div>
            </details>
            <button type="button" class="life-btn" id="tdh-toggle-inventory">Show Drops Inventory</button>
            <div class="compact-inventory" id="tdh-compact-inventory"><div class="inventory-head"><div><strong>Campaign Drops</strong><span id="tdh-inventory-game"></span></div></div><div class="inventory-list" id="tdh-inventory-list"></div></div>
            <details class="campaign-manager" id="tdh-claim-history-panel">
              <summary><span class="campaign-manager-title">Claim History</span><span class="unclaimed-badge" id="tdh-unclaimed-summary" hidden></span><span class="campaign-manager-summary" id="tdh-claim-health">No claims yet</span></summary>
              <div class="unclaimed-section" id="tdh-unclaimed-panel" hidden>
                <div class="unclaimed-title">Unclaimed rewards</div>
                <div class="claim-history-list" id="tdh-unclaimed-list"></div>
              </div>
              <div class="claim-history-list" id="tdh-claim-history"><div class="campaign-manager-note">No claimed Drops recorded for this account.</div></div>
            </details>
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-streams-body"><span class="fl-tool-title">Streams</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-streams-body">
            <div class="stream-subsection-label">Current Stream</div>
            <div class="campaign-manager-note" id="tdh-viewing-status" role="status"></div>
            <div class="earning-confidence" id="tdh-earning-confidence" data-tone="muted" role="status">
              <strong id="tdh-earning-confidence-label">Waiting for Twitch</strong>
              <span id="tdh-earning-confidence-detail">No verified earning evidence yet.</span>
            </div>
            <div class="multi-tab-status" id="tdh-multi-tab-status" role="status" hidden></div>
            <div class="session-recovery-status" id="tdh-session-recovery-status" role="status" hidden></div>
            <div class="action-pair"><button type="button" class="life-btn" id="tdh-resume-playback">Resume Playback</button><button type="button" class="life-btn" id="tdh-allow-switching">Use Automatic Switching</button></div>
            <div class="action-pair">
              <button type="button" class="life-btn" id="tdh-stream-lock" aria-pressed="false">Stay On This Stream</button>
              <button type="button" class="life-btn" id="tdh-recovery-action" hidden>Recheck Twitch</button>
            </div>
            ${switchHtml("tdh-find-next", "Automatic Stream Switching", "Uses Eligible Alternatives Only When You Permit Switching. Manual Selections And Pauses Stay Protected.", settings.findNextStream)}
            <details class="campaign-manager" id="tdh-stream-health-panel">
              <summary><span class="campaign-manager-title">Stream Health</span><span class="campaign-manager-summary" id="tdh-stream-health-summary">Checking…</span></summary>
              <div class="stream-health-list" id="tdh-stream-health-list"></div>
            </details>
            <details class="auth-advanced">
              <summary>Playback options</summary>
              <div class="auth-advanced-body">
                ${switchHtml("tdh-mute-next", "Mute Opened Streams", "Mutes Streams Dropper Opens Or Switches To, Including Same-Tab Routing.", settings.muteRestarted)}
                ${switchHtml("tdh-restore-channel-player", "Restore Channel Player On Arrival", "Returns An Initial Twitch Mini-player To The Normal Channel View. Stops After You Interact With The Page.", settings.restoreChannelPlayer)}
                <button id="tdh-restore-channel-player-now" type="button" class="life-btn">Restore Channel Player</button>
                ${switchHtml("tdh-background-earning", "Background Progress Tracking", "Reports Actual Twitch Credit In Hidden Tabs Or Picture-in-Picture. Does Not Simulate Viewing.", settings.backgroundEarning)}
                ${switchHtml("tdh-auto-pip", "Picture-in-Picture When Away", "Attempts Picture-in-Picture when this Twitch tab becomes hidden and exits Dropper-started PiP when you return. Browser permission and user-activation rules still apply.", settings.autoPictureInPicture)}
                <div class="mini-row"><span>Pause Auto-Switch</span><select class="select-lite" id="tdh-pause-switch"><option value="0">Off</option><option value="30">30 Min</option><option value="60">1 Hour</option><option value="120">2 Hours</option><option value="240">4 Hours</option><option value="480">8 Hours</option><option value="720">12 Hours</option><option value="1440">24 Hours</option></select></div>
              </div>
            </details>
            <details class="auth-advanced">
              <summary>Notifications</summary>
              <div class="auth-advanced-body">
                ${switchHtml("tdh-notify-claimed", "Claimed Drops", "Uses browser notifications when Dropper confirms a claimed Drop.", settings.notifyClaimed)}
                ${switchHtml("tdh-notify-ending", "Ending Campaigns", "Uses browser notifications when the active campaign reaches 30 minutes and 10 minutes remaining.", settings.notifyCampaignEnding)}
                ${switchHtml("tdh-notify-stalled", "Stalled Progress", "Uses browser notifications when credited progress enters stall recovery.", settings.notifyStalledProgress)}
                ${switchHtml("tdh-notify-switch", "Stream Switches", "Uses browser notifications when Dropper automatically moves to another Twitch channel.", settings.notifyStreamSwitches)}
                ${switchHtml("tdh-notify-hidden", "Only When Tab Is Hidden", "Suppresses browser alerts while you are actively viewing this Twitch tab.", settings.notifyOnlyWhenHidden)}
                <div class="mini-row"><span>Alert Cooldown</span><select class="select-lite" id="tdh-notification-cooldown"><option value="0">Off</option><option value="5">5 Min</option><option value="15">15 Min</option><option value="30">30 Min</option></select></div>
              </div>
            </details>
            <details class="auth-advanced">
              <summary>Routing & backup</summary>
              <div class="auth-advanced-body">
                ${switchHtml("tdh-resume-session", "Resume Last Drop Session", "Keeps a small account-scoped resume snapshot across browser restarts and re-verifies Twitch before continuing.", settings.resumeSessionOnRestart)}
                ${switchHtml("tdh-queue-enabled", "Maintain Backup Streams", "Keeps A Short List Of Eligible Backup Drops Channels Ready.", settings.queueEnabled)}
                <div class="mini-row"><span>Standby Streams</span><select class="select-lite" id="tdh-queue-count"><option value="1">1</option><option value="3">3</option><option value="5">5</option></select></div>
                <div class="queue-switches">
                  <div class="queue-switches-label">Skip On</div>
                  ${switchHtml("tdh-queue-stall", "Stall", "Switches The Current Tab When Credited Progress Stalls.", settings.queueOnStall)}
                  ${switchHtml("tdh-queue-offline", "Offline", "Switches The Current Tab When The Active Stream Goes Offline.", settings.queueOnOffline)}
                  ${switchHtml("tdh-queue-category", "Category Change", "Finds A Replacement Stream If The Current Channel Changes Away From The Active Drop Game.", settings.queueOnCategoryChange)}
                </div>
                <div class="mini-row"><span>Channel Preference</span><select class="select-lite" id="tdh-queue-preference"><option>Any Eligible</option><option>Lowest Viewers</option><option>Highest Viewers</option></select></div>
                <details class="queue-collapsible" id="tdh-queue-details">
                  <summary class="queue-summary-head">
                    <div><strong>Active + Standby</strong><span id="tdh-queue-summary"></span></div>
                    <span class="queue-summary-chevron" aria-hidden="true">▸</span>
                  </summary>
                  <div class="inventory-list" id="tdh-queue-list"></div>
                </details>
                <button type="button" class="life-btn" id="tdh-clear-skipped-streamers" data-help="Clears The Temporary Streamer Rotation And Immediately Retries Discovery When Waiting.">Clear Skipped Streamers</button>
              </div>
            </details>
            <details class="campaign-manager" id="tdh-routing-history-panel">
              <summary><span class="campaign-manager-title">Why did it switch?</span><span class="campaign-manager-summary" id="tdh-routing-history-summary">No switches yet</span></summary>
              <div class="routing-history-list" id="tdh-routing-history"><div class="campaign-manager-note">Automatic switch reasons will appear here.</div></div>
            </details>
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-progress-body"><span class="fl-tool-title">Appearance</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-progress-body">
            ${switchHtml("tdh-progress-title", "Show Progress In Tab", "", settings.progressInTitle)}
            ${switchHtml("tdh-keep-tab", "Keep Screen Awake", "Requests A Screen Wake Lock During Actual Playback. Does Not Override Visibility Or Pauses.", settings.keepTabActive)}
            ${switchHtml("tdh-hide-sub-promos", "Hide Twitch Subscribe Promos", "", settings.hideTwitchSubscriptionPromos)}
            ${switchHtml("tdh-badge-only", "Badge Only", "Keeps Only The Dropper Badge On The Page And Shows Progress At The Top Of The Drops Menu.", settings.badgeOnly)}
            ${switchHtml("tdh-reduce-motion", "Reduce motion", "", settings.reduceMotion)}
            <hr class="appearance-separator">
            ${switchHtml("tdh-custom-opacity", "Custom Opacity", "Makes Dropper panels translucent while keeping the launcher fully visible.", settings.customOpacity)}
            <div class="opacity-row" id="tdh-opacity-row"${settings.customOpacity ? "" : " hidden"}>
              <span id="tdh-opacity-label">Opacity</span>
              <input id="tdh-opacity-range" type="range" min="40" max="100" step="5" value="${normalizedOpacityPercent()}" aria-labelledby="tdh-opacity-label" aria-valuemin="40" aria-valuemax="100" aria-valuenow="${normalizedOpacityPercent()}" aria-valuetext="${normalizedOpacityPercent()}%">
              <output id="tdh-opacity-value" for="tdh-opacity-range">${normalizedOpacityPercent()}%</output>
            </div>
          </div></section>
          <section class="fl-tool-panel"><div class="fl-tool-header" data-panel="tdh-diagnostics-body"><span class="fl-tool-title">System</span><button class="fl-tool-chevron" type="button" aria-expanded="false">▸</button></div><div class="fl-tool-body fl-tool-hidden" id="tdh-diagnostics-body">
            <div class="action-pair"><button type="button" class="life-btn" id="tdh-diagnostics-toggle">Show Diagnostics</button>
            <button type="button" class="life-btn" id="tdh-copy-diagnostics">Copy Diagnostics</button></div>
            <details class="auth-advanced">
              <summary>Maintenance</summary>
              <div class="auth-advanced-body">
                <button type="button" class="life-btn" id="tdh-check-updates">Check for Updates</button>
                <button type="button" class="life-btn" id="tdh-refresh-campaign-data">Refresh Campaign Data</button>
                <button type="button" class="life-btn" id="tdh-clear-activity">Clear Activity Log</button>
                <div class="action-pair"><button type="button" class="life-btn" id="tdh-refresh-now">Refresh Drop State</button>
                <button type="button" class="life-btn" id="tdh-reset-session">Reset Session State</button></div>
              </div>
            </details>
            <div class="diag" id="tdh-diagnostics" role="region" aria-label="Site and plugin diagnostics" tabindex="0"></div>
          </div></section>
        </aside>
        <div class="progress-stack">
          <div class="badge-row" data-exp-part="launcher-row">
          <section id="tdh-drop-card" data-exp-part="progress-card" aria-live="polite">
            <div class="expanded-content">
              <div class="stream-info" id="tdh-stream-info">
                <div class="progress-copy">
                  <div class="progress-head">
                    <div class="stream-channel" id="tdh-stream-channel">Finding Stream…</div>
                    <div class="drop-percent" id="tdh-drop-percent">0%</div>
                  </div>
                  <div class="progress-category"><span class="stream-game" id="tdh-stream-game">Waiting For Category</span></div>
                  <div class="drop-bar"><span id="tdh-drop-fill"></span></div>
                  <div class="progress-reward-row">
                    <span class="drop-meta" id="tdh-drop-meta">0 / 0 min</span>
                    <span class="progress-dot">•</span>
                    <span class="drop-name" id="tdh-drop-name">Waiting For Drop</span>
                  </div>
                  <div class="drop-status-row">
                    <div class="status-meta-chip">
                      <span class="state-pill" id="tdh-drop-state">Idle</span>
                      <span class="status-chip-divider" aria-hidden="true"></span>
                      <svg class="status-clock-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"></circle><path d="M8 4.5v3.8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                      <span id="tdh-updated-ago">Checked —</span>
                    </div>
                    <button type="button" class="skip-streamer-chip" id="tdh-skip-streamer" aria-label="No active streamer to skip">
                      <svg class="skip-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.25 2.5 7.4 8l-5.15 5.5V2.5Zm6.1 0L13.5 8l-5.15 5.5V2.5Z"></path></svg>
                      <span class="skip-label">Skip</span>
                      <span class="skip-countdown" hidden></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <button type="button" id="tdh-settings-launcher" data-exp-part="launcher" aria-controls="tdh-tools-dock" aria-expanded="false" aria-label="Open Dropper Settings" data-userscript-launcher="userscript-launcher-v1" data-launcher-id="dropper" data-launcher-preferred-position="right-bottom">
            <svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><path class="track" d="M18 3H24A9 9 0 0 1 33 12V24A9 9 0 0 1 24 33H12A9 9 0 0 1 3 24V12A9 9 0 0 1 12 3H18Z"></path><path class="fill" id="tdh-ring" d="M18 3H24A9 9 0 0 1 33 12V24A9 9 0 0 1 24 33H12A9 9 0 0 1 3 24V12A9 9 0 0 1 12 3H18Z" pathLength="100" stroke-dasharray="0 100"></path></svg>
            ${dropperGemSvg("icon")}
          </button>
          </div>
        </div>
      </div>`;
    document.documentElement.appendChild(host);
    registerBadgeGrid(host, "dropper");
    ui = { host, shadow, cluster: shadow.getElementById("tdh-cluster"), launcher: shadow.getElementById("tdh-settings-launcher"), dock: shadow.getElementById("tdh-tools-dock") };
    // Text wrapping, width transitions, and nested panels can change the menu
    // after the initial layout. Coalesce resize work without another poll loop.
    let chromeLayoutFrame = 0;
    const chromeResizeObserver = new ResizeObserver(() => {
      if (!host.isConnected || ui?.host !== host) {
        cancelAnimationFrame(chromeLayoutFrame);
        chromeResizeObserver.disconnect();
        return;
      }
      if (chromeLayoutFrame) return;
      chromeLayoutFrame = requestAnimationFrame(() => {
        chromeLayoutFrame = 0;
        if (host.isConnected && ui?.host === host) layoutChrome();
      });
    });
    chromeResizeObserver.observe(ui.dock);
    chromeResizeObserver.observe(shadow.querySelector(".badge-row"));
    const updateNotice = shadow.getElementById("tdh-update-notice");
    if (updateNotice) {
      updateNotice.dataset.placement = "menu";
      delete updateNotice.dataset.expFloatingNotice;
      ui.cluster.append(updateNotice);
      new ResizeObserver(() => requestAnimationFrame(positionMenuUpdateNotice)).observe(updateNotice);
      new MutationObserver(() => requestAnimationFrame(positionMenuUpdateNotice)).observe(updateNotice,{attributes:true,attributeFilter:["hidden","class"]});
    }
    bindDrag();
    bindSwitches();
    bindPanels();
    ExtraPotionsCore.mountMenuArrangement({ panel: ui.dock, id: "dropper", onChange: () => requestAnimationFrame(layoutChrome), resetLaunchers() { ExtraPotionsCore.resetLauncherGrid("dropper"); requestAnimationFrame(layoutChrome); } });
    bindMenuInactivity();
    bindDropperControls();
    renderSwitches();
    applyMotionSetting();
    applyAppearanceSettings();
    syncProgressSurfaces();
    refreshDropCard();
    refreshQueueList();
    watchChatWidth();
    syncDropperWidthToChat();
    layoutChrome();
    ui.launcher.addEventListener("click", () => setRailOpen(!railOpen));
    shadow.getElementById("tdh-header-version")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!railOpen) setRailOpen(true);
      showCurrentChangelog();
      scheduleMenuDismiss();
    });
    // Core owns the support control: its button, popover, donation options and outside-press closing.
    const support = ExtraPotionsCore.createSupportControl({ label: "Support Dropper" });
    if (support) shadow.querySelector(".header-actions")?.prepend(support.element);
    const supportPopover = support?.popover || null;
    const closeSupportPopover = () => support?.hide();
    shadow.getElementById("tdh-rail-close").addEventListener("click", () => {
      closeSupportPopover();
      setRailOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.altKey && (event.key === "g" || event.key === "G") && !event.repeat) { event.preventDefault(); setRailOpen(!railOpen, true); }
      if (event.key === "Escape" && supportPopover?.hidden === false) { closeSupportPopover(); return; }
      if (event.key === "Escape" && railOpen) setRailOpen(false, true);
      if (!event.altKey && (event.key === "r" || event.key === "R") && railOpen) requestGqlPoll("keyboard-refresh", true);
    });
    // exp-core-allow: Dropper's menu does not run on Core's create() controller yet; remove with that migration.
    document.addEventListener("pointerdown", (event) => {
      if (railOpen && !event.composedPath().includes(host)) setRailOpen(false);
    });
    return ui;
  }


  function formatUptime(value) {
    const match = String(value || "").match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if (!match) return value || "";
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  function isTrustedTwitchUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      const host = parsed.hostname.toLowerCase();
      return parsed.protocol === "https:" && (host === "twitch.tv" || host === "www.twitch.tv" || host === "player.twitch.tv" || host === "embed.twitch.tv" || host.endsWith(".twitch.tv"));
    } catch (_) {
      return false;
    }
  }

  function skipStreamerArmSnapshot(now = Date.now()) {
    const login = cleanText(skipStreamerArm?.login).toLowerCase();
    const expiresAt = Number(skipStreamerArm?.expiresAt || 0);
    if (!login || !expiresAt || expiresAt <= now) return null;
    return {
      login,
      expiresAt,
      remainingMs: Math.max(0, expiresAt - now),
      remainingSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
    };
  }

  function clearSkipStreamerArm(reason = "", log = false) {
    clearTimeout(skipStreamerArmTimer);
    skipStreamerArmTimer = null;
    const previous = skipStreamerArmSnapshot();
    skipStreamerArm = { login: "", expiresAt: 0 };
    if (log && previous) {
      logActivity("stream-skip-arm", "Canceled armed streamer skip", {
        reason: reason || null,
        stream: previous.login,
      });
    }
    renderSkipStreamerControl();
    return Boolean(previous);
  }

  function renderSkipStreamerControl(now = Date.now()) {
    const button = ui?.shadow?.getElementById("tdh-skip-streamer");
    if (!button) return;

    const active = cleanText(watchingLogin()).toLowerCase();
    const canSkip = Boolean(currentDrop && active);
    let armed = skipStreamerArmSnapshot(now);

    if (armed && (!canSkip || armed.login !== active)) {
      clearTimeout(skipStreamerArmTimer);
      skipStreamerArmTimer = null;
      skipStreamerArm = { login: "", expiresAt: 0 };
      armed = null;
    }

    const label = button.querySelector(".skip-label");
    const countdown = button.querySelector(".skip-countdown");
    button.disabled = !canSkip;
    button.setAttribute("aria-disabled", String(!canSkip));
    button.classList.toggle("is-armed", Boolean(armed));

    if (armed) {
      const displayLogin = active || armed.login;
      if (label) label.textContent = "Confirm";
      if (countdown) {
        countdown.hidden = false;
        countdown.textContent = `${armed.remainingSeconds}s`;
      }
      button.title = `Click again within ${armed.remainingSeconds}s to skip ${displayLogin}`;
      button.setAttribute("aria-label", `Confirm skip ${displayLogin}, ${armed.remainingSeconds} seconds remaining`);
      return;
    }

    if (label) label.textContent = "Skip";
    if (countdown) {
      countdown.hidden = true;
      countdown.textContent = "";
    }
    button.title = canSkip
      ? `Arm skip for ${active}; click again within 3 seconds to confirm`
      : "No active streamer to skip";
    button.setAttribute("aria-label", canSkip ? `Arm skip streamer ${active}` : "No active streamer to skip");
  }

  function scheduleSkipStreamerArmTick() {
    clearTimeout(skipStreamerArmTimer);
    skipStreamerArmTimer = null;
    const armed = skipStreamerArmSnapshot();
    if (!armed) {
      skipStreamerArm = { login: "", expiresAt: 0 };
      renderSkipStreamerControl();
      return;
    }
    renderSkipStreamerControl();
    skipStreamerArmTimer = setTimeout(
      scheduleSkipStreamerArmTick,
      Math.min(SKIP_STREAMER_ARM_TICK_MS, Math.max(40, armed.remainingMs + 10)),
    );
  }

  function armSkipCurrentStreamer() {
    const active = cleanText(watchingLogin()).toLowerCase();
    if (!active || !currentDrop) {
      clearSkipStreamerArm();
      setStatus("No Active Stream To Skip");
      notifyUser("No Active Stream To Skip");
      return false;
    }

    skipStreamerArm = {
      login: active,
      expiresAt: Date.now() + SKIP_STREAMER_ARM_MS,
    };
    logActivity("stream-skip-arm", "Armed streamer skip confirmation", {
      stream: active,
      confirmSeconds: Math.round(SKIP_STREAMER_ARM_MS / 1000),
    });
    scheduleSkipStreamerArmTick();
    return true;
  }

  function handleSkipStreamerClick() {
    const active = cleanText(watchingLogin()).toLowerCase();
    const armed = skipStreamerArmSnapshot();

    if (armed && active && armed.login === active) {
      clearSkipStreamerArm();
      return skipCurrentStreamer();
    }

    clearSkipStreamerArm();
    return armSkipCurrentStreamer();
  }

  function skipCurrentStreamer() {
    explicitViewingNavigationUntil = Date.now() + 15000;
    clearSkipStreamerArm();
    if (!isAutoRoutingController()) {
      noteDeferredAutoRouting("manual-stream-skip");
      return false;
    }

    const active = cleanText(watchingLogin()).toLowerCase();
    if (!active || !currentDrop) {
      setStatus("No Active Stream To Skip");
      notifyUser("No Active Stream To Skip");
      return false;
    }

    const session = readRoutingControllerSession();
    transitionRoutingController(
      ROUTING_STATES.FIND_STREAM,
      {
        ...routingControllerTargetFromDrop(currentDrop),
        targetStream: "",
        failedStreams: routingControllerAddFailedStream(session, active),
        candidateEvidence: null,
        mismatchSince: 0,
        offlineSince: 0,
        deadlineAt: 0,
        waitReason: "",
      },
      `Manual stream skip · ${active}`,
    );

    lastStreamVerification = null;
    streamVerificationState = null;
    logActivity("stream-skip", "Skipped current streamer", {
      from: active,
      game: currentDrop.game || null,
      campaign: currentDrop.campaign || null,
    });
    setStatus(`Skipping ${active} · Returning To ${currentDrop.game || "Target"} Category`);
    routingControllerTick(Date.now(), "manual-stream-skip");
    return true;
  }

  function pruneStandbyCache(now = Date.now()) {
    const source = Array.isArray(standbyCache) ? standbyCache : [];
    standbyCache = source.filter((item) => {
      if (
        !item ||
        !item.login ||
        Number(item.seenAt || 0) <= now - STANDBY_CACHE_TTL_MS ||
        campaignMarkedComplete(item.campaignKey || "")
      ) return false;

      const explicitState = campaignRoutingState({
        campaignKey: item.campaignKey || "",
        startAt: item.campaignStartAt || "",
        endAt: item.campaignEndAt || "",
        status: item.campaignStatus || "",
        game: item.game || "",
      }, now);
      if (explicitState.windowKnown) return explicitState.open;

      const memoryState = campaignMemoryRoutingState(item.campaignKey || "", now);
      return memoryState.open;
    }).slice(-60);
    writeSession(STANDBY_CACHE_KEY, standbyCache);
    return standbyCache;
  }
  function rememberStandbyCandidates(candidates, context = {}) {
    if (!Array.isArray(candidates) || !candidates.length) return;
    const now = Date.now();
    const existing = pruneStandbyCache(now);
    const byLogin = new Map(existing.map((item) => [item.login, item]));

    for (const candidate of candidates) {
      const login = cleanText(candidate?.login).toLowerCase();
      const href = twitchChannelHref(candidate?.href);
      if (!login || !href) continue;
      byLogin.set(login, {
        ...(byLogin.get(login) || {}),
        login,
        href,
        label: cleanText(candidate.label || login),
        viewers: streamViewerCount(candidate.viewers),
        dropsTagged: Boolean(candidate.dropsTagged),
        game: cleanText(context.game || candidate.game || ""),
        gameSlug: cleanText(context.gameSlug || candidate.gameSlug || ""),
        campaignKey: cleanText(context.campaignKey || candidate.campaignKey || ""),
        campaignStartAt: cleanText(context.campaignStartAt || candidate.campaignStartAt || currentDrop?.campaignStartAt || ""),
        campaignEndAt: cleanText(context.campaignEndAt || candidate.campaignEndAt || currentDrop?.campaignEndAt || ""),
        campaignStatus: cleanText(context.campaignStatus || candidate.campaignStatus || "ACTIVE"),
        seenAt: now,
      });
    }

    standbyCache = [...byLogin.values()]
      .sort((a, b) => Number(a.seenAt || 0) - Number(b.seenAt || 0))
      .slice(-60);
    writeSession(STANDBY_CACHE_KEY, standbyCache);
    lastStandbyRefreshAt = now;
    writeSession(STANDBY_REFRESH_KEY, lastStandbyRefreshAt);
  }

  function cachedStandbyCandidates(gameName = currentDrop?.game || "", campaignKeyValue = currentDrop?.campaignKey || "") {
    const active = cleanText(watchingLogin()).toLowerCase();
    const failed = routingControllerFailedSet(readRoutingControllerSession());
    const wantedGame = normalizeGameName(gameName);
    const wantedCampaign = cleanText(campaignKeyValue);
    const allowedChannels = activeCampaignAllowedChannels();
    const allowedLogins = new Set(
      allowedChannels.map((channel) => cleanText(channel.login).toLowerCase()).filter(Boolean),
    );
    const allowListPresent = allowedLogins.size > 0;

    const items = pruneStandbyCache().filter((item) => {
      const login = cleanText(item?.login).toLowerCase();
      if (!login || login === active || failed.has(login)) return false;
      if (wantedGame && (!item.game || !gameNamesMatch(wantedGame, item.game))) return false;
      if (wantedCampaign && item.campaignKey !== wantedCampaign) return false;
      if (allowListPresent && !allowedLogins.has(login) && item.dropsTagged !== true) return false;
      return true;
    }).map((item) => ({
      ...item,
      allowListMatch: allowListPresent
        ? allowedLogins.has(cleanText(item.login).toLowerCase())
        : Boolean(item.allowListMatch),
    }));

    const ranked = sortStreamCandidates(items, (left, right) => Number(right.seenAt || 0) - Number(left.seenAt || 0));
    return ranked;
  }

  function refreshStandbyCampaignCache(now = Date.now()) {
    const routing = readRoutingControllerSession();
    const targetGame = routing.targetGame || currentDrop?.game || "";
    const targetCampaignKey = routing.targetCampaignKey || currentDrop?.campaignKey || "";
    pruneStandbyCache(now);
    if (targetCampaignKey) {
      standbyCache = standbyCache.filter((item) => item.campaignKey === targetCampaignKey);
      writeSession(STANDBY_CACHE_KEY, standbyCache);
    }
    lastStandbyRefreshAt = now;
    writeSession(STANDBY_REFRESH_KEY, now);
    queueGqlPollSoon("standby-refresh", 0);
    logActivity("standby-refresh", "Refreshed standby streams for active campaign", {
      campaignKey: targetCampaignKey || null,
      game: targetGame || null,
      candidates: cachedStandbyCandidates(targetGame, targetCampaignKey).length,
      intervalMinutes: Math.round(STANDBY_REFRESH_INTERVAL_MS / 60000),
    });
  }

  function discoverQueueCandidates(now = Date.now()) {
    const seen = new Set();
    const items = [];
    const active = cleanText(watchingLogin()).toLowerCase();
    const routing = readRoutingControllerSession();
    const failed = routingControllerFailedSet(routing);
    const targetGame = routing.targetGame || currentDrop?.game || "";
    const targetCampaignKey = cleanText(routing.targetCampaignKey || currentDrop?.campaignKey || "");
    const targetCampaignName = routing.targetCampaign || currentDrop?.campaign || "";
    const allowedChannels = activeCampaignAllowedChannels();
    const allowedLogins = new Set(
      allowedChannels.map((channel) => cleanText(channel.login).toLowerCase()).filter(Boolean),
    );
    const allowListPresent = allowedLogins.size > 0;
    const targetSlug = resolveCategorySlug({
      game: targetGame,
      gameSlug: routing.targetSlug || currentDrop?.gameSlug || "",
    });

    const add = (href, label = "", metadata = {}) => {
      const channelHref = twitchChannelHref(href);
      if (!channelHref) return;
      try {
        const parsed = new URL(channelHref);
        const login = cleanText(parsed.pathname.split("/").filter(Boolean)[0]).toLowerCase();
        if (
          !login ||
          login.length < 2 ||
          seen.has(login) ||
          login === active ||
          failed.has(login) ||
          metadata.routable === false
        ) return;

        const cleanLabel = cleanText(label) || login;
        const candidateGame = cleanText(metadata.game || "");
        const candidateCampaignKey = cleanText(metadata.campaignKey || "");
        const allowListMatch = Boolean(login && allowedLogins.has(login));
        const dropsTagged = metadata.dropsTagged === true;
        if (allowListPresent && !allowListMatch && !dropsTagged) return;
        if (targetGame && (!candidateGame || !gameNamesMatch(targetGame, candidateGame))) return;
        if (targetCampaignKey && candidateCampaignKey && candidateCampaignKey !== targetCampaignKey) return;

        seen.add(login);
        const viewerMatch = cleanLabel.match(/([\d,.]+)\s*(?:viewers?|watching)/i);
        const viewers = metadata.viewers != null
          ? streamViewerCount(metadata.viewers)
          : (viewerMatch ? streamViewerCount(viewerMatch[1].replace(/,/g, "")) : null);
        const seenAt = Number(metadata.seenAt || now);
        const availability = metadata.availability || "cached";
        items.push({
          login,
          href: channelHref,
          label: metadata.label || cleanLabel || login,
          viewers,
          dropsTagged: Boolean(metadata.dropsTagged),
          allowListMatch: allowListPresent ? allowListMatch : Boolean(metadata.allowListMatch),
          game: candidateGame,
          campaignKey: candidateCampaignKey || targetCampaignKey,
          source: metadata.source || "cache",
          availability,
          seenAt,
          cacheAgeSeconds: availability === "live" ? 0 : Math.max(0, Math.floor((now - seenAt) / 1000)),
          freshCached: availability !== "live" && now - seenAt <= STANDBY_LIVE_FRESH_MS,
        });
      } catch (_) { /* ignore */ }
    };

    const onTargetCategory = Boolean(
      isDirectoryCategoryPage() &&
      targetSlug &&
      currentDirectorySlug() === targetSlug
    );

    if (onTargetCategory) {
      const snapshot = classifyRoutingCandidates(targetGame, targetSlug, routing, now);
      snapshot.candidates.forEach((item) =>
        add(item.href, item.label, {
          ...item,
          campaignKey: targetCampaignKey,
          source: item.source || "category-card",
          availability: "live",
          seenAt: now,
        })
      );
    }

    document.querySelectorAll(
      "[data-test-selector='DropsCampaignInProgressDescription-hint-text-parent'] a, " +
      "[data-test-selector='DropsCampaignInProgressDescription-no-channels-hint-text'] a"
    ).forEach((node) => {
      const cardText = cleanText(node.closest('[data-test-selector*="DropsCampaign"], [class*="drops-campaign"]')?.textContent || "");
      const matchesTarget = Boolean(
        (targetCampaignName && normalizeGameName(cardText).includes(normalizeGameName(targetCampaignName))) ||
        (targetGame && normalizeGameName(cardText).includes(normalizeGameName(targetGame)))
      );
      if (matchesTarget) {
        add(node.href, node.textContent, {
          dropsTagged: true,
          game: targetGame,
          campaignKey: targetCampaignKey,
          source: "campaign-hint",
          availability: "campaign-hint",
          seenAt: now,
        });
      }
    });

    cachedStandbyCandidates(targetGame, targetCampaignKey).forEach((item) =>
      add(item.href, item.label, {
        ...item,
        source: "cache",
        availability: "cached",
      })
    );

    const availabilityRank = (item) => {
      if (item.availability === "live") return 0;
      if (item.availability === "campaign-hint") return 1;
      if (item.freshCached) return 2;
      return 3;
    };

    const ranked = rankStreamCandidatesByEvidence(items, (a, b) => {
      const availabilityDiff = availabilityRank(a) - availabilityRank(b);
      if (availabilityDiff) return availabilityDiff;
      return Number(b.seenAt || 0) - Number(a.seenAt || 0);
    });

    return ranked.slice(0, Number(settings.queueCount) || 3);
  }

  function refreshQueueList() {
    lastQueueRefreshAt = Date.now();
    if (!ui) return;
    const list = ui.shadow.getElementById("tdh-queue-list");
    const summary = ui.shadow.getElementById("tdh-queue-summary");
    if (!list) return;
    list.replaceChildren();
    const active = watchingLogin();
    if (active) appendQueueItem(
      list,
      active,
      "Active",
      currentDrop ? (currentDrop.needsDropDetails ? "Details Pending" : `${currentDrop.percent || 0}%`) : "Watching",
      true,
    );
    const candidates = settings.queueEnabled ? discoverQueueCandidates() : [];
    candidates.forEach((item, index) => {
      const availability = item.availability === "live"
        ? "Live Now"
        : item.availability === "campaign-hint"
          ? "Campaign Hint"
          : item.freshCached
            ? `Cached ${item.cacheAgeSeconds}s`
            : `Cached ${Math.max(1, Math.ceil(item.cacheAgeSeconds / 60))}m`;
      const viewers = item.viewers != null ? ` · ${item.viewers} Viewers` : "";
      const proof = item.evidenceLabel === 'live-campaign-allowed' ? 'Campaign' : item.dropsTagged ? 'Drops' : item.freshCached ? 'Cached' : 'Standby';
      appendQueueItem(
        list,
        item.label,
        `Standby ${index + 1} · ${availability}${viewers}`,
        proof,
        false,
      );
    });
    if (!active && !candidates.length) appendQueueItem(list, "No Eligible Streams Found", "Open Drops Inventory To Discover Channels", "Idle", false);
    if (summary) {
      if (!settings.queueEnabled) {
        summary.textContent = " · Off";
      } else {
        const readyCount = (active ? 1 : 0) + candidates.length;
        summary.textContent = readyCount
          ? ` · ${readyCount} stream${readyCount === 1 ? "" : "s"} ready`
          : " · No streams ready";
      }
    }
  }

  function appendQueueItem(list, name, meta, state, active) {
    const row = document.createElement("div");
    row.className = `inventory-item${active ? " current" : ""}`;
    const thumb = document.createElement("div"); thumb.className = "reward-thumb"; thumb.textContent = active ? "▶" : "•";
    const copy = document.createElement("div"); copy.className = "reward-copy";
    const title = document.createElement("div"); title.className = "reward-name"; title.textContent = name;
    const sub = document.createElement("div"); sub.className = "reward-meta"; sub.textContent = meta;
    copy.append(title, sub);
    const badge = document.createElement("div"); badge.className = "reward-state"; badge.textContent = state;
    row.append(thumb, copy, badge); list.appendChild(row);
  }

  function renderCompactInventory() {
    if (!ui) return;
    const list = ui.shadow.getElementById("tdh-inventory-list");
    const game = ui.shadow.getElementById("tdh-inventory-game");
    if (!list) return;
    list.replaceChildren();
    if (game) game.textContent = currentDrop?.game ? ` · ${currentDrop.game}` : "";
    if (!currentDrop) {
      appendInventoryItem(list, "No Active Drop", "Waiting For Twitch", "Idle");
      return;
    }
    const current = Number(currentDrop.currentMinutes) || 0;
    const required = Number(currentDrop.requiredMinutes) || 0;
    const authoritativePercent = authoritativeProgressPercent();
    const state = currentDrop.needsDropDetails
      ? "Details Pending"
      : currentDrop.isClaimed
        ? "Claimed"
        : dropProgressComplete(currentDrop)
          ? "Claim Ready"
          : authoritativePercent == null ? "Progress Pending" : `${authoritativePercent}%`;
    appendInventoryItem(
      list,
      currentDrop.name || "Current Drop",
      currentDrop.needsDropDetails ? "Twitch Details Pending" : required ? `${current} / ${required} Min` : "Progress Pending",
      state,
    );
  }

  function refreshOpenCampaignList(now = Date.now()) {
    if (!ui) return;
    const list = ui.shadow.getElementById("tdh-open-campaign-list");
    const summary = ui.shadow.getElementById("tdh-open-campaign-summary");
    if (!list || !summary) return;
    refreshUnclaimedRewards(now);

    const openGames = listOpenCampaignGames(openCampaignManagementPool(now), now);
    reconcileIgnoredCampaignGames(openGames, now);
    const priorityOrder = reconcileCampaignPriorityOrder(openGames);
    const visiblePriorityOrder = priorityOrder.filter(key => openGames.some(item => normalizeGameName(item.game) === key));
    // The list shows the order Dropper will actually pick in. Under My Priority that is the rank order
    // you set with the arrows; under any other Campaign Order it is the order that strategy produces.
    const strategy = normalizedCampaignStrategy();
    const manualOrder = strategy === 'priority';
    const queueOrder = manualOrder ? [] : campaignQueueGameOrder(now);
    const position = (order, item) => {
      const index = order.indexOf(normalizeGameName(item.game));
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    openGames.sort((a, b) => {
      if (!manualOrder) {
        const byStrategy = position(queueOrder, a) - position(queueOrder, b);
        if (byStrategy) return byStrategy;
      }
      return position(visiblePriorityOrder, a) - position(visiblePriorityOrder, b);
    });
    const watchingKey = normalizeGameName(currentDrop?.game || '');
    const nextKey = campaignQueueGameOrder(now).find(key => key !== watchingKey) || '';
    const orderNote = ui.shadow.getElementById('tdh-campaign-order-note');
    if (orderNote) {
      orderNote.textContent = manualOrder
        ? 'Check a game to ignore it until its latest campaign ends. Use ↑ and ↓ to rank games. With automatic switching on, Dropper moves to the top game right away unless playback is paused or you locked the stream.'
        : `Games are listed in the order Dropper picks them under ${campaignStrategyLabel(strategy)}. Choose My Priority to rank games with ↑ and ↓. With automatic switching on, Dropper moves to the top game right away unless playback is paused or you locked the stream.`;
    }
    const ignoredCount = openGames.filter((item) => (
      Number(ignoredCampaignGames.games?.[item.key]?.expiresAt || 0) > now
    )).length;
    summary.textContent = openGames.length
      ? `${openGames.length} game${openGames.length === 1 ? "" : "s"}${ignoredCount ? ` · ${ignoredCount} ignored` : ""}`
      : "No open games";

    list.replaceChildren();
    const plannerText = openGames.length ? campaignPlannerText(now) : "";
    if (plannerText) {
      const planner = document.createElement("div");
      planner.className = "campaign-manager-note";
      planner.id = "tdh-campaign-planner";
      planner.textContent = plannerText;
      list.appendChild(planner);
    }
    let subscriptionRewards = new Map();
    try { subscriptionRewards = subscriptionRewardsByGame(openCampaignManagementPool(now), ignoredCampaignGameKey); } catch { /* optional detail */ }
    if (!openGames.length) {
      const empty = document.createElement("div");
      empty.className = "campaign-manager-note";
      empty.textContent = lastGqlError
        ? "Campaign data is temporarily unavailable. Dropper will retry automatically."
        : "No dated open campaigns are available yet. Dropper will refresh this list automatically.";
      list.appendChild(empty);
      return;
    }

    for (const item of openGames) {
      const ignored = Number(ignoredCampaignGames.games?.[item.key]?.expiresAt || 0) > now;
      const row = document.createElement("div");
      row.className = "campaign-game-row";
      const copy = document.createElement("div");
      copy.className = "campaign-game-copy";
      const title = document.createElement("div");
      title.className = "campaign-game-name";
      title.textContent = item.game;
      const meta = document.createElement("div");
      meta.className = "campaign-game-meta";
      const campaignLabel = `${item.campaignCount} open campaign${item.campaignCount === 1 ? "" : "s"}`;
      const subscriptionText = subscriptionRewardText(subscriptionRewards.get(item.key));
      const gameKey = normalizeGameName(item.game);
      const orderLabel = gameKey && gameKey === watchingKey ? 'Watching now · ' : gameKey && gameKey === nextKey && !ignored ? 'Next up · ' : '';
      meta.textContent = `${orderLabel}${campaignLabel} · Latest ${formatCampaignEndLabel(item.latestEndAt, item.latestEndMs, now).toLowerCase()}${subscriptionText ? ` · ${subscriptionText}` : ""}`;
      copy.append(title, meta);
      const rank = manualOrder ? visiblePriorityOrder.indexOf(normalizeGameName(item.game)) : openGames.indexOf(item);
      const priorityControls = document.createElement('div');
      priorityControls.className = 'campaign-priority-controls';
      const priorityRank = document.createElement('span');
      priorityRank.className = 'campaign-priority-rank';
      priorityRank.textContent = rank >= 0 ? `#${rank + 1}` : '—';
      const up = document.createElement('button');
      up.type = 'button'; up.className = 'campaign-priority-button'; up.textContent = '↑';
      up.disabled = !manualOrder || rank <= 0;
      up.setAttribute('aria-label', `Move ${item.game} higher in game priority`);
      if (!manualOrder) up.title = 'Choose My Priority as the Campaign Order to rank games by hand';
      const down = document.createElement('button');
      down.type = 'button'; down.className = 'campaign-priority-button'; down.textContent = '↓';
      down.disabled = !manualOrder || rank < 0 || rank >= openGames.length - 1;
      down.setAttribute('aria-label', `Move ${item.game} lower in game priority`);
      if (!manualOrder) down.title = 'Choose My Priority as the Campaign Order to rank games by hand';
      up.addEventListener('click', () => {
        if (!moveCampaignPriority(item.game, -1, openGames)) return;
        const moved = applyCampaignOrderNow('campaign-priority-changed');
        if (!moved.switched) routingControllerTick(Date.now(), 'campaign-priority-changed');
        setStatus(`${item.game} moved higher in game priority${moved.switched ? ` · Switching to ${moved.game}` : moved.why ? ` · Current Stream Unchanged (${moved.why})` : ''}`);
        refreshOpenCampaignList();
      });
      down.addEventListener('click', () => {
        if (!moveCampaignPriority(item.game, 1, openGames)) return;
        const moved = applyCampaignOrderNow('campaign-priority-changed');
        if (!moved.switched) routingControllerTick(Date.now(), 'campaign-priority-changed');
        setStatus(`${item.game} moved lower in game priority${moved.switched ? ` · Switching to ${moved.game}` : moved.why ? ` · Current Stream Unchanged (${moved.why})` : ''}`);
        refreshOpenCampaignList();
      });
      priorityControls.append(priorityRank, up, down); copy.append(priorityControls);

      const check = document.createElement("button");
      check.type = "button";
      check.className = "campaign-ignore-check";
      check.setAttribute("role", "checkbox");
      check.setAttribute("aria-checked", String(ignored));
      check.setAttribute(
        "aria-label",
        `${ignored ? "Stop ignoring" : "Ignore"} ${item.game} until ${new Date(item.latestEndMs).toLocaleString()}`,
      );
      check.title = ignored ? "Stop Ignoring This Game" : "Ignore This Game";
      check.addEventListener("click", () => {
        const nextIgnored = check.getAttribute("aria-checked") !== "true";
        if (!setCampaignGameIgnored(item.game, item.latestEndMs, nextIgnored)) return;
        logActivity(
          nextIgnored ? "campaign-game-ignored" : "campaign-game-restored",
          `${item.game} ${nextIgnored ? "ignored until its latest campaign ends" : "restored to campaign routing"}`,
          { game: item.game, expiresAt: nextIgnored ? new Date(item.latestEndMs).toISOString() : null },
        );

        if (nextIgnored && currentDrop && gameNamesMatch(currentDrop.game || "", item.game)) {
          clearStoredCurrentDrop();
          transitionRoutingController(
            ROUTING_STATES.SELECT_CAMPAIGN,
            { targetGame: "", targetCampaign: "", targetCampaignKey: "", targetDropId: "", targetStream: "", deadlineAt: 0 },
            `${item.game} ignored by user`,
          );
        } else if (!nextIgnored) {
          const routing = readRoutingControllerSession();
          if (routing.state === ROUTING_STATES.WAITING && routing.waitReason === "no-eligible-campaign") {
            transitionRoutingController(ROUTING_STATES.SELECT_CAMPAIGN, { deadlineAt: 0 }, `${item.game} restored by user`);
          }
        }

        refreshOpenCampaignList();
        queueGqlPollSoon("campaign-ignore-changed", 0);
        routingControllerTick(Date.now(), "campaign-ignore-changed");
      });
      row.append(copy, check);
      list.appendChild(row);
    }
  }

  function appendInventoryItem(list, name, meta, state) {
    const row = document.createElement("div"); row.className = "inventory-item current";
    const thumb = document.createElement("div"); thumb.className = "reward-thumb"; thumb.textContent = "◆";
    const copy = document.createElement("div"); copy.className = "reward-copy";
    const title = document.createElement("div"); title.className = "reward-name"; title.textContent = name;
    const sub = document.createElement("div"); sub.className = "reward-meta"; sub.textContent = meta;
    copy.append(title, sub);
    const badge = document.createElement("div"); badge.className = "reward-state"; badge.textContent = state;
    row.append(thumb, copy, badge); list.appendChild(row);
  }

  function applyProgressColor(percent) {
    if (!ui) return;
    const fill = ui.shadow.getElementById("tdh-drop-fill");
    const pct = ui.shadow.getElementById("tdh-drop-percent");
    const ring = ui.shadow.getElementById("tdh-ring");
    let main = "#dc2626", soft = "#fb7185";
    if (percent >= 90) { main = "#16a34a"; soft = "#4ade80"; }
    else if (percent >= 70) { main = "#65a30d"; soft = "#a3e635"; }
    else if (percent >= 50) { main = "#ca8a04"; soft = "#facc15"; }
    else if (percent >= 25) { main = "#ea580c"; soft = "#fb923c"; }
    const pride = ui.cluster?.dataset?.uiTheme === "pride";
    if (fill) fill.style.background = pride ? PRIDE_RAINBOW : `linear-gradient(90deg, ${main}, ${soft})`;
    if (pct) pct.style.color = pride ? "#d8dbe1" : soft;
    if (ring) ring.style.stroke = pride ? "#d97898" : main;
  }

  let browserBackgroundSince = 0;
  let browserForegroundRestoredAt = 0;

  function browserAttentionSnapshot(now = Date.now()) {
    const visibilityState = document.visibilityState || (document.hidden ? 'hidden' : 'visible');
    let documentFocused = !document.hidden;
    try {
      if (typeof document.hasFocus === 'function') documentFocused = document.hasFocus();
    } catch (_) {}
    const backgrounded = Boolean(document.hidden || !documentFocused);

    if (backgrounded) {
      if (!browserBackgroundSince) browserBackgroundSince = now;
    } else if (browserBackgroundSince) {
      browserBackgroundSince = 0;
      browserForegroundRestoredAt = now;
    }

    const foregroundGraceRemainingMs = !backgrounded && browserForegroundRestoredAt
      ? Math.max(0, FOREGROUND_REVALIDATION_GRACE_MS - (now - browserForegroundRestoredAt))
      : 0;

    return {
      visibilityState,
      documentFocused,
      backgrounded,
      backgroundSince: browserBackgroundSince,
      foregroundRestoredAt: browserForegroundRestoredAt,
      foregroundGraceRemainingMs,
    };
  }

  function currentStreamTimingSnapshot(now = Date.now()) {
    const routing = readRoutingControllerSession();
    const login = cleanText(watchingLogin()).toLowerCase();
    const target = cleanText(routing.targetStream).toLowerCase();
    const targetMatches = Boolean(login && (!target || login === target));

    let streamAnchorAt = 0;
    if (targetMatches) {
      if (routing.state === ROUTING_STATES.EARNING) {
        streamAnchorAt = Number(routing.earningStartedAt || routing.enteredAt || 0);
      } else if (
        routing.state === ROUTING_STATES.VERIFY_STREAM ||
        routing.state === ROUTING_STATES.OPEN_STREAM
      ) {
        streamAnchorAt = Number(routing.enteredAt || 0);
      }
    }

    const verificationAt = (
      lastStreamVerification &&
      login &&
      cleanText(lastStreamVerification.channel).toLowerCase() === login
    )
      ? Number(lastStreamVerification.at || 0)
      : 0;

    const creditedProgressAt = Number(lastProgressAt || 0);
    const effectiveAnchorAt = Math.max(streamAnchorAt, verificationAt, creditedProgressAt);

    // First-watch grace belongs to the routing/stream lifecycle. Routine GQL
    // session confirmations may refresh lastStreamVerification, but must not
    // restart the grace clock after the stream has already been established.
    const viewing = viewingIntent.snapshot();
    const manualAnchorAt = viewing.manualStream && cleanText(viewing.channel).toLowerCase() === login
      ? Number(viewing.changedAt || 0) : 0;
    const graceAnchorAt = streamAnchorAt || manualAnchorAt || verificationAt;
    const graceAnchorSource = streamAnchorAt ? "routing-stream" : manualAnchorAt ? "manual-stream" : verificationAt ? "verification-fallback" : null;
    const graceRemainingMs = graceAnchorAt
      ? Math.max(0, FIRST_WATCH_CREDIT_GRACE_MS - (now - graceAnchorAt))
      : 0;

    return {
      routingState: routing.state,
      streamAnchorAt,
      verificationAt,
      creditedProgressAt,
      effectiveAnchorAt,
      effectiveProgressAgeMs: effectiveAnchorAt ? Math.max(0, now - effectiveAnchorAt) : 0,
      creditedProgressAgeMs: creditedProgressAt ? Math.max(0, now - creditedProgressAt) : 0,
      graceAnchorAt,
      graceAnchorSource,
      graceRemainingMs,
      inVerificationGrace: Boolean(graceRemainingMs > 0),
    };
  }

  function streamEarningHealthSnapshot() {
    const now = Date.now();
    const attention = browserAttentionSnapshot(now);
    const login = watchingLogin();
    const info = login ? readStreamInfo() : {
      live: false,
      game: "",
      dropsEnabled: false,
    };

    const domVideoPlaying = Boolean(login && streamVideoIsPlaying());

    const gameMatches = Boolean(
      currentDrop?.game &&
      info.game &&
      gameNamesMatch(currentDrop.game, info.game)
    );

    const verification = lastStreamVerification;
    const verificationProof = verification?.proof || {};
    const currentCampaignKey = cleanText(currentDrop?.campaignKey || currentDrop?.campaignId || "");
    const verifiedCampaignKey = cleanText(verification?.campaignKey || "");
    const routing = readRoutingControllerSession();
    const routingEvidence = routing.candidateEvidence || {};
    const routingCampaignKey = cleanText(routing.targetCampaignKey || "");
    const routingStreamMatches = Boolean(
      login &&
      routing.state === ROUTING_STATES.EARNING &&
      cleanText(routing.targetStream).toLowerCase() === cleanText(login).toLowerCase() &&
      (!currentCampaignKey || !routingCampaignKey || currentCampaignKey === routingCampaignKey)
    );
    const restoredRoutingProof = Boolean(
      routingStreamMatches &&
      (
        routingEvidence.gqlCampaignSupported ||
        routingEvidence.gqlSessionCampaignMatched ||
        routingEvidence.campaignAclMatched
      )
    );
    const campaignVerified = Boolean(
      (
        login &&
        verification &&
        cleanText(verification.channel).toLowerCase() === cleanText(login).toLowerCase() &&
        (!verification.game || !currentDrop?.game || gameNamesMatch(verification.game, currentDrop.game)) &&
        (!currentCampaignKey || !verifiedCampaignKey || currentCampaignKey === verifiedCampaignKey) &&
        (verificationProof.campaignSupported || verificationProof.progressConfirmed || verificationProof.sessionMatched)
      ) ||
      restoredRoutingProof
    );
    const timing = currentStreamTimingSnapshot(now);
    const creditedRecently = Boolean(
      campaignVerified &&
      Number(timing.creditedProgressAt || 0) > 0 &&
      Number(currentDrop?.currentMinutes || 0) > 0 &&
      timing.creditedProgressAgeMs <= UNHEALTHY_STREAM_DELAYED_MS
    );
    const viewing = viewingIntent.snapshot();
    const manualEarningVerified = Boolean(
      viewing.manualStream && !viewing.paused && domVideoPlaying &&
      creditedRecently && verificationProof.progressConfirmed
    );
    const earningVerified = Boolean(
      (routingStreamMatches || manualEarningVerified) &&
      campaignVerified &&
      gameMatches
    );
    const healthy = Boolean(
      login &&
      currentDrop &&
      campaignVerified &&
      (
        (
          info.live &&
          domVideoPlaying &&
          gameMatches
        ) ||
        creditedRecently
      )
    );

    const result = {
      login: login || null,
      live: Boolean(info.live),
      domVideoPlaying,
      domVideoPlayingAuthoritative: false,
      creditedRecently,
      earningVerified,
      expectedGame: currentDrop?.game || null,
      streamGame: info.game || null,
      gameMatches,
      campaignVerified,
      restoredRoutingProof,
      dropsTagVisible: Boolean(info.dropsEnabled),
      healthy,
      routingState: timing.routingState,
      visibilityState: attention.visibilityState,
      documentFocused: attention.documentFocused,
      backgrounded: attention.backgrounded,
      backgroundSince: attention.backgroundSince,
      foregroundRestoredAt: attention.foregroundRestoredAt,
      foregroundGraceRemainingMs: attention.foregroundGraceRemainingMs,
      paused: Boolean(viewing.paused),
      pauseReason: viewing.pauseReason || '',
      playback: viewing.playback || (domVideoPlaying ? 'playing' : 'unknown'),
      inVerificationGrace: timing.inVerificationGrace,
      graceAnchorAt: timing.graceAnchorAt,
      graceAnchorSource: timing.graceAnchorSource,
      graceRemainingMs: timing.graceRemainingMs,
      creditedProgressAgeMs: timing.creditedProgressAgeMs,
      progressAgeMs: timing.effectiveProgressAgeMs,
    };
    result.recovery = DropperActiveViewing.recoveryDiagnosis(result, {
      delayedMs: healthy ? HEALTHY_STREAM_DELAYED_MS : UNHEALTHY_STREAM_DELAYED_MS,
      stalledMs: progressStallTimeoutMs(healthy),
    });
    return result;
  }

  function briefAge(ms) {
    const value = Math.max(0, Number(ms) || 0);
    const seconds = Math.floor(value / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h`;
  }

  function earningConfidencePresentation(health = streamEarningHealthSnapshot(), eligibility = activeRewardEligibility()) {
    if (!currentDrop) return { label: 'No active Drop', detail: 'Waiting for Twitch campaign progress.', tone: 'muted' };
    const blockedCodes = new Set(['account-link','participation','expired','paid-requirement','deadline-risk']);
    if (blockedCodes.has(eligibility?.code)) {
      return { label: 'Not eligible', detail: eligibility?.label || eligibility?.detail || 'Current reward is blocked.', tone: 'bad' };
    }
    if (eligibility?.code === 'wrong-game' || health?.recovery?.code === 'wrong-game') {
      return { label: 'Wrong category', detail: health?.streamGame ? `Stream is in ${health.streamGame}.` : 'The stream category does not match the current Drop.', tone: 'warn' };
    }
    if (health?.recovery?.code === 'credit-stalled') {
      return { label: 'Progress stalled', detail: health.creditedProgressAgeMs ? `Last Twitch credit ${briefAge(health.creditedProgressAgeMs)} ago.` : 'Twitch has not credited new progress.', tone: 'bad' };
    }
    if (health?.earningVerified) {
      return { label: 'Verified', detail: health.creditedProgressAgeMs ? `Last Twitch credit ${briefAge(health.creditedProgressAgeMs)} ago.` : 'Campaign and stream evidence are verified.', tone: 'good' };
    }
    if (health?.inVerificationGrace || eligibility?.code === 'verification-pending' || eligibility?.code === 'unknown') {
      return { label: 'Waiting for Twitch', detail: 'Dropper is waiting for campaign or credited-progress evidence.', tone: 'warn' };
    }
    if (health?.login && health?.live === false) return { label: 'Stream offline', detail: 'The current channel is not reporting as live.', tone: 'bad' };
    return { label: 'Not verified', detail: eligibility?.detail || 'Earning evidence is not yet verified.', tone: 'muted' };
  }

  function appendStatusCheck(list, label, value, tone = 'muted') {
    const row = document.createElement('div');
    row.className = 'status-check-row';
    const key = document.createElement('span');
    key.className = 'status-check-label';
    key.textContent = label;
    const state = document.createElement('span');
    state.className = 'status-check-value';
    state.dataset.tone = tone;
    state.textContent = value;
    row.append(key, state);
    list.append(row);
  }

  function refreshStreamHealthSummary() {
    const list = ui?.shadow?.getElementById('tdh-stream-health-list');
    const summary = ui?.shadow?.getElementById('tdh-stream-health-summary');
    const confidence = ui?.shadow?.getElementById('tdh-earning-confidence');
    const confidenceLabel = ui?.shadow?.getElementById('tdh-earning-confidence-label');
    const confidenceDetail = ui?.shadow?.getElementById('tdh-earning-confidence-detail');
    if (!list || !summary || !confidence || !confidenceLabel || !confidenceDetail) return;
    const health = streamEarningHealthSnapshot();
    const eligibility = activeRewardEligibility();
    const presentation = earningConfidencePresentation(health, eligibility);
    confidence.dataset.tone = presentation.tone;
    confidenceLabel.textContent = presentation.label;
    confidenceDetail.textContent = presentation.detail;
    summary.textContent = presentation.label;
    list.replaceChildren();
    appendStatusCheck(list, 'Channel', health.login || 'No stream', health.login ? 'good' : 'muted');
    appendStatusCheck(list, 'Online', health.login ? (health.live ? '✓ Online' : '? Not verified live') : '? Unknown', health.live ? 'good' : 'warn');
    appendStatusCheck(list, 'Playback', health.playback === 'playing' ? '✓ Playing' : health.playback || '? Unknown', health.playback === 'playing' ? 'good' : health.paused ? 'warn' : 'muted');
    appendStatusCheck(list, 'Correct game', !health.expectedGame || !health.streamGame ? '? Unknown' : health.gameMatches ? '✓ Yes' : `× ${health.streamGame}`, health.gameMatches ? 'good' : health.streamGame ? 'bad' : 'muted');
    appendStatusCheck(list, 'Campaign evidence', health.campaignVerified ? '✓ Verified' : '? Waiting', health.campaignVerified ? 'good' : 'warn');
    appendStatusCheck(list, 'Last credited', Number(currentDrop?.currentMinutes || 0) > 0 && health.creditedProgressAgeMs >= 0 ? `${briefAge(health.creditedProgressAgeMs)} ago` : 'No credited minute yet', Number(currentDrop?.currentMinutes || 0) > 0 ? 'good' : 'muted');
  }

  function refreshEligibilityChecklist() {
    const list = ui?.shadow?.getElementById('tdh-eligibility-checklist-list');
    const summary = ui?.shadow?.getElementById('tdh-eligibility-checklist-summary');
    if (!list || !summary) return;
    list.replaceChildren();
    const campaign = findCampaignForDrop(lastInventoryCampaigns, currentDrop) || findCampaignForDrop(lastCampaignCatalog, currentDrop);
    const raw = (campaign?.timeBasedDrops || campaign?.drops || []).find(drop => drop.id === currentDrop?.id);
    const health = streamEarningHealthSnapshot();
    const now = Date.now();
    const window = campaign ? campaignWindow(campaign, raw) : { startMs: 0, endMs: 0 };
    const accountConnected = typeof campaign?.self?.isAccountConnected === 'boolean'
      ? campaign.self.isAccountConnected
      : typeof campaign?.isAccountConnected === 'boolean'
        ? campaign.isAccountConnected
        : null;
    const campaignActive = window.startMs && window.endMs
      ? now >= window.startMs && now < window.endMs
      : null;
    const rewardAvailable = raw
      ? raw.self?.isClaimed === true ? 'claimed' : true
      : null;
    const gameKnown = Boolean(health.expectedGame && health.streamGame);
    const checks = [
      ['Account linked', accountConnected === null ? '? Unknown' : accountConnected ? '✓ Linked' : '× Not linked', accountConnected === null ? 'muted' : accountConnected ? 'good' : 'bad'],
      ['Campaign active', campaignActive === null ? '? Unknown' : campaignActive ? '✓ Active' : '× Not active', campaignActive === null ? 'muted' : campaignActive ? 'good' : 'bad'],
      ['Reward available', rewardAvailable === null ? '? Unknown' : rewardAvailable === 'claimed' ? '✓ Already claimed' : '✓ Available', rewardAvailable === null ? 'muted' : 'good'],
      ['Correct game', !gameKnown ? '? Unknown' : health.gameMatches ? '✓ Match' : '× Mismatch', !gameKnown ? 'muted' : health.gameMatches ? 'good' : 'bad'],
      ['Stream verified', health.campaignVerified ? '✓ Verified' : '? Waiting', health.campaignVerified ? 'good' : 'warn'],
    ];
    for (const [label, value, tone] of checks) appendStatusCheck(list, label, value, tone);
    const failures = checks.filter(([, value]) => String(value).startsWith('×')).length;
    const unknowns = checks.filter(([, value]) => String(value).startsWith('?')).length;
    summary.textContent = failures ? `${failures} blocked` : unknowns ? `${unknowns} unknown` : 'Ready';
  }

  function recoveryActionState() {
    const health = streamEarningHealthSnapshot();
    const eligibility = activeRewardEligibility();
    const viewing = viewingIntent.snapshot();
    if (viewing.paused) return { action: 'resume', label: 'Resume Playback' };
    if (eligibility?.code === 'account-link') return { action: 'connections', label: 'Open Connections' };
    if (manualStreamLockSnapshot() && health?.recovery?.code === 'credit-stalled') return { action: 'unlock', label: 'Release Stream Lock' };
    if (
      ['wrong-game','wrong-channel'].includes(eligibility?.code) ||
      ['offline','wrong-game','playback-error','playback-stopped','credit-stalled'].includes(health?.recovery?.code)
    ) return { action: 'find-stream', label: 'Find Another Stream' };
    if (!health.login && currentDrop) return { action: 'find-stream', label: 'Find Eligible Stream' };
    if (['verification-pending','unknown'].includes(eligibility?.code)) return { action: 'recheck', label: 'Recheck Twitch' };
    return null;
  }

  function refreshRecoveryAction() {
    const button = ui?.shadow?.getElementById('tdh-recovery-action');
    if (!button) return;
    const state = recoveryActionState();
    // Resume Playback already has its own button above; do not repeat it here.
    button.hidden = !state || state.action === 'resume';
    button.dataset.action = state?.action || '';
    button.textContent = state?.label || 'Recheck Twitch';
  }

  function syncCompactState() {
    if (!ui) return;
    const reward = ui.shadow.getElementById("tdh-compact-reward");
    const extra = ui.shadow.getElementById("tdh-compact-extra");
    const state = ui.shadow.getElementById("tdh-compact-state");
    const detail = ui.shadow.getElementById("tdh-drop-state");
    const updated = ui.shadow.getElementById("tdh-updated-ago");
    const health = streamEarningHealthSnapshot();
    const staleMs = health.progressAgeMs;

    let label = "Idle", cls = "state-pill";
    const routing = readRoutingControllerSession();

    if (!getToken()) {
      label = "Login Required";
      cls += " warn";
    } else if (viewingIntent.snapshot().paused) {
      label = 'Paused';
      cls += ' warn';
    } else if (currentDrop?.needsDropDetails) {
      label = "Details Pending";
      cls += " warn";
    } else if (dropProgressComplete(currentDrop)) {
      label = currentDrop.isClaimed ? "Claimed ✓" : "Earned";
      cls += " good";
    } else if (routing.state === ROUTING_STATES.VERIFY_STREAM) {
      label = "Verifying";
      cls += " warn";
    } else if (routing.state === ROUTING_STATES.OPEN_STREAM) {
      label = "Opening";
      cls += " warn";
    } else if (routing.state === ROUTING_STATES.FIND_STREAM) {
      label = "Finding";
      cls += " warn";
    } else if (routing.state === ROUTING_STATES.WAITING) {
      label = "Waiting";
      cls += " warn";
    } else if ((routing.state === ROUTING_STATES.EARNING || health.earningVerified) && currentDrop) {
      const recoveryCode = health.recovery?.code || "healthy";
      if (health.inVerificationGrace) {
        label = settings.backgroundEarning ? "BG Earning" : "Earning";
        cls += " good";
      } else if (recoveryCode === "credit-delayed-background") {
        label = "BG Delayed";
        cls += " warn";
      } else if (recoveryCode === "foreground-revalidation-grace") {
        label = "Rechecking";
        cls += " warn";
      } else if (recoveryCode === "credit-stalled") {
        label = "Stalled";
        cls += " bad";
      } else if (recoveryCode === "credit-delayed" || recoveryCode === "buffering") {
        label = "Delayed";
        cls += " warn";
      } else {
        label = settings.backgroundEarning ? "BG Earning" : "Earning";
        cls += " good";
      }
    } else if (currentDrop) {
      label = "Waiting";
    }

    if (reward) reward.textContent = currentDrop?.name || "Waiting For Drop";
    const watched = watchClock.elapsed ? formatClock(watchClock.elapsed) : "";
    if (extra) extra.textContent = currentDrop
      ? currentDrop.needsDropDetails
        ? `Details Pending${watched ? ` · ${watched}` : ""}`
        : `${authoritativeProgressPercent() ?? "—"}% · ${Math.max(0, currentDrop.remainingMinutes || 0)}m${watched ? ` · ${watched}` : ""}`
      : "";

    const panelWidthMode = normalizedCollapsedPanelWidth();
    const narrowStatusLabels = {
      "Login Required": "Login",
      "Details Pending": "Details",
      "Claimed ✓": "Claimed",
      "Verifying": "Verify",
      "Opening": "Open",
      "Finding": "Find",
      "Waiting": "Wait",
      "BG Earning": "BG Earn",
      "BG Delayed": "BG Delay",
      "Rechecking": "Recheck",
      "Earning": "Earn",
      "Stalled": "Stalled",
      "Delayed": "Delayed",
      "Earned": "Earned",
      "Idle": "Idle",
    };
    const compactStatusLabels = {
      "Login Required": "Login",
      "Details Pending": "Details",
    };
    const detailLabel = panelWidthMode === "narrow"
      ? (narrowStatusLabels[label] || label)
      : panelWidthMode === "compact"
        ? (compactStatusLabels[label] || label)
        : label;

    if (state) {
      state.textContent = label;
      state.className = cls;
    }
    if (detail) {
      detail.textContent = detailLabel;
      detail.className = cls;
      detail.title = label;
      detail.setAttribute("aria-label", label);
    }

    if (updated) {
      const checkedAgeSeconds = lastCheckedAt
        ? Math.max(0, Math.floor((Date.now() - lastCheckedAt) / 1000))
        : null;
      const checkedAgeLabel = checkedAgeSeconds == null
        ? ""
        : checkedAgeSeconds < 60
          ? `${checkedAgeSeconds}s`
          : checkedAgeSeconds < 3600
            ? `${Math.floor(checkedAgeSeconds / 60)}m`
            : `${Math.floor(checkedAgeSeconds / 3600)}h`;
      const fullCheckedLabel = currentDrop && checkedAgeLabel
        ? `Checked ${checkedAgeLabel} ago`
        : "Checked —";
      updated.textContent = panelWidthMode === "full"
        ? fullCheckedLabel
        : (currentDrop && checkedAgeLabel ? checkedAgeLabel : "—");
      updated.title = fullCheckedLabel;
      updated.setAttribute("aria-label", fullCheckedLabel);
      updated.className = "progress-age";
    }

    renderSkipStreamerControl();

    const dot = ui.shadow.getElementById("tdh-compact-dot");
    if (dot) {
      dot.style.background =
        label === "Stalled" ? "#ef4444" :
        label === "Delayed" ? "#f59e0b" :
        label.includes("Earning") || label.includes("Claim") ? "#22c55e" :
        "#9147ff";
    }
  }

  function applyMotionSetting() {
    ui?.cluster?.classList.toggle("reduce-motion", Boolean(settings.reduceMotion));
  }

  function normalizedCollapsedPanelWidth(value = settings.collapsedPanelWidth) {
    const normalized = cleanText(value).toLowerCase();
    return "compact";
  }

  function calculatedPanelWidth(mode = normalizedCollapsedPanelWidth()) {
    if (mode === "narrow") return 220;
    if (mode === "compact") return 260;
    const style = getComputedStyle(ui.cluster);
    const full = parseFloat(style.getPropertyValue("--exp-menu-width")) || parseFloat(style.getPropertyValue("--dropper-width")) || 312;
    return Math.max(280, Math.min(full, 340));
  }

  function normalizedOpacityPercent(value = settings.opacityPercent) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 85;
    return Math.max(40, Math.min(100, Math.round(numeric / 5) * 5));
  }

  function syncProgressPanelPlacement() {
    if (!ui) return;
    const card = ui.shadow.getElementById("tdh-drop-card");
    const menuSlot = ui.shadow.getElementById("tdh-badge-only-progress-slot");
    const badgeRow = ui.shadow.querySelector(".badge-row");
    if (!card || !menuSlot || !badgeRow || !ui.launcher) return;
    if (settings.badgeOnly) {
      menuSlot.hidden = false;
      if (card.parentElement !== menuSlot) menuSlot.append(card);
      card.dataset.presentation = "menu-card";
    } else {
      menuSlot.hidden = true;
      if (card.parentElement !== badgeRow) badgeRow.insertBefore(card, ui.launcher);
      card.dataset.presentation = "page-card";
    }
  }

  function applyAppearanceSettings() {
    if (!ui) return;
    const legacyThemeAliases = { warm:"ember", discord:"glacier", pine:"verdant", obsidian:"contrast" };
    settings.uiTheme = legacyThemeAliases[settings.uiTheme] || settings.uiTheme;
    const theme = UI_THEMES.find((item) => item.id === settings.uiTheme) || UI_THEMES.at(-1);
    settings.uiTheme = theme.id;
    for (const key of ["bg", "panel", "line", "text", "muted", "accent", "accent2"]) ui.cluster.style.setProperty(`--theme-${key}`, theme[key]);
    const semantic = semanticTheme(theme);
    ExtraPotionsCore.publishMenuPalette?.(ui.host, semantic);
    for (const key of ["raised", "inset", "link", "focus", "onAccent"]) ui.cluster.style.setProperty(`--theme-${key}`, semantic[key]);
    ExtraPotionsCore.publishMenuPalette?.(ui.host, { ...theme, ...semantic });
    ui.cluster.style.setProperty("--theme-skin", theme.skin || theme.swatch);
    ui.cluster.style.setProperty("--theme-skin-vertical", theme.skinVertical || theme.skin || theme.swatch);
    ui.cluster.dataset.uiTheme = theme.id;
    ui.cluster.dataset.themeSkin = theme.skinMode === "flat" ? "flat" : "gradient";
    settings.opacityPercent = normalizedOpacityPercent();
    const appliedOpacity = settings.customOpacity ? settings.opacityPercent / 100 : 1;
    ui.cluster.style.setProperty("--exp-ui-opacity", String(appliedOpacity));
    ui.cluster.style.setProperty("--dropper-ui-opacity", String(appliedOpacity));
    ui.cluster.dataset.customOpacity = settings.customOpacity ? "true" : "false";
    ui.cluster.dataset.opacityPercent = String(settings.opacityPercent);
    const opacityRow = ui.shadow.getElementById("tdh-opacity-row");
    const opacityRange = ui.shadow.getElementById("tdh-opacity-range");
    const opacityValue = ui.shadow.getElementById("tdh-opacity-value");
    if (opacityRow) opacityRow.hidden = !settings.customOpacity;
    if (opacityRange) {
      opacityRange.value = String(settings.opacityPercent);
      opacityRange.setAttribute("aria-valuenow", String(settings.opacityPercent));
      opacityRange.setAttribute("aria-valuetext", settings.opacityPercent + "%");
    }
    if (opacityValue) opacityValue.textContent = settings.opacityPercent + "%";
    ui.shadow.querySelectorAll(".exp-theme-swatch").forEach((button) => {
      const active = button.dataset.theme === theme.id;
      button.classList.toggle("is-on", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const stack = ui.shadow.querySelector(".progress-stack");
    if (!stack) return;
    const width = normalizedCollapsedPanelWidth();
    stack.dataset.collapsedWidth = width;
    stack.classList.toggle("badge-only", Boolean(settings.badgeOnly));
    syncProgressPanelPlacement();
    ui.cluster.dataset.panelWidth = width;
    ui.cluster.dataset.badgeOnly = settings.badgeOnly ? "true" : "false";
    requestAnimationFrame(layoutChrome);
  }

  function isAutoSwitchPaused() {
    const now = Date.now();
    if (pauseAutoSwitchUntil > now) return true;

    if (pauseAutoSwitchUntil || settings.pauseAutoSwitchMinutes || settings.pauseAutoSwitchUntil) {
      pauseAutoSwitchUntil = 0;
      settings.pauseAutoSwitchMinutes = 0;
      settings.pauseAutoSwitchUntil = 0;
      try { persistSettingsSnapshot(); } catch (_) { /* ignore */ }

      const select = ui?.shadow?.getElementById("tdh-pause-switch");
      if (select) select.value = "0";
    }
    return false;
  }

  function refreshTwitchAuthStatus() {
    const authRequired = ui?.shadow?.getElementById("tdh-auth-required");
    const loginButton = ui?.shadow?.getElementById("tdh-twitch-login");
    const loggedIn = isTwitchLoggedIn();

    if (authRequired) authRequired.hidden = loggedIn;
    if (loginButton) {
      loginButton.hidden = loggedIn;
      loginButton.textContent = "Open Twitch Login";
      loginButton.classList.toggle("last-opened", !loggedIn);
    }
    requestAnimationFrame(layoutChrome);
  }


  function waitingExplanation(health, hasDrop, switching) {
    if (health.creditedRecently) return 'Twitch recently credited progress. A delayed page or video signal does not mean earning stopped.';
    if (!hasDrop) return 'No active reward is selected. Open the campaign list and choose an eligible campaign.';
    if (health.paused) return 'Playback is paused or needs your attention. Use Resume playback when you are ready.';
    if (!health.login) return switching ? 'Waiting for an eligible stream to open.' : 'Open an eligible stream, or enable automatic switching.';
    if (!health.campaignVerified) return 'Checking whether this stream qualifies for the selected campaign. A Drops tag alone is not confirmation.';
    if (!health.gameMatches) return 'The stream category does not match the selected reward.';
    if (health.inVerificationGrace) return 'The stream is still in its initial verification period. Waiting for Twitch to report progress.';
    if (!health.domVideoPlaying) return 'The player is not reporting playback. Check the player for a pause, login prompt, or playback restriction.';
    return 'The stream appears eligible. Waiting for the next progress update from Twitch.';
  }
  function mountProductTools() {
    const target = ui.shadow.getElementById('tdh-diagnostics-body');
    if (!target || target.querySelector('[data-dropper-tools]')) return;
    const container = document.createElement('div');container.dataset.dropperTools = '1';
    container.append(ExtraPotionsCore.createCompatibilityControls());
    const details = document.createElement('details');details.style.cssText='border:1px solid var(--theme-line);border-radius:7px;padding:7px;margin-top:8px';
    const title = document.createElement('summary');title.textContent='Why am I waiting?';
    const text = document.createElement('p');text.setAttribute('role','status');
    const refresh = document.createElement('button');refresh.type='button';refresh.className='life-btn';refresh.textContent='Refresh explanation';
    const explain = () => { text.textContent=waitingExplanation(streamEarningHealthSnapshot(),Boolean(currentDrop),settings.findNextStream); };
    details.addEventListener('toggle',()=>{if(details.open)explain();});refresh.addEventListener('click',explain);details.append(title,text,refresh);
    const history = document.createElement('details');history.style.cssText=details.style.cssText;
    const heading = document.createElement('summary');heading.textContent='Activity history';const entries=document.createElement('div');
    const showHistory=()=>{entries.replaceChildren();const records=(Array.isArray(activityLog)?activityLog:[]).filter(e=>e.type==='playback'||e.type==='navigation').slice(-20).reverse();
      for(const entry of records){const p=document.createElement('p');p.textContent=new Date(entry.at).toLocaleTimeString()+' · '+entry.message+(entry.meta?.reason?' · '+entry.meta.reason:'');entries.append(p);}
      if(!records.length)entries.textContent='No Dropper playback or navigation actions recorded in this session.';};
    history.addEventListener('toggle',()=>{if(history.open)showHistory();});const update=document.createElement('button');update.type='button';update.className='life-btn';update.textContent='Refresh history';update.addEventListener('click',showHistory);history.append(heading,entries,update);
    const maintenance = document.createElement('details');
    const maintenanceTitle = document.createElement('summary');maintenanceTitle.textContent='Maintenance';maintenance.append(maintenanceTitle);
    const actions = document.createElement('div');actions.className='action-pair';maintenance.append(actions);
    for (const id of ['tdh-check-updates','tdh-refresh-campaign-data','tdh-clear-activity','tdh-refresh-now','tdh-reset-session']) actions.append(ui.shadow.getElementById(id));
    for (const empty of target.querySelectorAll(':scope>.action-pair:empty,:scope>.action-separator')) empty.remove();
    container.prepend(maintenance);
    container.append(details,history);target.append(container);
    container.dataset.expSystemTools='1';
  }

  function bindDropperControls() {
    const s = ui.shadow;
    mountProductTools();
    s.getElementById('tdh-restore-channel-player-now')?.addEventListener('click',()=>{ const requested=restoreChannelPlayer(true);setStatus(requested?'Channel player restore requested':'No compatible Twitch mini-player found on this channel page'); });
    s.getElementById('tdh-resume-playback')?.addEventListener('click', () => {
      ensureStreamPlaying(true); refreshViewingControls();
    });
    s.getElementById('tdh-allow-switching')?.addEventListener('click', () => {
      setManualStreamLock(false, 'automatic-switching-enabled');
      syncViewingContext(); viewingIntent.allowSwitching();
      settings.findNextStream = true; saveSettings(); refreshViewingControls();
    });
    s.getElementById('tdh-stream-lock')?.addEventListener('click', () => {
      const locked = Boolean(manualStreamLockSnapshot());
      setManualStreamLock(!locked, locked ? 'viewer-release' : 'viewer-lock');
      refreshStreamHealthSummary();
    });
    s.getElementById('tdh-recovery-action')?.addEventListener('click', (event) => {
      const action = event.currentTarget.dataset.action;
      if (action === 'resume') {
        ensureStreamPlaying(true);
      } else if (action === 'connections') {
        try { window.open(TWITCH_CONNECTIONS_URL, '_blank', 'noopener,noreferrer'); }
        catch (_) { location.assign(TWITCH_CONNECTIONS_URL); }
      } else if (action === 'unlock') {
        setManualStreamLock(false, 'recovery-action');
      } else if (action === 'find-stream') {
        setManualStreamLock(false, 'recovery-action');
        explicitViewingNavigationUntil = Date.now() + 15000;
        syncViewingContext();
        viewingIntent.allowSwitching();
        settings.findNextStream = true;
        saveSettings();
        const active = cleanText(watchingLogin()).toLowerCase();
        if (active && currentDrop) skipCurrentStreamer();
        else if (currentDrop) {
          transitionRoutingController(
            ROUTING_STATES.FIND_STREAM,
            { ...routingControllerTargetFromDrop(currentDrop), targetStream: '', deadlineAt: 0, waitReason: '' },
            'Viewer requested recovery stream search',
          );
          routingControllerTick(Date.now(), 'manual-recovery-action');
        }
      } else {
        requestGqlPoll('manual-recovery-recheck', true);
      }
      refreshViewingControls();
      refreshStreamHealthSummary();
    });
    s.getElementById('tdh-claim-history-panel')?.addEventListener('toggle', renderClaimHistory);
    s.getElementById('tdh-routing-history-panel')?.addEventListener('toggle', renderRoutingHistory);
    refreshViewingControls(); refreshEligibilityControls(); refreshStreamHealthSummary(); renderClaimHistory(); renderRoutingHistory();
    const inventory = s.getElementById("tdh-compact-inventory");
    refreshTwitchAuthStatus();
    s.getElementById("tdh-open-campaigns")?.addEventListener("toggle", (event) => {
      if (!event.currentTarget.open) return;
      refreshOpenCampaignList();
      queueGqlPollSoon("open-campaign-list", 0);
    });
    s.getElementById("tdh-twitch-login")?.addEventListener("click", () => {
      try {
        window.open(TWITCH_LOGIN_URL, "_blank", "noopener,noreferrer");
      } catch (_) {
        location.assign(TWITCH_LOGIN_URL);
      }
      setStatus("Finish Twitch login, then return to Dropper");
      setTimeout(refreshTwitchAuthStatus, 1500);
    });
    s.getElementById("tdh-account-link-open")?.addEventListener("click", () => {
      try {
        window.open(TWITCH_CONNECTIONS_URL, "_blank", "noopener,noreferrer");
      } catch (_) {
        location.assign(TWITCH_CONNECTIONS_URL);
      }
      setStatus("Open Twitch Connections and link the required game account");
    });
    s.getElementById("tdh-toggle-inventory")?.addEventListener("click", (event) => {
      const open = inventory.classList.toggle("open");
      if (open) lastSubmenuId = "inventory";
      event.currentTarget.textContent = open ? "Hide Drops Inventory" : "Show Drops Inventory";
      event.currentTarget.classList.toggle("last-opened", lastSubmenuId === "inventory");
      s.getElementById("tdh-diagnostics-toggle")?.classList.toggle("last-opened", lastSubmenuId === "diagnostics");
      renderCompactInventory();
      requestAnimationFrame(layoutChrome);
    });
    s.getElementById("tdh-skip-streamer")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleSkipStreamerClick();
    });
    s.getElementById("tdh-refresh-now")?.addEventListener("click", () => requestGqlPoll("manual-refresh", true));
    s.getElementById("tdh-refresh-campaign-data")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (!getToken()) {
        button.textContent = "Twitch Login Required";
        setStatus("Twitch Login Required · Open Drops To Sign In");
        refreshTwitchAuthStatus();
        setTimeout(() => { if (button.isConnected) button.textContent = "Refresh Campaign Data"; }, 1800);
        return;
      }

      button.textContent = "Refreshing Campaign Data…";
      button.disabled = true;
      try {
        lastCampaignAuthImportError = "";
        const imported = await importOpenCampaignsViaAuth("manual-diagnostics-refresh");
        if (imported.length) {
          button.textContent = `Refreshed ${imported.length} Campaigns`;
          refreshDropCard();
          maybeImportOpenCampaignsFirst("manual-diagnostics-refresh-complete");
          queueGqlPollSoon("manual-diagnostics-refresh", 0);
        } else if (lastCampaignAuthImportError) {
          button.textContent = "Refresh Failed";
          setStatus(`Campaign refresh failed · ${lastCampaignAuthImportError}`);
        } else {
          button.textContent = "No Open Campaigns Returned";
          refreshDropCard();
        }
      } catch (error) {
        lastCampaignAuthImportError = cleanText(error?.message || error) || "Refresh failed";
        button.textContent = "Refresh Failed";
        setStatus(`Campaign refresh failed · ${lastCampaignAuthImportError}`);
      } finally {
        button.disabled = false;
        setTimeout(() => { if (button.isConnected) button.textContent = "Refresh Campaign Data"; }, 2200);
      }
    });
    s.getElementById("tdh-clear-skipped-streamers")?.addEventListener("click", (event) => {
      const cleared = clearSkippedStreamers("manual-clear-skipped-streamers", true);
      event.currentTarget.textContent = cleared
        ? `Cleared ${cleared} Streamer${cleared === 1 ? "" : "s"}`
        : "No Skipped Streamers";
      refreshQueueList();
      const diagnostics = s.getElementById("tdh-diagnostics");
      if (diagnostics?.classList.contains("open")) diagnostics.textContent = diagnosticsText();
      setTimeout(() => { event.currentTarget.textContent = "Clear Skipped Streamers"; }, 1600);
    });
    const diag = s.getElementById("tdh-diagnostics");
    ExtraPotionsCore.bindDiagnosticsControls({
      show: s.getElementById("tdh-diagnostics-toggle"), copy: s.getElementById("tdh-copy-diagnostics"), output: diag,
      getReport: () => JSON.parse(diagnosticsText()),
      onShow: opening => { if (opening) lastSubmenuId = "diagnostics"; requestAnimationFrame(layoutChrome); },
      onCopy: () => logActivity("diagnostics", "Diagnostics copied to clipboard")
    });
    s.getElementById("tdh-clear-activity")?.addEventListener("click", (event) => {
      clearActivityLog();
      event.currentTarget.textContent = "Activity Cleared";
      if (diag.classList.contains("open")) diag.textContent = diagnosticsText();
      setTimeout(() => { event.currentTarget.textContent = "Clear Activity Log"; }, 1600);
    });
    s.getElementById("tdh-check-updates")?.addEventListener("click", (event) => {
      const button = event.currentTarget;
      if (typeof GM_xmlhttpRequest !== "function") { notifyUser("Update checks need a userscript manager."); return; }
      button.disabled = true;
      button.textContent = "Checking…";
      scheduleUpdateCheck(true);
      setTimeout(() => {
        const state = loadUpdateState();
        button.disabled = false;
        button.textContent = "Check for Updates";
        if (state.availableVersion && compareVersions(state.availableVersion, APP_VERSION) > 0) notifyUser("Dropper " + state.availableVersion + " is available.");
        else if (state.lastError) notifyUser("Update check failed quietly.");
        else notifyUser("Dropper is up to date.");
      }, 3500);
    });
    s.getElementById("tdh-reset-session")?.addEventListener("click", (event) => {
      resetTransientSessionState();
      event.currentTarget.textContent = "Session Reset";
      if (diag.classList.contains("open")) diag.textContent = diagnosticsText();
      setTimeout(() => { event.currentTarget.textContent = "Reset Session State"; }, 1600);
    });
    const strategy = s.getElementById("tdh-campaign-strategy");
    strategy.value = normalizedCampaignStrategy();
    strategy.addEventListener("change", () => {
      settings.campaignStrategy = normalizedCampaignStrategy(strategy.value);
      saveSettings();
      refreshOpenCampaignList();
      refreshQueueList();
      const moved = applyCampaignOrderNow('campaign-order-changed');
      refreshOpenCampaignList();
      const label = campaignStrategyLabel();
      if (moved.switched) setStatus(`Campaign Order: ${label} · Switching to ${moved.game}`);
      else if (moved.alreadyTop) setStatus(`Campaign Order: ${label} · ${moved.game} is already first`);
      else setStatus(`Campaign Order: ${label} · Current Stream Unchanged${moved.why ? ` (${moved.why})` : ''}`);
    });
    const notificationCooldown = s.getElementById("tdh-notification-cooldown");
    notificationCooldown.value = String([0,5,15,30].includes(Number(settings.notificationCooldownMinutes)) ? Number(settings.notificationCooldownMinutes) : 5);
    notificationCooldown.addEventListener("change", () => {
      settings.notificationCooldownMinutes = [0,5,15,30].includes(Number(notificationCooldown.value)) ? Number(notificationCooldown.value) : 5;
      saveSettings();
    });
    const queueCount = s.getElementById("tdh-queue-count"); queueCount.value = String(settings.queueCount); queueCount.addEventListener("change", () => { settings.queueCount = Number(queueCount.value); saveSettings(); refreshQueueList(); });
    const pref = s.getElementById("tdh-queue-preference"); pref.value = settings.queuePreference; pref.addEventListener("change", () => { settings.queuePreference = pref.value; saveSettings(); refreshQueueList(); });
    const pause = s.getElementById("tdh-pause-switch");
    if (!isAutoSwitchPaused()) {
      settings.pauseAutoSwitchMinutes = 0;
      settings.pauseAutoSwitchUntil = 0;
    }
    pause.value = String(settings.pauseAutoSwitchMinutes || 0);
    pause.addEventListener("change", () => {
      settings.pauseAutoSwitchMinutes = Number(pause.value);
      pauseAutoSwitchUntil = settings.pauseAutoSwitchMinutes
        ? Date.now() + settings.pauseAutoSwitchMinutes * 60000
        : 0;
      settings.pauseAutoSwitchUntil = pauseAutoSwitchUntil;
      saveSettings();
    });
    const opacityRange = s.getElementById("tdh-opacity-range");
    opacityRange.value = String(normalizedOpacityPercent());
    opacityRange.addEventListener("input", () => {
      settings.opacityPercent = normalizedOpacityPercent(opacityRange.value);
      opacityRange.setAttribute("aria-valuenow", String(settings.opacityPercent));
      opacityRange.setAttribute("aria-valuetext", settings.opacityPercent + "%");
      applyAppearanceSettings();
    });
    opacityRange.addEventListener("change", () => {
      settings.opacityPercent = normalizedOpacityPercent(opacityRange.value);
      saveSettings();
      applyAppearanceSettings();
    });
    s.getElementById("tdh-update-dismiss")?.addEventListener("click", hideUpdateNotice);
  }

