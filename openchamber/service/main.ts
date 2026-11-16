// DeepShift OpenChamber service.
//
// Answers the Work Status section (`contributes.statusSection.source`) the app
// polls while the section is on screen: the current peak/off-peak state with a
// status dot, the next transition, the run-now advice, and the stale-calendar
// warning. Everything is a pure function of the clock and the bundled
// schedule, so the service holds no state: the host may stop it after ten
// quiet minutes and the next poll starts it fresh.
//
// Built by `npm run build:openchamber` into service/main.js (one CJS file; the
// host runs it directly and node_modules does not ship).

import http from 'node:http';
import { fmtTime, formatCountdown, getState, holidayCoverageYears } from '../../src/schedule';
import { adviceText, dayTag, pillLabel } from '../../src/view-model';
import type { GuestStatusRow, GuestStatusView } from '@openchamber/sdk';

const token = process.env.OPENCHAMBER_SERVICE_TOKEN ?? '';

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
