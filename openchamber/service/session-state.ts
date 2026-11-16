// Who is open right now, and does DeepShift care about their model?
//
// OpenChamber hands a service a session's id at most (session events), never
// its model, so the one place the answer already exists is the database
// OpenCode itself writes: `session_v2` carries each session's `model` JSON and
// the timestamps of its last activity and last view. The read is read-only and
// every failure is silent — a missing file, an older schema or a host without
// `node:sqlite` only means "no sidebar mark", never a broken status section.

import { homedir } from 'node:os';
import { join } from 'node:path';

export type SessionModel = {
	/** `providerID` as stored, such as `deepseek` or `opencode`. */
	provider: string;
	/** Model id as stored, such as `deepseek-v4-pro` or `deepseek-v4.1-flash-free`. */
	id: string;
};

export type CurrentSession = {
	sessionId: string;
	directory: string | null;
	model: SessionModel | null;
};

type SqliteDatabase = {
	prepare(sql: string): { all(...params: unknown[]): Array<Record<string, unknown>> };
	close(): void;
};

type SqliteModule = { DatabaseSync: new (path: string, options?: { readOnly?: boolean }) => SqliteDatabase };

/** Where OpenCode keeps its database, following OpenCode's own data-dir rules. */
export const opencodeDatabasePath = (env: Record<string, string | undefined> = process.env): string => {
	const dataDir =
		env.OPENCODE_DATA_DIR ?? join(env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'opencode');
	return join(dataDir, 'opencode.db');
};

const loadSqlite = (): SqliteModule | null => {
	try {
		// Deliberately not a static import: a host whose Electron predates
		// `node:sqlite` must still answer `/status`.
		return require('node:sqlite') as SqliteModule;
	} catch {
		return null;
	}
};

/** `{"id":"…","providerID":"…","variant":"…"}` as stored, or null. */
export const parseSessionModel = (raw: unknown): SessionModel | null => {
	if (typeof raw !== 'string' || raw.length === 0) return null;
	try {
		const parsed = JSON.parse(raw) as { id?: unknown; providerID?: unknown };
		const id = typeof parsed.id === 'string' ? parsed.id : '';
		const provider = typeof parsed.providerID === 'string' ? parsed.providerID : '';
		return id ? { provider, id } : null;
	} catch {
		return null;
	}
};

/**
 * Any DeepSeek model, paid or free: the sidebar mark shows on both, so the
 * clock stays visible even when nothing is charged for the session.
 */
export const isDeepSeek = (model: SessionModel | null): boolean => {
	if (!model) return false;
	return /deepseek/i.test(model.id) || /deepseek/i.test(model.provider);
};

/** A `-free` DeepSeek offering costs nothing; it still gets the mark. */
export const isFreeDeepSeek = (model: SessionModel | null): boolean => {
	if (!model) return false;
	return /deepseek/i.test(model.id) && /-free$/i.test(model.id);
};

/**
 * The session in front: the newest of "last activity" and "last opened". A
 * quiet chat that was just opened has only `time_viewed` moving; the chat
 * being worked in has `time_updated` moving. Subagent sessions and archived
 * ones never count — they have no row in the sidebar.
 */
export const readCurrentSession = (dbPath: string = opencodeDatabasePath()): CurrentSession | null => {
	const sqlite = loadSqlite();
	if (!sqlite) return null;
	let db: SqliteDatabase | null = null;
	try {
		db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
		const row = db
			.prepare(
				`select id, directory, model
				 from session_v2
				 where parent_id is null and (time_archived is null or time_archived = 0)
				 order by max(coalesce(time_viewed, 0), time_updated) desc
				 limit 1`
			)
			.all()[0];
		if (!row || typeof row.id !== 'string') return null;
		return {
			sessionId: row.id,
			directory: typeof row.directory === 'string' ? row.directory : null,
			model: parseSessionModel(row.model),
		};
	} catch {
		return null;
	} finally {
		try {
			db?.close();
		} catch {
			// Already gone; nothing to release.
		}
	}
};
