// DeepShift for OpenChamber.
//
// The rail panel shows the same DeepSeek peak/off-peak picture the VS Code
// extension and the OpenCode plugin do: a live countdown hero, the next
// transitions, the best off-peak window, today's schedule in your timezone,
// the per-model rate card, run-now advice, and copy/open actions. All pricing,
// schedule, holiday and presentation logic comes from ../../src/schedule and
// ../../src/view-model — this file is only the UI adapter, and the only place
// that touches the DOM or the OpenChamber host.
//
// Built by `npm run build:openchamber` into panel/main.js (a single IIFE; the
// host never compiles TypeScript). The extension package also ships the
// OpenCode plugin in ./plugin, so one install covers both clients.

import { connectHost } from '@openchamber/sdk';
import { applyHostReady, mountBanner, mountButton, mountSeparator } from '@openchamber/sdk/ui';
import type { BannerHandle, ButtonHandle } from '@openchamber/sdk/ui';
import {
	deepSeekV4,
	fmtTime,
	formatCountdown,
	formatCountdownSec,
	getState,
	getTodaySchedule,
	getUserTimeZone,
	holidayCoverageYears,
	offPeakReason,
	tzInfo,
	windowText,
	type TimeState,
} from '../../src/schedule';
import {
	adviceText,
	alertText,
	dayTag,
	diagnosticsText,
	scheduleText,
	shortHour,
	statusLabel,
} from '../../src/view-model';

const PRICING_URL = deepSeekV4.sourceUrl;
// Pre-transition toast, matching the other clients' default.
const ALERT_BEFORE_MINUTES = 10;

const CSS = `
* { box-sizing: border-box; }
#root { display: flex; flex-direction: column; gap: 12px; }

.ds-hero {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 12px 14px;
	border-radius: var(--oc-radius, 9px);
	border: 0.5px solid var(--oc-border, transparent);
	background: var(--oc-elevated, transparent);
}
.ds-hero[data-peak="true"] {
	border-color: color-mix(in srgb, var(--oc-error, #dc2626) 45%, transparent);
	background: color-mix(in srgb, var(--oc-error, #dc2626) 10%, transparent);
}
.ds-hero-main { display: flex; align-items: center; gap: 8px; }
.ds-dot { flex: 0 0 auto; width: 9px; height: 9px; border-radius: 999px; background: var(--oc-success, #16a34a); }
.ds-hero[data-peak="true"] .ds-dot { background: var(--oc-error, #dc2626); animation: ds-pulse 1.6s ease-in-out infinite; }
.ds-hero-state { font-weight: 600; letter-spacing: 0.02em; }
.ds-hero-cd { margin-left: auto; font-family: var(--oc-mono, monospace); font-variant-numeric: tabular-nums; font-size: 0.9em; color: var(--oc-muted, gray); }
.ds-hero-why { font-size: 0.8em; color: var(--oc-muted, gray); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@keyframes ds-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .ds-dot { animation: none; } }

.ds-section { display: flex; flex-direction: column; gap: 3px; }
.ds-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 2px 0; }
.ds-row .ds-k { flex: 0 1 auto; color: var(--oc-muted, gray); font-size: 0.85em; white-space: nowrap; }
.ds-row .ds-v { flex: 0 1 auto; font-size: 0.95em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }
.ds-row .ds-v.mono { font-family: var(--oc-mono, monospace); font-variant-numeric: tabular-nums; }

.ds-model { display: flex; flex-direction: column; gap: 2px; padding: 7px 0; border-bottom: 0.5px solid var(--oc-border, transparent); }
.ds-model:last-child { border-bottom: none; }
.ds-model-name { font-family: var(--oc-mono, monospace); font-size: 0.9em; }
.ds-model-name .ds-ver { color: var(--oc-muted, gray); font-family: var(--oc-font, inherit); font-size: 0.85em; margin-left: 6px; }

.ds-note { font-size: 0.8em; color: var(--oc-muted, gray); padding: 4px 0 2px; }
.ds-verified { font-size: 0.8em; color: var(--oc-muted, gray); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.ds-diag summary { cursor: pointer; color: var(--oc-muted, gray); font-size: 0.85em; user-select: none; }
.ds-diag pre {
	margin: 8px 0 0;
	padding: 10px;
	font-size: 0.8em;
	font-family: var(--oc-mono, monospace);
	white-space: pre-wrap;
	word-break: break-word;
	background: var(--oc-muted-surface, transparent);
	border: 0.5px solid var(--oc-border, transparent);
	border-radius: var(--oc-radius, 9px);
}

/* The full-screen page reuses this layout; keep it a readable column there. */
:root[data-oc-surface="page"] #root { max-width: 560px; margin-inline: auto; }
`;

const host = connectHost();
const root = document.querySelector('#root') as HTMLElement;

const style = document.createElement('style');
style.textContent = CSS;
document.head.appendChild(style);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function row(key: string): { root: HTMLDivElement; value: HTMLElement } {
	const r = el('div', 'ds-row');
	r.append(el('span', 'ds-k', key), el('span', 'ds-v'));
	return { root: r, value: r.lastElementChild as HTMLElement };
}

// ── Static structure ─────────────────────────────────────────────────────────

const hero = el('section', 'ds-hero');
const heroMain = el('div', 'ds-hero-main');
const dot = el('span', 'ds-dot');
const heroState = el('span', 'ds-hero-state');
const heroCd = el('span', 'ds-hero-cd');
heroMain.append(dot, heroState, heroCd);
const heroWhy = el('div', 'ds-hero-why');
hero.append(heroMain, heroWhy);

const transitions = el('div', 'ds-section');
const nextRow = row('Next');
const thenRow = row('Then');
const bestRow = row('Best off-peak');
transitions.append(nextRow.root, thenRow.root, bestRow.root);

const scheduleSeparator = el('div');
const today = el('div', 'ds-section');
const advice = el('div');
const pricingSeparator = el('div');
const pricing = el('div', 'ds-section');
const stale = el('div');
const verified = el('div', 'ds-verified');
const actions = el('div', 'ds-actions');
const diagnostics = el('details', 'ds-diag');
const diagnosticsSummary = el('summary', undefined, 'Diagnostics');
const diagnosticsPre = el('pre');
diagnostics.append(diagnosticsSummary, diagnosticsPre);

root.append(
	hero,
	transitions,
	scheduleSeparator,
	today,
	advice,
	pricingSeparator,
	pricing,
	stale,
	verified,
	actions,
	diagnostics
);

// The rate card never changes while the page is open: build it once.
for (const m of deepSeekV4.models) {
	const block = el('div', 'ds-model');
	const name = el('div', 'ds-model-name', m.id);
	const version = el('span', 'ds-ver', m.version);
	name.append(version);
	block.append(name);
	const lanes: Array<[string, string]> = [
		['input · cache hit', `peak ${m.cacheHit.peak} · off-peak ${m.cacheHit.offPeak}`],
		['input · cache miss', `peak ${m.cacheMiss.peak} · off-peak ${m.cacheMiss.offPeak}`],
		['output', `peak ${m.output.peak} · off-peak ${m.output.offPeak}`],
		['concurrency', `${m.concurrency} in-flight`],
	];
	for (const [k, v] of lanes) {
		const r = row(k);
		r.value.textContent = v;
		r.value.classList.add('mono');
		block.append(r.root);
	}
	pricing.append(block);
}
pricing.append(el('div', 'ds-note', deepSeekV4.note));

// ── Host wiring ──────────────────────────────────────────────────────────────

let mounted = false;
let freeModel = false; // the session's model is a free DeepSeek offering
let lastWarned = 0; // transitionAt already toasted
let lastSignature = ''; // structural state; repaint when it changes
let adviceHandle: BannerHandle | null = null;
let staleHandle: BannerHandle | null = null;

const isFreeDeepSeekModel = (model: string | undefined): boolean => {
	const id = (model ?? '').toLowerCase();
	return id.includes('deepseek') && id.endsWith('-free');
};

const fail = (what: string, error: unknown) => {
	console.warn(`DeepShift: ${what}`, error);
	void host
		.toast({ kind: 'error', message: `DeepShift: ${what} failed` })
		.catch(() => undefined);
};

const copyStatus = () =>
	(void host
		.writeClipboard(freeModel ? 'DeepSeek free model — peak/off-peak pricing does not apply' : statusLabel(getState()))
		.then(() => host.toast({ kind: 'success', message: 'DeepShift: status copied' }))
		.catch((error) => fail('copy status', error)));

const copySchedule = () =>
	(void host
		.writeClipboard(scheduleText())
		.then(() => host.toast({ kind: 'success', message: 'DeepShift: schedule copied' }))
		.catch((error) => fail('copy schedule', error)));

const openPricing = () => (void host.openUrl(PRICING_URL).catch((error) => fail('open pricing page', error)));

const mountControls = () => {
	const userTz = getUserTimeZone();
	const user = tzInfo(userTz);
	const scheduleSep = mountSeparator(scheduleSeparator, { label: `Today's schedule ${user.flag} ${user.country} (${userTz})` });
	const pricingSep = mountSeparator(pricingSeparator, { label: 'Pricing · USD per 1M tokens' });
	adviceHandle = mountBanner(advice, { tone: 'info', title: 'Should I run now?', body: '…' });
	const copyStatusButton = mountButton(actions, { label: 'Copy status', variant: 'secondary', size: 'sm', onClick: copyStatus });
	const copyScheduleButton = mountButton(actions, { label: "Copy today's schedule", variant: 'secondary', size: 'sm', onClick: copySchedule });
	const pricingButton = mountButton(actions, { label: 'Pricing page', variant: 'default', size: 'sm', onClick: openPricing });
	void scheduleSep;
	void pricingSep;
	void copyStatusButton;
	void copyScheduleButton;
	void pricingButton;
};

host.onReady((ctx) => {
	applyHostReady(ctx, document.documentElement);
	if (mounted) return;
	mounted = true;
	mountControls();
	tick();
});

host.onSession((session) => {
	const next = isFreeDeepSeekModel(session?.model);
	if (next !== freeModel) {
		freeModel = next;
		lastSignature = '';
	}
});

window.addEventListener('pagehide', () => host.dispose());

// ── Rendering ────────────────────────────────────────────────────────────────

const transitionLabel = (to: 'peak' | 'offPeak') => (to === 'peak' ? '🔴 Peak' : '🟢 Off-peak');

const paintTicking = (state: TimeState) => {
	heroCd.textContent = freeModel ? '' : formatCountdownSec(state.secondsRemaining);
	const next = state.nextTransitions[0];
	if (next) {
		const inSec = Math.max(0, Math.ceil((next.at - Date.now()) / 1000));
		nextRow.value.textContent = `${transitionLabel(next.to)} · ${fmtTime(next.at)} · in ${formatCountdownSec(inSec)}`;
	} else {
		nextRow.value.textContent = '—';
	}
};

const paint = (state: TimeState, now: Date) => {
	hero.dataset.peak = !state.isOffPeak && !freeModel ? 'true' : 'false';
	heroState.textContent = freeModel ? 'DS FREE' : state.isOffPeak ? 'DS OFF' : 'DS PEAK';

	const reason = offPeakReason(state);
	if (freeModel) {
		heroWhy.textContent = 'free DeepSeek model — peak/off-peak pricing does not apply';
	} else if (state.isOffPeak && reason) {
		heroWhy.textContent = `${reason} — all day off-peak`;
	} else if (state.isOffPeak) {
		heroWhy.textContent = `off-peak · ${windowText()} Beijing are the peak windows`;
	} else {
		heroWhy.textContent = `off-peak discount NOT applied · resumes ${fmtTime(state.transitionAt)} local · ${fmtTime(
			state.transitionAt,
			'Asia/Shanghai'
		)} Beijing`;
	}

	const then = state.nextTransitions[1];
	thenRow.root.hidden = !then;
	if (then) {
		const tag = dayTag(then.at, now);
		thenRow.value.textContent = `${transitionLabel(then.to)} · ${fmtTime(then.at)}${tag ? ` · ${tag}` : ''}`;
	}

	const w = state.bestWindow;
	bestRow.root.hidden = !w || w.end <= w.start;
	if (w && w.end > w.start) {
		bestRow.value.textContent = `${fmtTime(w.start)} ${dayTag(w.start, now)} → ${fmtTime(w.end)} ${dayTag(w.end, now)} · ${formatCountdown(
			Math.round((w.end - w.start) / 60000)
		)}`;
	}

	// Today's schedule in the user's timezone.
	for (const child of Array.from(today.children)) today.removeChild(child);
	const day = getTodaySchedule(now);
	if (day.isWeekend) {
		today.append(makeTodayRow('🟢 Off-peak', 'all day (weekend rule)'));
	} else if (day.isHoliday) {
		today.append(makeTodayRow('🟢 Off-peak', 'all day (Chinese public holiday)'));
	} else {
		for (const w of day.windows) today.append(makeTodayRow(`${shortHour(w.startEpoch)}–${shortHour(w.endEpoch)}`, '🔴 Peak'));
		today.append(makeTodayRow('Other hours', '🟢 Off-peak'));
	}

	if (adviceHandle) {
		adviceHandle.update(
			freeModel
				? { tone: 'info', title: 'Should I run now?', body: 'Free DeepSeek model — peak/off-peak pricing does not apply to it.' }
				: {
						tone: state.isOffPeak ? 'success' : 'warning',
						title: 'Should I run now?',
						body: adviceText(state, false),
					}
		);
	}

	// Stale holiday calendar: warn only for a year the bundle does not cover.
	const years = holidayCoverageYears();
	const staleNow = !years.includes(now.getFullYear());
	if (staleNow && !staleHandle) {
		staleHandle = mountBanner(stale, {
			tone: 'warning',
			title: 'Holiday calendar out of date',
			body: `Covers ${years[0]}–${years[years.length - 1]}. Chinese holidays are NOT applied for ${now.getFullYear()} — verify against the official page.`,
		});
	} else if (!staleNow && staleHandle) {
		staleHandle.dispose();
		staleHandle = null;
	}

	verified.textContent = `Rates verified ${deepSeekV4.verifiedOn} · peak ${windowText()} Beijing · ${PRICING_URL}`;
	diagnosticsPre.textContent = diagnosticsText(now);
};

function makeTodayRow(k: string, v: string) {
	const r = row(k);
	r.value.classList.remove('mono');
	return r.root;
}

const tick = () => {
	const now = new Date();
	const state = getState(now);
	paintTicking(state);

	const signature = `${state.isOffPeak}|${state.isWeekend}|${state.isHoliday}|${freeModel}|${state.transitionAt}|${now.toDateString()}`;
	if (signature !== lastSignature) {
		lastSignature = signature;
		paint(state, now);
	}

	if (!freeModel) {
		const threshold = ALERT_BEFORE_MINUTES;
		if (threshold > 0 && state.minutesRemaining <= threshold && state.transitionAt !== lastWarned) {
			lastWarned = state.transitionAt;
			void host
				.toast({ kind: state.nextIsPeak ? 'error' : 'success', message: alertText(state, false) })
				.catch(() => undefined);
		}
	}
};

const timer = window.setInterval(tick, 1000);
window.addEventListener('pagehide', () => window.clearInterval(timer));
