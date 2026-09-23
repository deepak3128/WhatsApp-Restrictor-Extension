// WhatsApp Focus Lock - content script (runs on web.whatsapp.com)
//
// How it works:
//  - You get a "session" of X minutes of visible WhatsApp time.
//  - When the session is used up, WhatsApp locks for the cooldown you chose.
//  - Separately, a daily total limit locks WhatsApp until midnight.
//  - Time only counts while the WhatsApp tab is visible.

(() => {
  const MIN = 60 * 1000;
  const DEFAULTS = {
    enabled: true,
    sessionMinutes: 10,
    cooldownMinutes: 60,
    dailyLimitMinutes: 45,
  };

  let settings = { ...DEFAULTS };
  let state = { sessionUsedMs: 0, cooldownUntil: 0, dailyDate: "", dailyUsedMs: 0 };
  let lastTick = Date.now();
  let ready = false;

  // ---------- helpers ----------
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function nextMidnight() {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }

  function fmt(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  }

  function rolloverDay() {
    const key = todayKey();
    if (state.dailyDate !== key) {
      state.dailyDate = key;
      state.dailyUsedMs = 0;
    }
  }

  function getLock(now) {
    if (state.cooldownUntil > now) {
      return { type: "cooldown", until: state.cooldownUntil };
    }
    if (state.dailyUsedMs >= settings.dailyLimitMinutes * MIN) {
      return { type: "daily", until: nextMidnight() };
    }
    return null;
  }

  function save() {
    try {
      chrome.storage.local.set({ state });
    } catch (e) {
      /* extension was reloaded; the page needs a refresh */
    }
  }

  // ---------- UI (inside a shadow root so WhatsApp's CSS can't touch it) ----------
  let host, root, overlayEl, overlayTitle, overlayTime, overlayNote, pillEl;

  function buildUI() {
    host = document.createElement("div");
    host.id = "wfl-host";
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        .overlay {
          position: fixed; inset: 0; display: none;
          align-items: center; justify-content: center; text-align: center;
          background: #10302a; color: #eaf3ef; pointer-events: auto;
          font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
        }
        .overlay.show { display: flex; }
        .box { max-width: 460px; padding: 24px; }
        h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; letter-spacing: .2px; }
        .time {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 84px; line-height: 1.05; margin: 18px 0 14px;
          font-variant-numeric: tabular-nums;
        }
        .note { margin: 0; font-size: 16px; line-height: 1.5; color: #b9d0c7; }
        .pill {
          position: fixed; right: 14px; bottom: 14px; display: none;
          padding: 7px 12px; border-radius: 999px; pointer-events: none;
          background: rgba(16, 48, 42, .92); color: #eaf3ef;
          font: 600 13px "Segoe UI", system-ui, sans-serif;
          font-variant-numeric: tabular-nums;
        }
        .pill.show { display: block; }
        .pill.low { background: rgba(160, 60, 40, .95); }
      </style>
      <div class="overlay" id="overlay">
        <div class="box">
          <h1 id="title"></h1>
          <div class="time" id="time"></div>
          <p class="note" id="note"></p>
        </div>
      </div>
      <div class="pill" id="pill"></div>
    `;
    overlayEl = root.getElementById("overlay");
    overlayTitle = root.getElementById("title");
    overlayTime = root.getElementById("time");
    overlayNote = root.getElementById("note");
    pillEl = root.getElementById("pill");
    host.style.pointerEvents = "none";
    document.documentElement.appendChild(host);
  }

  function ensureUI() {
    if (!host || !host.isConnected) buildUI();
  }

  function showOverlay(lock, now) {
    ensureUI();
    host.style.pointerEvents = "auto";
    overlayEl.classList.add("show");
    pillEl.classList.remove("show");
    if (lock.type === "cooldown") {
      overlayTitle.textContent = "WhatsApp is locked";
      overlayNote.textContent = "Your session is over. Go back to studying; it opens again when the timer ends.";
    } else {
      overlayTitle.textContent = "Daily limit reached";
      overlayNote.textContent = "You've used today's WhatsApp time. It opens again at midnight.";
    }
    overlayTime.textContent = fmt(lock.until - now);
    // Hide the unread count that WhatsApp puts in the tab title.
    document.title = "WhatsApp (locked)";
  }

  function hideOverlay() {
    if (!host) return;
    host.style.pointerEvents = "none";
    overlayEl.classList.remove("show");
  }

  function updatePill() {
    ensureUI();
    const sessionLeft = settings.sessionMinutes * MIN - state.sessionUsedMs;
    const dailyLeft = settings.dailyLimitMinutes * MIN - state.dailyUsedMs;
    const left = Math.min(sessionLeft, dailyLeft);
    pillEl.textContent = `${fmt(left)} left`;
    pillEl.classList.toggle("low", left < 60 * 1000);
    pillEl.classList.add("show");
  }

  function hideAll() {
    if (!host) return;
    hideOverlay();
    pillEl.classList.remove("show");
  }

  // ---------- main loop ----------
  function tick() {
    if (!ready) return;
    const now = Date.now();
    const delta = Math.min(now - lastTick, 2000); // ignore long gaps (sleep, throttled timers)
    lastTick = now;

    if (!settings.enabled) {
      hideAll();
      return;
    }

    rolloverDay();

    let lock = getLock(now);
    if (!lock) {
      if (document.visibilityState === "visible") {
        state.sessionUsedMs += delta;
        state.dailyUsedMs += delta;

        if (state.sessionUsedMs >= settings.sessionMinutes * MIN) {
          state.cooldownUntil = now + settings.cooldownMinutes * MIN;
          state.sessionUsedMs = 0;
        }
        save();
        lock = getLock(now);
      }
    }

    if (lock) {
      showOverlay(lock, now);
    } else {
      hideOverlay();
      updatePill();
    }
  }

  // ---------- startup ----------
  async function init() {
    try {
      const data = await chrome.storage.local.get(["settings", "state"]);
      settings = { ...DEFAULTS, ...(data.settings || {}) };
      state = { ...state, ...(data.state || {}) };
    } catch (e) {
      return;
    }
    rolloverDay();
    ready = true;
    lastTick = Date.now();
    tick();
    setInterval(tick, 1000);

    // Keep in sync with the popup and other WhatsApp tabs.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.settings) settings = { ...DEFAULTS, ...(changes.settings.newValue || {}) };
      if (changes.state) state = { ...state, ...(changes.state.newValue || {}) };
    });
  }

  init();
})();
