// Shared helpers for the manager scripts. Runs on Bun, including the runtime built into omp; no dependencies.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const LOOPS = ["triage", "daily", "weekly", "monthly"] as const;
export type Loop = (typeof LOOPS)[number];

export interface Policy {
	mode: "shadow" | "dispatch" | "propose";
	main_branch: string;
	/** Where the manager commits. Falls back to fallback_branch when a push here is refused. */
	state_branch: string;
	fallback_branch: string;
	loops: Record<Loop, { max_time: string; model?: string | null }>;
	budgets: { daily_dispatch_minutes: number; approval_threshold_minutes: number };
	limits: { max_concurrent_work: number; stale_work_days: number; backlog_aging_weeks: number; max_open_goals: number };
	review: { model: string | null };
	worker: { model: string | null };
}

export interface Goal {
	id: string;
	title: string;
	metric: string;
	target: { op: string; value: number };
	deadline: string;
	owner: string;
	status: string;
	evidence: string;
	cost_minutes?: number | null;
	displaces?: string | null;
}

export interface BacklogItem {
	id: string;
	title: string;
	source: string;
	evidence: string;
	goal: string | null;
	size_minutes: number;
	score?: Record<string, number>;
	status: string;
	approval: string;
	created: string;
	reason?: string | null;
}

export interface WorkItem {
	id: string;
	backlog: string;
	title: string;
	status: string;
	contract: string;
	branch: string;
	max_time_minutes: number;
	created: string;
	started?: string | null;
	finished?: string | null;
	/** Commit the worker started from, and its branch head as last seen on origin. */
	base?: string | null;
	head?: string | null;
	cost_usd?: number | null;
	attempts?: number;
	notes?: string | null;
	mismatches?: Record<string, number>;
}

export const DEFAULT_POLICY: Policy = {
	mode: "shadow",
	main_branch: "main",
	state_branch: "main",
	fallback_branch: "manager/state",
	loops: {
		triage: { max_time: "10m" },
		daily: { max_time: "20m" },
		weekly: { max_time: "30m" },
		monthly: { max_time: "45m" },
	},
	budgets: { daily_dispatch_minutes: 240, approval_threshold_minutes: 120 },
	limits: { max_concurrent_work: 5, stale_work_days: 2, backlog_aging_weeks: 4, max_open_goals: 5 },
	review: { model: null },
	worker: { model: null },
};

export const PATHS = {
	charter: "ops/charter.md",
	policy: "ops/policy.yaml",
	goals: "ops/goals.yaml",
	backlog: "ops/backlog.yaml",
	register: "ops/register.yaml",
	progress: "ops/progress.md",
	incidents: "ops/incidents",
	contracts: "ops/contracts",
	reports: "ops/reports",
	procedures: "ops/procedures",
	metrics: "scoreboard/metrics.yaml",
};

/** Paths only the human changes. A session that touches one is rejected. */
export const PROTECTED = [/^ops\/charter\.md$/, /^ops\/policy\.yaml$/, /^scoreboard\//, /^\.github\//];
/** Paths the manager may change only through a proposal branch the human merges. */
export const NEEDS_APPROVAL = [/^ops\/goals\.yaml$/, /^ops\/procedures\//];
/** Paths the manager may change at all. Anything else is work, which belongs to workers. */
export const MANAGER_WRITABLE = [/^ops\//, /^docs\/adr\//];

export const matches = (path: string, patterns: RegExp[]) => patterns.some(p => p.test(path));

export interface Run {
	code: number;
	stdout: string;
	stderr: string;
}

export function run(cmd: string[], cwd: string, input?: string): Run {
	const p = Bun.spawnSync(cmd, { cwd, stdin: input === undefined ? "ignore" : Buffer.from(input), stdout: "pipe", stderr: "pipe" });
	return { code: p.exitCode ?? 1, stdout: p.stdout.toString(), stderr: p.stderr.toString() };
}

/** Run a command and throw on failure. */
export function must(cmd: string[], cwd: string): string {
	const r = run(cmd, cwd);
	if (r.code !== 0) throw new Error(`${cmd.join(" ")} failed (${r.code}): ${r.stderr.trim() || r.stdout.trim()}`);
	return r.stdout.trim();
}

export function git(org: string, ...args: string[]): string {
	return must(["git", ...args], org);
}

export function orgRoot(dir: string): string {
	return git(resolve(dir), "rev-parse", "--show-toplevel");
}

/** Runtime directory outside the working tree: locks, worker sessions, logs. Never committed. */
export function runtimeDir(org: string, ...parts: string[]): string {
	const common = resolve(org, git(org, "rev-parse", "--git-common-dir"));
	const dir = join(common, "manager", ...parts);
	mkdirSync(dir, { recursive: true });
	return dir;
}

export function hasRemote(org: string): boolean {
	return run(["git", "remote", "get-url", "origin"], org).code === 0;
}

export function readText(org: string, path: string): string | null {
	const full = join(org, path);
	return existsSync(full) ? readFileSync(full, "utf8") : null;
}

export function readYaml<T>(org: string, path: string): T | null {
	const text = readText(org, path);
	if (text === null) return null;
	return (Bun.YAML.parse(text) ?? {}) as T;
}

export function writeYaml(org: string, path: string, value: unknown): void {
	const full = join(org, path);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, Bun.YAML.stringify(value, null, 2) + "\n");
}

function merge<T>(base: T, over: unknown): T {
	if (!over || typeof over !== "object" || Array.isArray(over)) return (over ?? base) as T;
	const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
	for (const [k, v] of Object.entries(over)) out[k] = k in out && v && typeof v === "object" && !Array.isArray(v) ? merge(out[k], v) : v;
	return out as T;
}

export function loadPolicy(org: string): Policy {
	return merge(DEFAULT_POLICY, readYaml(org, PATHS.policy));
}

/** The policy as committed at a ref, so a loop never runs on uncommitted or unmerged policy. */
export function loadPolicyAt(org: string, ref: string): Policy {
	const r = run(["git", "show", `${ref}:${PATHS.policy}`], org);
	return merge(DEFAULT_POLICY, r.code === 0 ? Bun.YAML.parse(r.stdout) : null);
}

export function loadGoals(org: string): Goal[] {
	return readYaml<{ goals?: Goal[] }>(org, PATHS.goals)?.goals ?? [];
}

export function loadBacklog(org: string): BacklogItem[] {
	return readYaml<{ items?: BacklogItem[] }>(org, PATHS.backlog)?.items ?? [];
}

export function loadRegister(org: string): WorkItem[] {
	return readYaml<{ items?: WorkItem[] }>(org, PATHS.register)?.items ?? [];
}

export function saveRegister(org: string, items: WorkItem[]): void {
	writeYaml(org, PATHS.register, { items });
}

export function saveBacklog(org: string, items: BacklogItem[]): void {
	writeYaml(org, PATHS.backlog, { items });
}

export function appendProgress(org: string, heading: string, bullets: string[]): void {
	const full = join(org, PATHS.progress);
	mkdirSync(dirname(full), { recursive: true });
	const prev = existsSync(full) ? readFileSync(full, "utf8") : "# Progress\n";
	const sep = prev.endsWith("\n\n") ? "" : prev.endsWith("\n") ? "\n" : "\n\n";
	appendFileSync(full, `${sep}## ${heading}\n\n${bullets.map(b => `- ${b}`).join("\n")}\n`);
}

export function writeIncident(org: string, slug: string, title: string, sections: Record<string, string>): string {
	let path = `${PATHS.incidents}/${today()}-${slug}.md`;
	for (let n = 2; existsSync(join(org, path)); n++) path = `${PATHS.incidents}/${today()}-${slug}-${n}.md`;
	const full = join(org, path);
	mkdirSync(dirname(full), { recursive: true });
	const body = Object.entries(sections).map(([h, t]) => `## ${h}\n\n${t}\n`).join("\n");
	writeFileSync(full, `# ${title}\n\nStatus: open\nOpened: ${today()}\nResolved:\n\n${body}`);
	return path;
}

export const today = () => new Date().toISOString().slice(0, 10);
export const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export function pidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (e) {
		return (e as NodeJS.ErrnoException).code === "EPERM";
	}
}

export function nextId(prefix: string, ids: string[]): string {
	const width = prefix === "G" ? 3 : 4;
	const max = ids.reduce((m, id) => Math.max(m, Number(id.slice(prefix.length + 1)) || 0), 0);
	return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

export function args(argv: string[]): { positional: string[]; flags: Record<string, string | true> } {
	const positional: string[] = [];
	const flags: Record<string, string | true> = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith("--")) positional.push(a);
		else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[a.slice(2)] = argv[++i];
		else flags[a.slice(2)] = true;
	}
	return { positional, flags };
}

/** The omp binary; MANAGER_OMP overrides it, for tests or a pinned install. */
export const ompBin = () => process.env.MANAGER_OMP || "omp";
