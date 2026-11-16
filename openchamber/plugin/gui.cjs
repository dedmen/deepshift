"use strict";
var __modules = {
"opencode/gui.cts": function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gui_1 = require("@opencode/plugin/gui");
const solid_js_1 = require("solid-js");
const schedule_1 = __require("src/schedule.ts");
const view_model_1 = __require("src/view-model.ts");
const PRICING_URL = schedule_1.deepSeekV4.sourceUrl;
const PEAK_PILL_TITLE = 'DeepSeek peak pricing: off-peak discount not applied';
const OFF_PEAK_PILL_TITLE = 'DeepSeek off-peak pricing: 50% off';
const FREE_QUOTA_STORAGE_KEY = 'deepshift.freeQuotaUntil';
const FREE_QUOTA_FALLBACK_MS = 60 * 60 * 1000;
const CSS = `
.oc-ds-bar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 26px;
  padding: 0 12px;
  box-sizing: border-box;
  background: linear-gradient(90deg, #7f1d1d, #dc2626 45%, #b91c1c);
  background-size: 220% 100%;
  animation: oc-ds-slide 7s linear infinite;
  color: #fff;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.055em;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  user-select: none;
  cursor: default;
}
.oc-ds-bar[hidden] { display: none; }
.oc-ds-bar .oc-ds-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
  animation: oc-ds-pulse 1.3s ease-in-out infinite;
}
.oc-ds-bar .oc-ds-text { overflow: hidden; text-overflow: ellipsis; }
.oc-ds-bar .oc-ds-time { flex: 0 0 auto; opacity: 0.9; font-weight: 550; }
@keyframes oc-ds-slide { from { background-position: 0 0; } to { background-position: -220% 0; } }
@keyframes oc-ds-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

button[data-composer-pill][aria-label^="DeepSeek peak pricing"] {
  background: #dc2626 !important;
  color: #fff !important;
  border-color: #7f1d1d !important;
  box-shadow: 0 0 0 1px #7f1d1d inset, 0 0 0 3px rgba(220, 38, 38, 0.22) !important;
  font-weight: 600 !important;
  animation: oc-ds-pill 2.4s ease-in-out infinite;
}
button[data-composer-pill][aria-label^="DeepSeek peak pricing"] svg { color: #fff !important; }
@keyframes oc-ds-pill {
  0%, 100% { box-shadow: 0 0 0 1px #7f1d1d inset, 0 0 0 3px rgba(220, 38, 38, 0.18); }
  50% { box-shadow: 0 0 0 1px #7f1d1d inset, 0 0 0 6px rgba(220, 38, 38, 0.32); }
}

@media (prefers-reduced-motion: reduce) {
  .oc-ds-bar { animation: none; }
  .oc-ds-bar .oc-ds-dot { animation: none; }
  button[data-composer-pill][aria-label^="DeepSeek peak pricing"] { animation: none; }
}
`;
function createBar() {
    const bar = document.createElement('div');
    bar.className = 'oc-ds-bar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    const dot = document.createElement('span');
    dot.className = 'oc-ds-dot';
    const text = document.createElement('span');
    text.className = 'oc-ds-text';
    const time = document.createElement('span');
    time.className = 'oc-ds-time';
    bar.append(dot, text, time);
    return { bar, text, time };
}
module.exports = gui_1.Plugin.define({
    i18n: {
        en: {
            'command.status': 'DeepShift: DeepSeek pricing status',
            'command.status.description': 'Check whether the DeepSeek off-peak discount is applied right now',
            'command.copyStatus': 'DeepShift: Copy status',
            'command.copyStatus.description': 'Copy the current DeepSeek pricing status to the clipboard',
            'command.copySchedule': "DeepShift: Copy today's schedule",
            'command.copySchedule.description': "Copy today's DeepSeek peak windows in your timezone",
            'command.diagnostics': 'DeepShift: Diagnose timezone',
            'command.diagnostics.description': 'Show local, Beijing and UTC clocks plus holiday calendar coverage',
        },
    },
    setup(ctx) {
        const options = ctx.options ?? {};
        const always = options.always === true;
        const peakThreshold = Number(options.notifyBeforePeakStarts ?? 10);
        const offPeakThreshold = Number(options.notifyBeforeOffPeakStarts ?? 10);
        const modelId = (model) => String(model?.modelID ?? model?.id ?? '').toLowerCase();
        const isDeepSeek = (model) => {
            if (!model)
                return false;
            const provider = String(model.providerID ?? '').toLowerCase();
            return provider.includes('deepseek') || modelId(model).includes('deepseek');
        };
        const isFreeDeepSeek = (model) => {
            if (!model)
                return false;
            return isDeepSeek(model) && modelId(model).endsWith('-free');
        };
        const currentModel = () => ctx.screen.current()?.composer.model();
        const readFreeQuotaUntil = () => {
            try {
                const value = Number(globalThis.localStorage?.getItem(FREE_QUOTA_STORAGE_KEY) ?? 0);
                return Number.isFinite(value) && value > Date.now() ? value : 0;
            }
            catch {
                return 0;
            }
        };
        const writeFreeQuotaUntil = (until) => {
            try {
                if (until > Date.now())
                    globalThis.localStorage?.setItem(FREE_QUOTA_STORAGE_KEY, String(until));
                else
                    globalThis.localStorage?.removeItem(FREE_QUOTA_STORAGE_KEY);
            }
            catch {
            }
        };
        const [freeQuotaUntil, setFreeQuotaUntilSignal] = (0, solid_js_1.createSignal)(readFreeQuotaUntil());
        const setFreeQuotaUntil = (until) => {
            setFreeQuotaUntilSignal(until);
            writeFreeQuotaUntil(until);
        };
        const freeQuotaLeft = () => Math.max(0, freeQuotaUntil() - Date.now());
        const formatQuotaLeft = (ms) => (0, schedule_1.formatCountdown)(Math.max(1, Math.ceil(ms / 60000)));
        let lastFreeQuotaToast = 0;
        const announceFreeQuota = (until) => {
            if (Math.abs(until - lastFreeQuotaToast) < 60000)
                return;
            lastFreeQuotaToast = until;
            const message = `OpenCode free DeepSeek quota exhausted — available again in ${formatQuotaLeft(until - Date.now())}.`;
            ctx.toast.show({
                title: 'DeepShift',
                description: message,
                variant: 'error',
                icon: 'warning',
                duration: 12000,
            });
            void ctx.attention?.notify?.({ title: 'DeepShift', message });
        };
        const status = () => {
            const now = new Date();
            const state = (0, schedule_1.getState)(now);
            const model = currentModel();
            const freeDeepSeek = isFreeDeepSeek(model);
            return {
                now,
                state,
                model,
                freeDeepSeek,
                relevant: !freeDeepSeek && (always || isDeepSeek(model)),
            };
        };
        const { bar, text, time } = createBar();
        ctx.add(gui_1.Slot, { at: 'window.bottom', order: 100, render: () => bar });
        ctx.add(gui_1.Style, CSS);
        const syncBar = () => {
            const { state, model, relevant, freeDeepSeek } = status();
            if (state.isOffPeak || freeDeepSeek || !relevant) {
                bar.hidden = true;
                return;
            }
            text.textContent = (0, view_model_1.barText)(state);
            time.textContent = `· ${(0, view_model_1.barCountdown)(state)}`;
            bar.title = [
                'DeepSeek peak pricing is active: the off-peak discount is not applied, so rates are 2x off-peak.',
                `Peak windows: ${(0, schedule_1.windowText)()} Beijing, Monday to Friday (excluding Chinese public holidays).`,
                `Off-peak rates resume at ${(0, schedule_1.fmtTime)(state.transitionAt, 'Asia/Shanghai')} Beijing (${(0, schedule_1.fmtTime)(state.transitionAt)} local).`,
                model ? `Selected model: ${model.providerID}/${model.modelID}.` : '',
                `Official pricing: ${PRICING_URL}`,
            ]
                .filter(Boolean)
                .join('\n');
            bar.hidden = false;
        };
        const stepModels = new Map();
        const handleFreeLimit = (error) => {
            if (error?.type !== 'provider.free-limit')
                return;
            const retry = Number(error.retryAfterMs ?? 0);
            const until = Date.now() + (retry > 0 ? retry : FREE_QUOTA_FALLBACK_MS);
            setFreeQuotaUntil(until);
            announceFreeQuota(until);
        };
        (0, gui_1.createKeyed)(() => ctx.servers.get('sidecar')?.data, (data) => {
            (0, solid_js_1.onCleanup)(data.on('session.step.started', (event) => {
                const info = event?.data;
                if (info?.assistantMessageID && info.model) {
                    stepModels.set(info.assistantMessageID, info.model);
                }
            }));
            (0, solid_js_1.onCleanup)(data.on('session.step.ended', (event) => {
                const info = event?.data;
                const model = info?.assistantMessageID ? stepModels.get(info.assistantMessageID) : undefined;
                if (info?.assistantMessageID)
                    stepModels.delete(info.assistantMessageID);
                if (!model || !isFreeDeepSeek(model) || Number(info?.cost ?? 0) !== 0)
                    return;
                if (freeQuotaUntil() > 0) {
                    setFreeQuotaUntil(0);
                    lastFreeQuotaToast = 0;
                    ctx.toast.show({
                        title: 'DeepShift',
                        description: 'OpenCode free DeepSeek quota is available again.',
                        variant: 'success',
                        icon: 'circle-check',
                        duration: 8000,
                    });
                }
            }));
            (0, solid_js_1.onCleanup)(data.on('session.step.failed', (event) => {
                const info = event?.data;
                if (info?.assistantMessageID)
                    stepModels.delete(info.assistantMessageID);
                handleFreeLimit(info?.error);
            }));
            (0, solid_js_1.onCleanup)(data.on('session.execution.failed', (event) => handleFreeLimit(event?.data?.error)));
        });
        const [tick, setTick] = (0, solid_js_1.createSignal)(0);
        const copyStatus = () => {
            const model = currentModel();
            const left = freeQuotaLeft();
            const freeStatus = left > 0
                ? `OpenCode free DeepSeek quota exhausted — available again in ${formatQuotaLeft(left)}`
                : 'DeepSeek free model — peak/off-peak pricing does not apply';
            const baseStatus = (0, view_model_1.statusLabel)((0, schedule_1.getState)());
            void ctx.system.copy(isFreeDeepSeek(model)
                ? freeStatus
                : left > 0
                    ? `${baseStatus}\nOpenCode free DeepSeek quota available again in ${formatQuotaLeft(left)}.`
                    : baseStatus);
            ctx.toast.show({ title: 'DeepShift', description: 'Status copied.', duration: 4000 });
        };
        const copySchedule = () => {
            void ctx.system.copy((0, view_model_1.scheduleText)((0, schedule_1.getState)()));
            ctx.toast.show({ title: 'DeepShift', description: 'Schedule copied.', duration: 4000 });
        };
        const rowAction = (action, state) => {
            switch (action) {
                case 'copy-status':
                    return copyStatus;
                case 'copy-schedule':
                    return copySchedule;
                case 'run-now':
                    return () => ctx.toast.show({ title: 'DeepShift', description: (0, view_model_1.adviceText)(state, false), duration: 10000 });
                case 'open-pricing':
                    return () => ctx.system.openExternal(PRICING_URL);
                default:
                    return undefined;
            }
        };
        const pillRows = (state) => {
            const rows = (0, view_model_1.buildPanelItems)(state)
                .filter((row) => !row.separator)
                .map((row) => ({
                id: row.id,
                label: row.label,
                detail: row.detail ?? row.description,
                icon: row.icon,
                tone: row.tone,
                run: rowAction(row.action, state),
            }));
            const left = freeQuotaLeft();
            if (left > 0) {
                rows.unshift({
                    id: 'free-quota',
                    label: 'Free DeepSeek quota',
                    detail: `available in ${formatQuotaLeft(left)}`,
                    icon: 'warning',
                    tone: 'warning',
                    run: undefined,
                });
            }
            return rows;
        };
        ctx.add(gui_1.ComposerPill, {
            id: 'deepshift',
            order: 10,
            show: () => {
                tick();
                const { state, model, freeDeepSeek } = status();
                if (freeDeepSeek) {
                    const left = freeQuotaLeft();
                    const remaining = left > 0 ? formatQuotaLeft(left) : '';
                    return {
                        icon: left > 0 ? 'warning' : 'circle-check',
                        tone: left > 0 ? 'warning' : 'success',
                        label: left > 0 ? `DS FREE · ${remaining} left` : 'DS FREE · no peak pricing',
                        title: left > 0
                            ? 'OpenCode free DeepSeek quota exhausted'
                            : 'DeepSeek free model: peak/off-peak pricing does not apply',
                        rows: [
                            left > 0
                                ? {
                                    id: 'free-quota',
                                    label: 'Free quota exhausted',
                                    detail: `available in ${remaining}`,
                                    icon: 'warning',
                                    tone: 'warning',
                                }
                                : {
                                    id: 'free',
                                    label: 'Free model — no peak or off-peak pricing',
                                    icon: 'circle-check',
                                    tone: 'success',
                                },
                            {
                                id: 'model',
                                label: model ? `${model.providerID}/${model.modelID}` : 'free model',
                                icon: 'models',
                            },
                        ],
                    };
                }
                return {
                    icon: state.isOffPeak ? 'circle-check' : 'warning',
                    tone: (0, view_model_1.statusTone)(state),
                    label: (0, view_model_1.pillLabel)(state),
                    title: state.isOffPeak ? OFF_PEAK_PILL_TITLE : PEAK_PILL_TITLE,
                    rows: pillRows(state),
                };
            },
        });
        let lastWarned = 0;
        const timer = setInterval(() => {
            setTick((value) => value + 1);
            if (freeQuotaUntil() > 0 && freeQuotaUntil() <= Date.now()) {
                setFreeQuotaUntil(0);
                lastFreeQuotaToast = 0;
            }
            const { state, freeDeepSeek } = status();
            if (!freeDeepSeek) {
                const threshold = state.nextIsPeak ? peakThreshold : offPeakThreshold;
                if (threshold > 0 && state.minutesRemaining <= threshold && state.transitionAt !== lastWarned) {
                    lastWarned = state.transitionAt;
                    const message = (0, view_model_1.alertText)(state, false);
                    ctx.toast.show({
                        title: 'DeepShift',
                        description: message,
                        variant: state.nextIsPeak ? 'error' : 'success',
                        icon: state.nextIsPeak ? 'warning' : 'circle-check',
                        duration: 10000,
                    });
                    void ctx.attention?.notify?.({ title: 'DeepShift', message });
                }
            }
            syncBar();
        }, 1000);
        syncBar();
        ctx.add(gui_1.Command, () => ({
            id: 'deepshift.status',
            title: ctx.t('command.status'),
            description: ctx.t('command.status.description'),
            keywords: 'deepseek peak off-peak pricing discount cost rates countdown',
            group: 'DeepShift',
            slash: { name: 'deepshift' },
            run: () => {
                const state = (0, schedule_1.getState)();
                const model = currentModel();
                const freeQuota = freeQuotaLeft();
                if (isFreeDeepSeek(model)) {
                    ctx.toast.show({
                        title: freeQuota > 0 ? 'DeepSeek free quota exhausted' : 'DeepSeek free model',
                        description: [
                            freeQuota > 0
                                ? `Free quota available again in ${formatQuotaLeft(freeQuota)}.`
                                : 'Peak/off-peak pricing does not apply to free OpenCode models.',
                            model ? `Selected model: ${model.providerID}/${model.modelID}.` : '',
                            (0, view_model_1.scheduleText)(state),
                        ]
                            .filter(Boolean)
                            .join('\n'),
                        variant: freeQuota > 0 ? 'error' : 'success',
                        icon: freeQuota > 0 ? 'warning' : 'circle-check',
                        duration: 10000,
                    });
                    return;
                }
                ctx.toast.show({
                    title: state.isOffPeak ? 'DeepSeek off-peak pricing' : 'DeepSeek peak pricing',
                    description: [
                        (0, view_model_1.statusLabel)(state),
                        state.isOffPeak ? 'Off-peak rates: 50% off.' : 'The off-peak discount is NOT applied: rates are 2x.',
                        (0, view_model_1.scheduleText)(state),
                        freeQuota > 0
                            ? `OpenCode free DeepSeek quota available again in ${formatQuotaLeft(freeQuota)}.`
                            : '',
                        `Rates verified ${schedule_1.deepSeekV4.verifiedOn}: ${PRICING_URL}`,
                        model ? `Selected model: ${model.providerID}/${model.modelID}.` : '',
                    ]
                        .filter(Boolean)
                        .join('\n'),
                    variant: state.isOffPeak ? 'success' : 'error',
                    icon: state.isOffPeak ? 'circle-check' : 'warning',
                    duration: 12000,
                });
            },
        }));
        ctx.add(gui_1.Command, () => ({
            id: 'deepshift.copyStatus',
            title: ctx.t('command.copyStatus'),
            description: ctx.t('command.copyStatus.description'),
            group: 'DeepShift',
            run: copyStatus,
        }));
        ctx.add(gui_1.Command, () => ({
            id: 'deepshift.copySchedule',
            title: ctx.t('command.copySchedule'),
            description: ctx.t('command.copySchedule.description'),
            group: 'DeepShift',
            run: copySchedule,
        }));
        ctx.add(gui_1.Command, () => ({
            id: 'deepshift.diagnostics',
            title: ctx.t('command.diagnostics'),
            description: ctx.t('command.diagnostics.description'),
            group: 'DeepShift',
            run: () => {
                ctx.toast.show({
                    title: 'DeepShift diagnostics',
                    description: (0, view_model_1.diagnosticsText)(),
                    duration: 20000,
                });
            },
        }));
        return () => clearInterval(timer);
    },
});

},
"src/schedule.ts": function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepSeekV4 = void 0;
exports.fmtTime = fmtTime;
exports.getTransitions = getTransitions;
exports.getState = getState;
exports.getUserTimeZone = getUserTimeZone;
exports.tzInfo = tzInfo;
exports.getTodaySchedule = getTodaySchedule;
exports.holidayCoverageYears = holidayCoverageYears;
exports.windowText = windowText;
exports.offPeakReason = offPeakReason;
exports.buildTooltip = buildTooltip;
exports.formatCountdown = formatCountdown;
exports.formatCountdownSec = formatCountdownSec;
exports.deepSeekV4 = {
    timezone: 'Asia/Shanghai',
    weekendOffPeak: true,
    peakWindows: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' },
    ],
    holidayOffPeak: true,
    holidays: [
        '2026-01-01', '2026-01-02',
        '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-23',
        '2026-04-06',
        '2026-05-01', '2026-05-04', '2026-05-05',
        '2026-06-19',
        '2026-09-25',
        '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07',
        '2027-01-01',
        '2027-02-05', '2027-02-08',
        '2027-04-05',
        '2027-06-09',
        '2027-09-15',
        '2027-10-01',
    ],
    models: [
        {
            id: 'deepseek-flash',
            version: 'DeepSeek-V4.1-Flash',
            cacheHit: { peak: '$0.006', offPeak: '$0.003' },
            cacheMiss: { peak: '$0.30', offPeak: '$0.15' },
            output: { peak: '$1.20', offPeak: '$0.60' },
            concurrency: 2500,
        },
        {
            id: 'deepseek-v4-pro',
            version: 'DeepSeek-V4-Pro-0813',
            cacheHit: { peak: '$0.044', offPeak: '$0.022' },
            cacheMiss: { peak: '$1.32', offPeak: '$0.66' },
            output: { peak: '$3.96', offPeak: '$1.98' },
            concurrency: 500,
        },
    ],
    note: 'Off-peak = 50% of peak · USD per 1M tokens',
    verifiedOn: '2026-10-02',
    sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing/',
};
const MIN_PER_DAY = 1440;
const LOOKAHEAD_DAYS = 21;
function parseMin(s) {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
}
function isWeekend(dow) {
    return dow === 'Sat' || dow === 'Sun';
}
function tzOffsetMinutes(tz, date) {
    const p = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).formatToParts(date);
    const g = (t) => p.find((x) => x.type === t).value;
    let h = parseInt(g('hour'), 10);
    if (h === 24)
        h = 0;
    const asUTC = Date.UTC(+g('year'), +g('month') - 1, +g('day'), h, +g('minute'), +g('second'));
    return Math.round((asUTC - date.getTime()) / 60000);
}
function wallToEpoch(y, mo, d, h, mi, tz) {
    const ms = Date.UTC(y, mo - 1, d, h, mi);
    return ms - tzOffsetMinutes(tz, new Date(ms)) * 60000;
}
function providerParts(date, tz) {
    const p = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour12: false,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).formatToParts(date);
    const g = (t) => p.find((x) => x.type === t).value;
    let h = parseInt(g('hour'), 10);
    if (h === 24)
        h = 0;
    const mo = +g('month');
    const d = +g('day');
    return {
        dow: g('weekday'),
        totalMin: h * 60 + parseInt(g('minute'), 10),
        y: +g('year'),
        mo,
        d,
        key: `${g('year')}-${g('month')}-${g('day')}`,
    };
}
function isHoliday(key, sch) {
    return sch.holidayOffPeak && sch.holidays.includes(key);
}
function isFree(parts, sch) {
    return ((sch.weekendOffPeak && isWeekend(parts.dow)) || isHoliday(parts.key, sch));
}
function fmtTime(at, tz) {
    return new Date(at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        ...(tz && { timeZone: tz }),
    });
}
function phaseAt(parts, sch) {
    if (isFree(parts, sch))
        return 'offPeak';
    for (const w of sch.peakWindows) {
        const s = parseMin(w.start);
        const e = parseMin(w.end);
        if (parts.totalMin >= s && parts.totalMin < e)
            return 'peak';
    }
    return 'offPeak';
}
function getTransitions(now = new Date(), sch = exports.deepSeekV4, limit = 6) {
    const candidates = [];
    for (let k = 0; k < LOOKAHEAD_DAYS; k++) {
        const p = providerParts(new Date(now.getTime() + k * MIN_PER_DAY * 60000), sch.timezone);
        if (isFree(p, sch))
            continue;
        for (const w of sch.peakWindows) {
            const s = parseMin(w.start);
            const e = parseMin(w.end);
            candidates.push({ at: wallToEpoch(p.y, p.mo, p.d, Math.floor(s / 60), s % 60, sch.timezone), to: 'peak' });
            candidates.push({ at: wallToEpoch(p.y, p.mo, p.d, Math.floor(e / 60), e % 60, sch.timezone), to: 'offPeak' });
        }
    }
    return candidates
        .filter((c) => c.at > now.getTime())
        .sort((a, b) => a.at - b.at)
        .slice(0, limit);
}
function getState(now = new Date(), sch = exports.deepSeekV4) {
    const parts = providerParts(now, sch.timezone);
    const current = phaseAt(parts, sch);
    const transitions = getTransitions(now, sch, 6);
    const next = transitions[0];
    const remainingSec = Math.max(0, (next.at - now.getTime()) / 1000);
    let bestWindow = null;
    if (current === 'offPeak') {
        const nextPeak = transitions.find((t) => t.to === 'peak');
        bestWindow = { start: now.getTime(), end: nextPeak ? nextPeak.at : now.getTime() };
    }
    else {
        const nextOff = transitions.find((t) => t.to === 'offPeak');
        if (nextOff) {
            const after = transitions.find((t) => t.at > nextOff.at && t.to === 'peak');
            bestWindow = { start: nextOff.at, end: after ? after.at : nextOff.at };
        }
    }
    return {
        isOffPeak: current === 'offPeak',
        isWeekend: sch.weekendOffPeak && isWeekend(parts.dow),
        isHoliday: isHoliday(parts.key, sch),
        nextIsPeak: next.to === 'peak',
        minutesRemaining: Math.ceil(remainingSec / 60),
        secondsRemaining: Math.max(0, Math.ceil(remainingSec)),
        transitionAt: next.at,
        nextTransitions: transitions.slice(0, 2),
        bestWindow,
    };
}
function getUserTimeZone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    }
    catch {
        return 'UTC';
    }
}
function tzInfo(tz) {
    const map = {
        'Asia/Shanghai': { flag: '🇨🇳', country: 'China' },
        'Asia/Karachi': { flag: '🇵🇰', country: 'Pakistan' },
        'Asia/Kolkata': { flag: '🇮🇳', country: 'India' },
        'Asia/Dubai': { flag: '🇦🇪', country: 'UAE' },
        'Asia/Tokyo': { flag: '🇯🇵', country: 'Japan' },
        'Asia/Seoul': { flag: '🇰🇷', country: 'South Korea' },
        'Asia/Singapore': { flag: '🇸🇬', country: 'Singapore' },
        'Europe/London': { flag: '🇬🇧', country: 'UK' },
        'Europe/Berlin': { flag: '🇩🇪', country: 'Germany' },
        'Europe/Paris': { flag: '🇫🇷', country: 'France' },
        'America/New_York': { flag: '🇺🇸', country: 'USA' },
        'America/Los_Angeles': { flag: '🇺🇸', country: 'USA' },
        'America/Chicago': { flag: '🇺🇸', country: 'USA' },
        'Australia/Sydney': { flag: '🇦🇺', country: 'Australia' },
    };
    return map[tz] || { flag: '🌍', country: tz };
}
function getTodaySchedule(now = new Date(), sch = exports.deepSeekV4) {
    const tz = getUserTimeZone();
    const p = providerParts(now, sch.timezone);
    const windows = sch.peakWindows.map((w) => {
        const s = parseMin(w.start);
        const e = parseMin(w.end);
        const startEpoch = wallToEpoch(p.y, p.mo, p.d, Math.floor(s / 60), s % 60, sch.timezone);
        const endEpoch = wallToEpoch(p.y, p.mo, p.d, Math.floor(e / 60), e % 60, sch.timezone);
        return { start: fmtTime(startEpoch, tz), end: fmtTime(endEpoch, tz), startEpoch, endEpoch };
    });
    return {
        isWeekend: sch.weekendOffPeak && isWeekend(p.dow),
        isHoliday: isHoliday(p.key, sch),
        windows,
        tz,
    };
}
function holidayCoverageYears(sch = exports.deepSeekV4) {
    const years = new Set(sch.holidays.map((k) => parseInt(k.slice(0, 4), 10)));
    return [...years].sort((a, b) => a - b);
}
function windowText(sch = exports.deepSeekV4) {
    return sch.peakWindows.map((w) => `${w.start}–${w.end}`).join(' & ');
}
function offPeakReason(s) {
    if (s.isHoliday)
        return 'China holiday';
    if (s.isWeekend)
        return 'weekend';
    return '';
}
function buildTooltip(s, userTz, sch = exports.deepSeekV4) {
    const user = tzInfo(userTz);
    const why = offPeakReason(s);
    const prices = sch.models
        .map((m) => `\`${m.id}\` · ${m.version}\n` +
        `in hit ${m.cacheHit.peak} / ${m.cacheHit.offPeak} · in miss ${m.cacheMiss.peak} / ${m.cacheMiss.offPeak}\n` +
        `out **${m.output.peak}** / **${m.output.offPeak}** · ${m.concurrency} concurrent`)
        .join('\n\n');
    return (`**DeepSeek**\n\n` +
        `${s.isOffPeak ? '🟢 OFF-PEAK' : '🔴 PEAK PRICING'}${why ? ` (${why})` : ''}\n\n` +
        `Window ends in **${formatCountdown(s.minutesRemaining)}**\n\n` +
        `${user.flag} Local: **${fmtTime(s.transitionAt)}** ${user.country} (${userTz})\n` +
        `🇨🇳 Beijing: **${fmtTime(s.transitionAt, 'Asia/Shanghai')}** China\n\n` +
        `**${sch.note}**\n\n` +
        `${prices}\n\n` +
        `Weekends & Chinese public holidays: always off-peak\n\n` +
        `Peak (Beijing ${windowText(sch)}) 🇨🇳\n\n` +
        `Verified ${sch.verifiedOn} · [official pricing page](${sch.sourceUrl})`);
}
function formatCountdown(minutes) {
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    return d > 0 ? `${d}d ${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}
function formatCountdownSec(totalSeconds) {
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (d > 0)
        return `${d}d ${String(h).padStart(2, '0')}h`;
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

},
"src/view-model.ts": function (module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LBL_RUN_NOW = exports.LBL_COPY_SCHEDULE = exports.LBL_COPY_STATUS = void 0;
exports.statusText = statusText;
exports.statusLabel = statusLabel;
exports.statusTone = statusTone;
exports.barText = barText;
exports.barCountdown = barCountdown;
exports.pillLabel = pillLabel;
exports.alertText = alertText;
exports.adviceText = adviceText;
exports.scheduleText = scheduleText;
exports.diagnosticsText = diagnosticsText;
exports.shortHour = shortHour;
exports.dayTag = dayTag;
exports.pricingRows = pricingRows;
exports.buildPanelItems = buildPanelItems;
const schedule_1 = __require("src/schedule.ts");
exports.LBL_COPY_STATUS = '📋 Copy current status';
exports.LBL_COPY_SCHEDULE = "📋 Copy today's schedule";
exports.LBL_RUN_NOW = '💡 Should I run now?';
function statusText(s, seconds = true) {
    const cd = seconds ? (0, schedule_1.formatCountdownSec)(s.secondsRemaining) : (0, schedule_1.formatCountdown)(s.minutesRemaining);
    const why = (0, schedule_1.offPeakReason)(s);
    if (why)
        return `🟢 DS OFF · ${why} · ${cd}`;
    if (s.isOffPeak)
        return `🟢 DS OFF · ${cd}`;
    return `🔴 DS PEAK · ${cd}`;
}
function statusLabel(s) {
    return statusText(s, false);
}
function statusTone(s) {
    return s.isOffPeak ? 'success' : 'danger';
}
function barText(s) {
    return s.isOffPeak
        ? 'DeepSeek off-peak pricing · 50% discount applied'
        : 'DeepSeek peak pricing · off-peak discount NOT applied · 2x rates';
}
function barCountdown(s) {
    return `ends in ${(0, schedule_1.formatCountdown)(s.minutesRemaining)}`;
}
function pillLabel(s) {
    const cd = (0, schedule_1.formatCountdown)(s.minutesRemaining);
    const why = (0, schedule_1.offPeakReason)(s);
    return s.isOffPeak ? `DS OFF${why ? ` · ${why}` : ''} · ${cd}` : `DS PEAK · ${cd}`;
}
function alertText(s, seconds = true) {
    const cd = seconds ? (0, schedule_1.formatCountdownSec)(s.secondsRemaining) : (0, schedule_1.formatCountdown)(s.minutesRemaining);
    return s.nextIsPeak
        ? `DeepSeek peak pricing starts in ${cd}.`
        : `DeepSeek off-peak pricing starts in ${cd} — good time for bulk jobs.`;
}
function adviceText(s, seconds = true) {
    if (s.isOffPeak)
        return 'OFF-PEAK — good time for large AI workloads. Run batch jobs now.';
    const cd = seconds ? (0, schedule_1.formatCountdownSec)(s.secondsRemaining) : (0, schedule_1.formatCountdown)(s.minutesRemaining);
    return `PEAK — large/batch workloads are cheaper if delayed. Off-peak starts in ${cd}.`;
}
function scheduleText(s = (0, schedule_1.getState)(), now = new Date()) {
    const day = (0, schedule_1.getTodaySchedule)(now);
    const head = `DeepSeek — ${day.tz}`;
    if (s.isHoliday)
        return `${head}\nChinese public holiday: all day off-peak`;
    if (s.isWeekend)
        return `${head}\nWeekend: all day off-peak`;
    const lines = day.windows.map((w) => `${w.start}–${w.end} Peak`);
    lines.push('Other hours: Off-peak');
    return `${head}\n${lines.join('\n')}`;
}
function diagnosticsText(now = new Date()) {
    const userTz = (0, schedule_1.getUserTimeZone)();
    const user = (0, schedule_1.tzInfo)(userTz);
    const bj = (0, schedule_1.tzInfo)('Asia/Shanghai');
    const years = (0, schedule_1.holidayCoverageYears)();
    const stale = years.includes(now.getFullYear()) ? '' : '  (STALE — no data for this year)';
    return [
        `System timezone: ${userTz} ${user.flag} ${user.country}`,
        `Local time: ${(0, schedule_1.fmtTime)(now.getTime())} ${user.flag}`,
        `Beijing: ${(0, schedule_1.fmtTime)(now.getTime(), 'Asia/Shanghai')} ${bj.flag} ${bj.country}`,
        `UTC: ${now.toISOString().slice(11, 16)}`,
        `Schedule timezone: ${schedule_1.deepSeekV4.timezone} ${bj.flag} ${bj.country}`,
        `Weekend evaluated in: ${schedule_1.deepSeekV4.timezone} ${bj.flag}`,
        `Weekend off-peak: ${schedule_1.deepSeekV4.weekendOffPeak}`,
        `Holiday off-peak: ${schedule_1.deepSeekV4.holidayOffPeak}`,
        `Holiday calendar covers: ${years[0]}-${years[years.length - 1]}${stale}`,
        `Peak windows (Beijing): ${schedule_1.deepSeekV4.peakWindows.map((w) => `${w.start}-${w.end}`).join(', ')}`,
        `Prices verified: ${schedule_1.deepSeekV4.verifiedOn}`,
        `Source: ${schedule_1.deepSeekV4.sourceUrl}`,
    ].join('\n');
}
function shortHour(epoch) {
    const d = new Date(epoch);
    const h = d.getHours();
    const m = d.getMinutes();
    return m === 0 ? String(h).padStart(2, '0') : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function dayTag(at, now) {
    const today = now.toDateString();
    const e = new Date(at).toDateString();
    if (e === today)
        return 'today';
    const tomorrow = new Date(now.getTime() + 86400000).toDateString();
    if (e === tomorrow)
        return 'tomorrow';
    return new Date(at).toLocaleDateString([], { weekday: 'short' });
}
function pricingRows(now = new Date()) {
    const rows = [];
    for (const m of schedule_1.deepSeekV4.models) {
        rows.push({
            id: `model:${m.id}`,
            label: m.id,
            description: m.version,
            icon: 'models',
        });
        rows.push({
            id: `model:${m.id}:hit`,
            label: '  input · cache hit',
            detail: `Peak ${m.cacheHit.peak} · off-peak ${m.cacheHit.offPeak}`,
        });
        rows.push({
            id: `model:${m.id}:miss`,
            label: '  input · cache miss',
            detail: `Peak ${m.cacheMiss.peak} · off-peak ${m.cacheMiss.offPeak}`,
        });
        rows.push({
            id: `model:${m.id}:out`,
            label: '  output',
            detail: `Peak ${m.output.peak} · off-peak ${m.output.offPeak}`,
        });
        rows.push({
            id: `model:${m.id}:concurrency`,
            label: '  concurrency limit',
            detail: `${m.concurrency} in-flight`,
        });
    }
    rows.push({ id: 'note', label: '  note', detail: schedule_1.deepSeekV4.note });
    const years = (0, schedule_1.holidayCoverageYears)();
    if (!years.includes(now.getFullYear())) {
        rows.push({
            id: 'stale-calendar',
            label: '⚠ Holiday calendar out of date',
            detail: `Covers ${years[0]}–${years[years.length - 1]}. Chinese holidays are NOT applied for ${now.getFullYear()} — verify against the official page before trusting peak days.`,
            icon: 'warning',
            tone: 'warning',
        });
    }
    rows.push({
        id: 'schedule',
        label: 'Schedule',
        detail: `DeepSeek · 🇨🇳 China (${schedule_1.deepSeekV4.timezone}) · ${(0, schedule_1.windowText)()}`,
    });
    return rows;
}
function buildPanelItems(s, now = new Date()) {
    const cd = (0, schedule_1.formatCountdownSec)(s.secondsRemaining);
    const userTz = (0, schedule_1.getUserTimeZone)();
    const user = (0, schedule_1.tzInfo)(userTz);
    const rows = [
        {
            id: 'state',
            label: s.isOffPeak ? '🟢 OFF-PEAK' : '🔴 PEAK PRICING',
            detail: `${s.isOffPeak ? 'Ends' : 'Peak ends'} in ${cd} · ${(0, schedule_1.fmtTime)(s.transitionAt)} ${user.flag} ${user.country} · ${(0, schedule_1.fmtTime)(s.transitionAt, 'Asia/Shanghai')} 🇨🇳 China`,
            icon: s.isOffPeak ? 'circle-check' : 'warning',
            tone: statusTone(s),
        },
    ];
    s.nextTransitions.slice(0, 2).forEach((t, index) => {
        const to = t.to === 'peak' ? '🔴 Peak' : '🟢 Off-peak';
        rows.push({
            id: index === 0 ? 'next' : 'then',
            label: index === 0
                ? `Next   ${to} · ${(0, schedule_1.fmtTime)(t.at)} · ${(0, schedule_1.formatCountdownSec)(Math.max(0, Math.ceil((t.at - now.getTime()) / 1000)))}`
                : `Then   ${to} · ${(0, schedule_1.fmtTime)(t.at)} ${dayTag(t.at, now)}`,
        });
    });
    if (s.bestWindow && s.bestWindow.end > s.bestWindow.start) {
        rows.push({
            id: 'best-window',
            label: '💡 Best off-peak window',
            detail: `${(0, schedule_1.fmtTime)(s.bestWindow.start)} ${dayTag(s.bestWindow.start, now)} → ${(0, schedule_1.fmtTime)(s.bestWindow.end)} ${dayTag(s.bestWindow.end, now)} · ${(0, schedule_1.formatCountdown)(Math.round((s.bestWindow.end - s.bestWindow.start) / 60000))}`,
        });
    }
    rows.push({
        id: 'schedule-header',
        label: `──── Today's schedule ${user.flag} ${user.country} (${userTz}) ────`,
        separator: true,
    });
    const day = (0, schedule_1.getTodaySchedule)(now);
    if (day.isWeekend) {
        rows.push({ id: 'today', label: '🟢 Off-peak', detail: 'All day (weekend rule)' });
    }
    else if (day.isHoliday) {
        rows.push({ id: 'today', label: '🟢 Off-peak', detail: 'All day (Chinese public holiday)' });
    }
    else {
        day.windows.forEach((w, index) => {
            rows.push({
                id: `today-peak-${index}`,
                label: `${shortHour(w.startEpoch)}–${shortHour(w.endEpoch)} 🔴 Peak`,
            });
        });
        rows.push({ id: 'today-rest', label: 'Other hours 🟢 Off-peak' });
    }
    rows.push({
        id: 'run-now',
        label: exports.LBL_RUN_NOW,
        detail: 'Rule-based advice, no input needed',
        action: 'run-now',
        icon: s.isOffPeak ? 'circle-check' : 'circle-exclamation',
        tone: statusTone(s),
    });
    rows.push({ id: 'pricing-header', label: '──── Pricing ────', separator: true });
    rows.push(...pricingRows(now));
    rows.push({
        id: 'pricing-page',
        label: '📖 Official pricing page',
        detail: `Verified ${schedule_1.deepSeekV4.verifiedOn} · ${schedule_1.deepSeekV4.sourceUrl}`,
        action: 'open-pricing',
        icon: 'square-arrow-top-right',
    });
    rows.push({ id: 'copy-status', label: exports.LBL_COPY_STATUS, action: 'copy-status', icon: 'copy' });
    rows.push({ id: 'copy-schedule', label: exports.LBL_COPY_SCHEDULE, action: 'copy-schedule', icon: 'copy' });
    return rows;
}

}
};
var __cache = Object.create(null);
function __require(id) {
	var cached = __cache[id];
	if (cached) return cached.exports;
	var module = (__cache[id] = { exports: {} });
	__modules[id](module, module.exports, require);
	return module.exports;
}
module.exports = __require("opencode/gui.cts");
