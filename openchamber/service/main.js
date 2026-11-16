"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// openchamber/service/main.ts
var http = __toESM(require("node:http"));

// node_modules/@openchamber/sdk/dist/scrollbar-style.js
var GUEST_SCROLLING_ATTRIBUTE = "data-oc-scrolling";
var GUEST_SCROLLBAR_CSS = `
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [${GUEST_SCROLLING_ATTRIBUTE}] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [${GUEST_SCROLLING_ATTRIBUTE}]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;
function installGuestScrollbarActivity(doc) {
  const root = doc.documentElement;
  if (root.hasAttribute("data-oc-scrollbar-activity"))
    return;
  root.setAttribute("data-oc-scrollbar-activity", "");
  const timers = /* @__PURE__ */ new WeakMap();
  doc.addEventListener("scroll", (event) => {
    const target = event.target === doc ? root : event.target;
    if (!(target instanceof Element))
      return;
    if (!target.hasAttribute("data-oc-scrolling"))
      target.setAttribute("data-oc-scrolling", "");
    const pending = timers.get(target);
    if (pending !== void 0)
      clearTimeout(pending);
    timers.set(target, setTimeout(() => {
      timers.delete(target);
      target.removeAttribute("data-oc-scrolling");
    }, 1e3));
  }, { capture: true, passive: true });
}
var GUEST_SCROLLBAR_SCRIPT = `(${installGuestScrollbarActivity.toString()})(document);`;

// node_modules/@openchamber/sdk/dist/manifest.js
var GUEST_PROVIDER_LOGO_BYTES_MAX = 1024 * 1024;
var TRACKER_URL_TOKENS = ["{id}", "{segment}", "{segments+}"];
var TRACKER_URL_TOKEN_SET = new Set(TRACKER_URL_TOKENS);

// node_modules/@openchamber/sdk/dist/session-events.js
var GUEST_SESSION_EVENT_TYPES = [
  "turn-finished",
  "turn-failed",
  "permission-asked",
  "question-asked",
  "turn-started",
  "session-created",
  "session-archived",
  "session-deleted"
];
var SESSION_EVENTS_IDLE_MS = 10 * 6e4;
var EVENT_TYPES = new Set(GUEST_SESSION_EVENT_TYPES);

// node_modules/@openchamber/sdk/dist/service-host.js
var SERVICE_HOST_PATH = "/service/call";
var OPENCHAMBER_HOST_CALLBACK_URL_ENV = "OPENCHAMBER_HOST_CALLBACK_URL";
var SERVICE_HOST_TIMEOUT_MS = 3e4;
var SERVICE_SCHEDULE_IDLE_MS = 10 * 6e4;
var MENTIONS_IDLE_MS = 10 * 6e4;
var ServiceHostError = class extends Error {
  code;
  status;
  constructor(message, code, status) {
    super(message);
    this.name = "ServiceHostError";
    this.code = code;
    this.status = status;
  }
};
var createServiceHost = ({ env }) => {
  const call = async (method, input) => {
    const base = env[OPENCHAMBER_HOST_CALLBACK_URL_ENV];
    const token2 = env.OPENCHAMBER_SERVICE_TOKEN;
    if (!base || !token2)
      throw new ServiceHostError("This service was not started by OpenChamber.", "HOST_UNAVAILABLE", 0);
    let response;
    try {
      response = await fetch(`${base.replace(/\/+$/, "")}${SERVICE_HOST_PATH}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token2}`, "Content-Type": "application/json" },
        body: JSON.stringify({ method, input }),
        signal: AbortSignal.timeout(SERVICE_HOST_TIMEOUT_MS)
      });
    } catch {
      throw new ServiceHostError("OpenChamber did not answer.", "HOST_UNAVAILABLE", 0);
    }
    const body = await response.json().catch(() => null);
    if (response.ok && body?.result !== void 0)
      return body.result;
    throw new ServiceHostError(body?.error?.message ?? `OpenChamber answered HTTP ${response.status}.`, body?.error?.code ?? "HOST_UNAVAILABLE", response.status);
  };
  return {
    sessions: {
      start: (input) => call("sessions.start", input),
      send: (sessionId, prompt) => call("sessions.send", { sessionId, prompt }),
      retry: (sessionId) => call("sessions.retry", { sessionId }),
      status: (sessionId) => call("sessions.status", { sessionId }),
      lastReply: (sessionId) => call("sessions.lastReply", { sessionId }),
      stop: (sessionId) => call("sessions.stop", { sessionId }),
      answerPermission: (sessionId, requestId, answer) => call("sessions.answerPermission", { sessionId, requestId, ...answer }),
      answerForm: (sessionId, formId, values, message) => call("sessions.answerForm", { sessionId, formId, values, ...message === void 0 ? {} : { message } })
    },
    setInstructions: (directory, text) => call("instructions.set", { directory, text }),
    emit: (topic, data) => call("panels.emit", { topic, data }),
    readSettings: () => call("settings.read", {}).then(({ settings }) => settings),
    needsConfiguration: (message) => call("status.set", { needsConfiguration: message }),
    setMark: (target, mark) => call("marks.set", { target, mark })
  };
};

// node_modules/@openchamber/sdk/dist/contract.js
var GUEST_FILE_STAT_KINDS = ["file", "directory", "other", "missing"];
var GUEST_GENERATE_LATE_KEEP_MS = 60 * 6e4;
var HOST_REQUEST_ERROR_CODES = [
  "HOST_UNAVAILABLE",
  "HOST_TIMEOUT",
  "HOST_REJECTED",
  "DISCONNECTED",
  "DISABLED",
  "BAD_PATH",
  "NO_INTEGRATION",
  "NO_SERVICE",
  "SERVICE_FAILED",
  "REQUEST_FAILED",
  "RESPONSE_TOO_LARGE",
  "NO_SESSION",
  "SESSION_BUSY",
  "NOT_GRANTED",
  "NO_DIRECTORY",
  "NOT_FOUND",
  "FILE_TOO_LARGE",
  "DENIED",
  "NO_MODEL",
  "MODEL_FAILED",
  "UNSUPPORTED"
];
var SERVICE_STATUS_VALUES = ["stopped", "starting", "ready", "failed"];
var hostRequestErrorCodeSet = new Set(HOST_REQUEST_ERROR_CODES);
var serviceStatusSet = new Set(SERVICE_STATUS_VALUES);
var fileStatKindSet = new Set(GUEST_FILE_STAT_KINDS);

// node_modules/@openchamber/sdk/dist/service-providers.js
var BROWSER_CONTROL_ACTIONS = [
  "browser.open",
  "browser.snapshot",
  "browser.click",
  "browser.type",
  "browser.select",
  "browser.scroll",
  "browser.back",
  "browser.forward",
  "browser.inspect",
  "browser.capture",
  "browser.resize",
  "browser.close"
];
var BROWSER_PROVIDER_IDLE_MS = 10 * 6e4;
var CONTROL_ACTIONS = new Set(BROWSER_CONTROL_ACTIONS);
var SOURCE_CONTROL_PROVIDER_IDLE_MS = 10 * 6e4;
var NOTIFICATIONS_PROVIDER_IDLE_MS = 10 * 6e4;
var TRACKER_PROVIDER_IDLE_MS = 10 * 6e4;
var QUOTA_PROVIDER_IDLE_MS = 10 * 6e4;

// node_modules/@openchamber/sdk/dist/service-surface.js
var SURFACE_CONTROLLERS = ["none", "agent", "user"];
var CONTROLLERS = new Set(SURFACE_CONTROLLERS);

// src/schedule.ts
var deepSeekV4 = {
  timezone: "Asia/Shanghai",
  weekendOffPeak: true,
  peakWindows: [
    { start: "09:00", end: "12:00" },
    { start: "14:00", end: "18:00" }
  ],
  holidayOffPeak: true,
  holidays: [
    // 2026 -- State Council notice published 2025-11-04 (confirmed).
    "2026-01-01",
    "2026-01-02",
    "2026-02-16",
    "2026-02-17",
    "2026-02-18",
    "2026-02-19",
    "2026-02-20",
    "2026-02-23",
    "2026-04-06",
    "2026-05-01",
    "2026-05-04",
    "2026-05-05",
    "2026-06-19",
    "2026-09-25",
    "2026-10-01",
    "2026-10-02",
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    // 2027 -- PROVISIONAL, statutory dates only. The State Council publishes
    // the final schedule each Nov; the 调休 bridge days it adds are unknown
    // until then, so they are deliberately absent. That fails safe: we may
    // call a 调休 rest day "peak" (user waits, no loss) but never call a
    // normal workday "off-peak" (user would pay peak rates).
    // Re-verify and add the bridge days before Jan 2027.
    "2027-01-01",
    "2027-02-05",
    "2027-02-08",
    "2027-04-05",
    "2027-06-09",
    "2027-09-15",
    "2027-10-01"
  ],
  models: [
    {
      id: "deepseek-flash",
      version: "DeepSeek-V4.1-Flash",
      cacheHit: { peak: "$0.006", offPeak: "$0.003" },
      cacheMiss: { peak: "$0.30", offPeak: "$0.15" },
      output: { peak: "$1.20", offPeak: "$0.60" },
      concurrency: 2500
    },
    {
      id: "deepseek-v4-pro",
      version: "DeepSeek-V4-Pro-0813",
      cacheHit: { peak: "$0.044", offPeak: "$0.022" },
      cacheMiss: { peak: "$1.32", offPeak: "$0.66" },
      output: { peak: "$3.96", offPeak: "$1.98" },
      concurrency: 500
    }
  ],
  note: "Off-peak = 50% of peak \xB7 USD per 1M tokens",
  verifiedOn: "2026-10-02",
  sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing/"
};
var MIN_PER_DAY = 1440;
var LOOKAHEAD_DAYS = 21;
function parseMin(s) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function isWeekend(dow) {
  return dow === "Sat" || dow === "Sun";
}
function tzOffsetMinutes(tz, date) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const g = (t) => p.find((x) => x.type === t).value;
  let h = parseInt(g("hour"), 10);
  if (h === 24) h = 0;
  const asUTC = Date.UTC(
    +g("year"),
    +g("month") - 1,
    +g("day"),
    h,
    +g("minute"),
    +g("second")
  );
  return Math.round((asUTC - date.getTime()) / 6e4);
}
function wallToEpoch(y, mo, d, h, mi, tz) {
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  return ms - tzOffsetMinutes(tz, new Date(ms)) * 6e4;
}
function providerParts(date, tz) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date);
  const g = (t) => p.find((x) => x.type === t).value;
  let h = parseInt(g("hour"), 10);
  if (h === 24) h = 0;
  const mo = +g("month");
  const d = +g("day");
  return {
    dow: g("weekday"),
    totalMin: h * 60 + parseInt(g("minute"), 10),
    y: +g("year"),
    mo,
    d,
    key: `${g("year")}-${g("month")}-${g("day")}`
  };
}
function isHoliday(key, sch) {
  return sch.holidayOffPeak && sch.holidays.includes(key);
}
function isFree(parts, sch) {
  return sch.weekendOffPeak && isWeekend(parts.dow) || isHoliday(parts.key, sch);
}
function fmtTime(at, tz) {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...tz && { timeZone: tz }
  });
}
function phaseAt(parts, sch) {
  if (isFree(parts, sch)) return "offPeak";
  for (const w of sch.peakWindows) {
    const s = parseMin(w.start);
    const e = parseMin(w.end);
    if (parts.totalMin >= s && parts.totalMin < e) return "peak";
  }
  return "offPeak";
}
function getTransitions(now = /* @__PURE__ */ new Date(), sch = deepSeekV4, limit = 6) {
  const candidates = [];
  for (let k = 0; k < LOOKAHEAD_DAYS; k++) {
    const p = providerParts(new Date(now.getTime() + k * MIN_PER_DAY * 6e4), sch.timezone);
    if (isFree(p, sch)) continue;
    for (const w of sch.peakWindows) {
      const s = parseMin(w.start);
      const e = parseMin(w.end);
      candidates.push({ at: wallToEpoch(p.y, p.mo, p.d, Math.floor(s / 60), s % 60, sch.timezone), to: "peak" });
      candidates.push({ at: wallToEpoch(p.y, p.mo, p.d, Math.floor(e / 60), e % 60, sch.timezone), to: "offPeak" });
    }
  }
  return candidates.filter((c) => c.at > now.getTime()).sort((a, b) => a.at - b.at).slice(0, limit);
}
function getState(now = /* @__PURE__ */ new Date(), sch = deepSeekV4) {
  const parts = providerParts(now, sch.timezone);
  const current = phaseAt(parts, sch);
  const transitions = getTransitions(now, sch, 6);
  const next = transitions[0];
  const remainingSec = Math.max(0, (next.at - now.getTime()) / 1e3);
  let bestWindow = null;
  if (current === "offPeak") {
    const nextPeak = transitions.find((t) => t.to === "peak");
    bestWindow = { start: now.getTime(), end: nextPeak ? nextPeak.at : now.getTime() };
  } else {
    const nextOff = transitions.find((t) => t.to === "offPeak");
    if (nextOff) {
      const after = transitions.find((t) => t.at > nextOff.at && t.to === "peak");
      bestWindow = { start: nextOff.at, end: after ? after.at : nextOff.at };
    }
  }
  return {
    isOffPeak: current === "offPeak",
    isWeekend: sch.weekendOffPeak && isWeekend(parts.dow),
    isHoliday: isHoliday(parts.key, sch),
    nextIsPeak: next.to === "peak",
    minutesRemaining: Math.ceil(remainingSec / 60),
    secondsRemaining: Math.max(0, Math.ceil(remainingSec)),
    transitionAt: next.at,
    nextTransitions: transitions.slice(0, 2),
    bestWindow
  };
}
function holidayCoverageYears(sch = deepSeekV4) {
  const years = new Set(sch.holidays.map((k) => parseInt(k.slice(0, 4), 10)));
  return [...years].sort((a, b) => a - b);
}
function offPeakReason(s) {
  if (s.isHoliday) return "China holiday";
  if (s.isWeekend) return "weekend";
  return "";
}
function formatCountdown(minutes) {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor(minutes % 1440 / 60);
  const m = minutes % 60;
  return d > 0 ? `${d}d ${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}
function formatCountdownSec(totalSeconds) {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor(totalSeconds % 86400 / 3600);
  const m = Math.floor(totalSeconds % 3600 / 60);
  const s = totalSeconds % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h`;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

// src/view-model.ts
function pillLabel(s) {
  const cd = formatCountdown(s.minutesRemaining);
  const why = offPeakReason(s);
  return s.isOffPeak ? `DS OFF${why ? ` \xB7 ${why}` : ""} \xB7 ${cd}` : `DS PEAK \xB7 ${cd}`;
}
function adviceText(s, seconds = true) {
  if (s.isOffPeak) return "OFF-PEAK \u2014 good time for large AI workloads. Run batch jobs now.";
  const cd = seconds ? formatCountdownSec(s.secondsRemaining) : formatCountdown(s.minutesRemaining);
  return `PEAK \u2014 large/batch workloads are cheaper if delayed. Off-peak starts in ${cd}.`;
}
function dayTag(at, now) {
  const today = now.toDateString();
  const e = new Date(at).toDateString();
  if (e === today) return "today";
  const tomorrow = new Date(now.getTime() + 864e5).toDateString();
  if (e === tomorrow) return "tomorrow";
  return new Date(at).toLocaleDateString([], { weekday: "short" });
}

// openchamber/service/session-state.ts
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var opencodeDatabasePath = (env = process.env) => {
  const dataDir = env.OPENCODE_DATA_DIR ?? (0, import_node_path.join)(env.XDG_DATA_HOME ?? (0, import_node_path.join)((0, import_node_os.homedir)(), ".local", "share"), "opencode");
  return (0, import_node_path.join)(dataDir, "opencode.db");
};
var loadSqlite = () => {
  try {
    return require("node:sqlite");
  } catch {
    return null;
  }
};
var parseSessionModel = (raw) => {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    const id = typeof parsed.id === "string" ? parsed.id : "";
    const provider = typeof parsed.providerID === "string" ? parsed.providerID : "";
    return id ? { provider, id } : null;
  } catch {
    return null;
  }
};
var isPricedDeepSeek = (model) => {
  if (!model) return false;
  return /deepseek/i.test(model.id) && !/-free$/i.test(model.id);
};
var readCurrentSession = (dbPath = opencodeDatabasePath()) => {
  const sqlite = loadSqlite();
  if (!sqlite) return null;
  let db = null;
  try {
    db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare(
      `select id, directory, model
				 from session_v2
				 where parent_id is null and (time_archived is null or time_archived = 0)
				 order by max(coalesce(time_viewed, 0), time_updated) desc
				 limit 1`
    ).all()[0];
    if (!row || typeof row.id !== "string") return null;
    return {
      sessionId: row.id,
      directory: typeof row.directory === "string" ? row.directory : null,
      model: parseSessionModel(row.model)
    };
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
    }
  }
};

// openchamber/service/main.ts
var token = process.env.OPENCHAMBER_SERVICE_TOKEN ?? "";
var ALERT_BEFORE_MINUTES = 10;
var MARK_REFRESH_MS = 1e4;
var statusView = () => {
  const now = /* @__PURE__ */ new Date();
  const s = getState(now);
  const rows = [
    {
      kind: "line",
      id: "state",
      label: "DeepShift",
      dot: s.isOffPeak ? "success" : "error",
      value: pillLabel(s),
      valueTone: s.isOffPeak ? "success" : "error",
      tooltip: "DeepSeek peak/off-peak pricing"
    }
  ];
  const next = s.nextTransitions[0];
  if (next) {
    const inMin = Math.max(0, Math.ceil((next.at - now.getTime()) / 6e4));
    const tag = dayTag(next.at, now);
    rows.push({
      kind: "line",
      id: "next",
      label: "Next",
      value: `${next.to === "peak" ? "Peak" : "Off-peak"} \xB7 ${fmtTime(next.at)}${tag === "today" ? "" : ` ${tag}`} \xB7 in ${formatCountdown(inMin)}`
    });
  }
  rows.push({
    kind: "note",
    id: "advice",
    text: adviceText(s, false),
    tone: s.isOffPeak ? "muted" : "error"
  });
  const years = holidayCoverageYears();
  if (!years.includes(now.getFullYear())) {
    rows.push({
      kind: "note",
      id: "stale-calendar",
      text: `Holiday calendar covers ${years[0]}\u2013${years[years.length - 1]} \u2014 Chinese holidays are NOT applied for ${now.getFullYear()}.`,
      tone: "warning"
    });
  }
  return { rows };
};
var host = createServiceHost({ env: process.env });
var markFor = (s) => {
  const cd = formatCountdown(s.minutesRemaining);
  const soon = s.minutesRemaining <= ALERT_BEFORE_MINUTES;
  if (!s.isOffPeak) {
    return soon ? { icon: "timer", tone: "warning", text: `Peak ends in ${cd} \u2014 off-peak resuming soon` } : { icon: "timer", tone: "error", text: `Peak pricing \xB7 2x rates \xB7 off-peak in ${cd}` };
  }
  return soon ? { icon: "timer", tone: "warning", text: `Peak starts in ${cd} \u2014 finish large runs` } : { icon: "timer", tone: "success", text: `Off-peak \xB7 50% off \xB7 peak in ${cd}` };
};
var markedSession = null;
var markedJson = "";
var hostWarned = false;
var clearMark = async () => {
  const sessionId = markedSession;
  if (!sessionId) return;
  markedSession = null;
  markedJson = "";
  await host.setMark({ sessionId }, null);
};
var reconcileMark = async () => {
  try {
    const current = readCurrentSession();
    if (!current || !isPricedDeepSeek(current.model)) {
      await clearMark();
      return;
    }
    const mark = markFor(getState());
    const json = JSON.stringify(mark);
    if (current.sessionId === markedSession && json === markedJson) return;
    if (markedSession && markedSession !== current.sessionId) await clearMark();
    await host.setMark({ sessionId: current.sessionId }, mark);
    markedSession = current.sessionId;
    markedJson = json;
  } catch (error) {
    if (!hostWarned) {
      hostWarned = true;
      console.warn(
        "DeepShift: sidebar mark unavailable \u2014",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
};
var scheduleMark = () => {
  const wait = Math.min(Math.max(getState().transitionAt - Date.now() + 500, 1e3), MARK_REFRESH_MS);
  setTimeout(() => {
    void reconcileMark().finally(scheduleMark);
  }, wait);
};
var server = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${token}`) {
    res.writeHead(401).end();
    return;
  }
  const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  if (req.method === "GET" && path === "/health") {
    res.writeHead(200).end("{}");
    return;
  }
  if (req.method === "GET" && path === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(statusView()));
    return;
  }
  res.writeHead(404).end("{}");
});
server.listen(Number(process.env.OPENCHAMBER_SERVICE_PORT), "127.0.0.1");
void reconcileMark();
scheduleMark();
