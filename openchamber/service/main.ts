// DeepShift OpenChamber service.
//
// Two jobs:
//
//  - `GET /status` answers the Work Status section (`contributes.statusSection
//    .source`) the app polls while the section is on screen: state dot, next
//    transition, run-now advice, stale-calendar warning.
//  - It puts one sidebar mark on the session in front while that session's
//    model is a DeepSeek one (paid or free), turning amber 10 minutes before
//    a transition on a paid model — the app has no extension-sent
//    notification, so this is the always-visible alert.
//
// Everything is derived from the clock and the bundled schedule; the only
// state is which mark is currently set, and it is re-derived on every check so
// a restarted process converges.

import * as http from 'node:http';
import { createServiceHost } from '@openchamber/sdk';
import type { GuestStatusRow, GuestStatusView, GuestTone } from '@openchamber/sdk';
import { fmtTime, formatCountdown, getState, holidayCoverageYears } from '../../src/schedule';
import type { TimeState } from '../../src/schedule';
import { adviceText, dayTag, pillLabel } from '../../src/view-model';
import { isDeepSeek, isFreeDeepSeek, readCurrentSession } from './session-state';

const token = process.env.OPENCHAMBER_SERVICE_TOKEN ?? '';
// Pre-transition alert, matching the other clients' default.
const ALERT_BEFORE_MINUTES = 10;
// How often the sidebar mark is re-derived; a transition wakes it sooner.
const MARK_REFRESH_MS = 10_000;

// ── Work Status section ──────────────────────────────────────────────────────

const statusView = (): GuestStatusView => {
	const now = new Date();
	const s = getState(now);
	const rows: GuestStatusRow[] = [
		{
			kind: 'line',
			id: 'state',
			label: 'DeepShift',
			dot: s.isOffPeak ? 'success' : 'error',
			value: pillLabel(s),
			valueTone: s.isOffPeak ? 'success' : 'error',
			tooltip: 'DeepSeek peak/off-peak pricing',
		},
	];

	const next = s.nextTransitions[0];
	if (next) {
		const inMin = Math.max(0, Math.ceil((next.at - now.getTime()) / 60000));
		const tag = dayTag(next.at, now);
		rows.push({
			kind: 'line',
			id: 'next',
			label: 'Next',
			value: `${next.to === 'peak' ? 'Peak' : 'Off-peak'} · ${fmtTime(next.at)}${
				tag === 'today' ? '' : ` ${tag}`
			} · in ${formatCountdown(inMin)}`,
		});
	}

	rows.push({
		kind: 'note',
		id: 'advice',
		text: adviceText(s, false),
		tone: s.isOffPeak ? 'muted' : 'error',
	});

	const years = holidayCoverageYears();
	if (!years.includes(now.getFullYear())) {
		rows.push({
			kind: 'note',
			id: 'stale-calendar',
			text: `Holiday calendar covers ${years[0]}–${years[years.length - 1]} — Chinese holidays are NOT applied for ${now.getFullYear()}.`,
			tone: 'warning',
		});
	}

	return { rows };
};

// ── Sidebar mark ─────────────────────────────────────────────────────────────

const host = createServiceHost({ env: process.env });

type Mark = { icon: string; tone: GuestTone; text: string };

const markFor = (s: TimeState, free: boolean): Mark => {
	const cd = formatCountdown(s.minutesRemaining);
	const soon = s.minutesRemaining <= ALERT_BEFORE_MINUTES;
	if (free) {
		// Nothing is charged either way, so no pricing language and no amber
		// alert — just the clock, in a neutral tone.
		const next = s.isOffPeak ? `peak in ${cd}` : `off-peak in ${cd}`;
		return { icon: 'timer', tone: 'info', text: `Free DeepSeek model — no price change · ${next}` };
	}
	if (!s.isOffPeak) {
		return soon
			? { icon: 'timer', tone: 'warning', text: `Peak ends in ${cd} — off-peak resuming soon` }
			: { icon: 'timer', tone: 'error', text: `Peak pricing · 2x rates · off-peak in ${cd}` };
	}
	return soon
		? { icon: 'timer', tone: 'warning', text: `Peak starts in ${cd} — finish large runs` }
		: { icon: 'timer', tone: 'success', text: `Off-peak · 50% off · peak in ${cd}` };
};

let markedSession: string | null = null;
let markedJson = '';
let hostWarned = false;

const clearMark = async () => {
	const sessionId = markedSession;
	if (!sessionId) return;
	markedSession = null;
	markedJson = '';
	await host.setMark({ sessionId }, null);
};

/** Puts the mark on the session in front, or takes it off. Never throws. */
const reconcileMark = async () => {
	try {
		const current = readCurrentSession();
		if (!current || !isDeepSeek(current.model)) {
			await clearMark();
			return;
		}
		const mark = markFor(getState(), isFreeDeepSeek(current.model));
		const json = JSON.stringify(mark);
		if (current.sessionId === markedSession && json === markedJson) return;
		if (markedSession && markedSession !== current.sessionId) await clearMark();
		await host.setMark({ sessionId: current.sessionId }, mark);
		markedSession = current.sessionId;
		markedJson = json;
	} catch (error) {
		// Not approved yet, a refused call, or an unreadable database: the
		// status section must keep working without a mark.
		if (!hostWarned) {
			hostWarned = true;
			console.warn(
				'DeepShift: sidebar mark unavailable —',
				error instanceof Error ? error.message : String(error)
			);
		}
	}
};

/** Re-derives the mark every 10 s, and right after the next transition. */
const scheduleMark = () => {
	const wait = Math.min(Math.max(getState().transitionAt - Date.now() + 500, 1000), MARK_REFRESH_MS);
	setTimeout(() => {
		void reconcileMark().finally(scheduleMark);
	}, wait);
};

// ── HTTP ─────────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
	// Every request carries the bearer, /health too.
	if (req.headers.authorization !== `Bearer ${token}`) {
		res.writeHead(401).end();
		return;
	}
	const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
	if (req.method === 'GET' && path === '/health') {
		res.writeHead(200).end('{}');
		return;
	}
	if (req.method === 'GET' && path === '/status') {
		res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(statusView()));
		return;
	}
	// No actions are declared, so nothing else should arrive.
	res.writeHead(404).end('{}');
});

server.listen(Number(process.env.OPENCHAMBER_SERVICE_PORT), '127.0.0.1');
void reconcileMark();
scheduleMark();
