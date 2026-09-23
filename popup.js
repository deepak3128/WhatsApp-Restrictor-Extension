const MIN = 60 * 1000;
const DEFAULTS = {
  enabled: true,
  sessionMinutes: 10,
  cooldownMinutes: 60,
  dailyLimitMinutes: 45,
};

const $ = (id) => document.getElementById(id);
const fields = ["sessionMinutes", "cooldownMinutes", "dailyLimitMinutes"];

let settings = { ...DEFAULTS };
let state = { sessionUsedMs: 0, cooldownUntil: 0, dailyDate: "", dailyUsedMs: 0 };

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

function minutesLabel(ms) {
  return `${Math.max(0, Math.ceil(ms / MIN))} min`;
}

function currentLock(now) {
  if (state.cooldownUntil > now) return { type: "cooldown", until: state.cooldownUntil };
  const dailyUsed = state.dailyDate === todayKey() ? state.dailyUsedMs : 0;
  if (dailyUsed >= settings.dailyLimitMinutes * MIN) return { type: "daily", until: nextMidnight() };
  return null;
}

function renderStatus() {
  const now = Date.now();
  const box = $("statusBox");
  const lock = settings.enabled ? currentLock(now) : null;
  const dailyUsed = state.dailyDate === todayKey() ? state.dailyUsedMs : 0;
  const dailyLeft = settings.dailyLimitMinutes * MIN - dailyUsed;

  box.classList.toggle("locked", !!lock);

  if (!settings.enabled) {
    $("statusLabel").textContent = "Focus Lock is off";
    $("statusTime").textContent = "–";
    $("statusSub").textContent = "Turn it on below to start limiting WhatsApp.";
  } else if (lock && lock.type === "cooldown") {
    $("statusLabel").textContent = "WhatsApp is locked. Opens in";
    $("statusTime").textContent = fmt(lock.until - now);
    $("statusSub").textContent = `${minutesLabel(dailyLeft)} left today`;
  } else if (lock && lock.type === "daily") {
    $("statusLabel").textContent = "Daily limit reached. Opens in";
    $("statusTime").textContent = fmt(lock.until - now);
    $("statusSub").textContent = "Resets at midnight";
  } else {
    const sessionLeft = settings.sessionMinutes * MIN - state.sessionUsedMs;
    $("statusLabel").textContent = "WhatsApp is open. Session time left";
    $("statusTime").textContent = fmt(Math.min(sessionLeft, dailyLeft));
    $("statusSub").textContent = `${minutesLabel(dailyLeft)} left today`;
  }

  const locked = !!lock;
  $("lockedNote").hidden = !locked;
  fields.forEach((id) => ($(id).disabled = locked));
  $("enabled").disabled = locked;
  $("saveBtn").disabled = locked;
  document.querySelectorAll("#cooldownChips button").forEach((b) => (b.disabled = locked));
}

function highlightChip() {
  const v = Number($("cooldownMinutes").value);
  document.querySelectorAll("#cooldownChips button").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.min) === v);
  });
}

function fillForm() {
  fields.forEach((id) => ($(id).value = settings[id]));
  $("enabled").checked = settings.enabled;
  highlightChip();
}

function showMsg(text, isError) {
  const el = $("msg");
  el.textContent = text;
  el.classList.toggle("error", !!isError);
  if (!isError) setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 2500);
}

async function init() {
  const data = await chrome.storage.local.get(["settings", "state"]);
  settings = { ...DEFAULTS, ...(data.settings || {}) };
  state = { ...state, ...(data.state || {}) };
  fillForm();
  renderStatus();

  // Keep the status fresh, but don't overwrite what the user is typing.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.state) state = { ...state, ...(changes.state.newValue || {}) };
    if (changes.settings) settings = { ...DEFAULTS, ...(changes.settings.newValue || {}) };
  });
  setInterval(renderStatus, 1000);
}

document.querySelectorAll("#cooldownChips button").forEach((b) => {
  b.addEventListener("click", () => {
    $("cooldownMinutes").value = b.dataset.min;
    highlightChip();
  });
});
$("cooldownMinutes").addEventListener("input", highlightChip);

$("settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (currentLock(Date.now()) && settings.enabled) return;

  const next = { enabled: $("enabled").checked };
  for (const id of fields) {
    const v = Math.round(Number($(id).value));
    const max = id === "sessionMinutes" ? 600 : 1440;
    if (!Number.isFinite(v) || v < 1 || v > max) {
      showMsg(`Enter a number from 1 to ${max} for every field.`, true);
      return;
    }
    next[id] = v;
  }

  settings = { ...settings, ...next };
  await chrome.storage.local.set({ settings });
  showMsg("Saved.");
  renderStatus();
});

init();
