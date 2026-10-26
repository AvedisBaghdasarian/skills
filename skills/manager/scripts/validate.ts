#!/usr/bin/env bun
// Checks the state files, and with --base what a session changed since that commit.
// Usage: bun validate.ts [--org <dir>] [--base <ref>] [--json]
import {
	args,
	git,
	loadBacklog,
	loadGoals,
	loadPolicy,
	loadRegister,
	matches,
	MANAGER_WRITABLE,
	NEEDS_APPROVAL,
	orgRoot,
	PATHS,
	PROTECTED,
	readText,
	readYaml,
	run,
	today,
	type Policy,
} from "./lib";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface Validation {
	ok: boolean;
	errors: string[];
	changed: string[];
	/** Changed paths that land through a pull request the human merges. */
	approvalPaths: string[];
	/** Changed paths the runner commits directly. */
	directPaths: string[];
}

const GOAL_STATUS = ["proposed", "active", "met", "missed", "closed"];
const BACKLOG_STATUS = ["candidate", "approved", "dispatched", "done", "dropped"];
const APPROVAL = ["pending", "goal", "human"];
const WORK_STATUS = ["ready", "running", "review", "merged", "failed", "stalled", "cancelled"];
const OPS = ["<", "<=", ">", ">=", "=="];

export function validate(org: string, base?: string): Validation {
	const errors: string[] = [];
	const err = (m: string) => errors.push(m);
	let policy: Policy;

	const parse = <T>(path: string, fn: () => T): T | null => {
		try {
			return fn();
		} catch (e) {
			err(`${path}: does not parse: ${(e as Error).message}`);
			return null;
		}
	};

	policy = parse(PATHS.policy, () => loadPolicy(org)) ?? loadPolicy("/nonexistent");
	if (!["shadow", "dispatch", "propose"].includes(policy.mode)) err(`${PATHS.policy}: mode must be shadow, dispatch or propose`);
	const goals = parse(PATHS.goals, () => loadGoals(org)) ?? [];
	const backlog = parse(PATHS.backlog, () => loadBacklog(org)) ?? [];
	const register = parse(PATHS.register, () => loadRegister(org)) ?? [];
	const metrics = parse(PATHS.metrics, () => readYaml<{ metrics?: { id: string }[] }>(org, PATHS.metrics));
	const metricIds = metrics ? new Set((metrics.metrics ?? []).map(m => m.id)) : null;

	const unique = (path: string, ids: string[], re: RegExp) => {
		const seen = new Set<string>();
		for (const id of ids) {
			if (!re.test(String(id))) err(`${path}: bad id ${id}`);
			if (seen.has(id)) err(`${path}: duplicate id ${id}`);
			seen.add(id);
		}
	};
	const isDate = (v: unknown) => typeof v === "string" ? /^\d{4}-\d{2}-\d{2}$/.test(v) : v instanceof Date;

	// Goals
	unique(PATHS.goals, goals.map(g => g.id), /^G-\d+$/);
	for (const g of goals) {
		const at = `${PATHS.goals} ${g.id}`;
		if (!GOAL_STATUS.includes(g.status)) err(`${at}: status must be one of ${GOAL_STATUS.join(", ")}`);
		if (!g.title) err(`${at}: missing title`);
		if (!g.metric) err(`${at}: missing metric`);
		else if (metricIds && !metricIds.has(g.metric)) err(`${at}: metric ${g.metric} is not in ${PATHS.metrics}`);
		if (!g.target || !OPS.includes(g.target.op) || typeof g.target.value !== "number") err(`${at}: target needs op (${OPS.join(" ")}) and a numeric value`);
		if (!isDate(g.deadline)) err(`${at}: deadline must be YYYY-MM-DD`);
		if (!g.evidence) err(`${at}: missing evidence`);
		if (g.status === "proposed" && (typeof g.cost_minutes !== "number" || !("displaces" in g))) err(`${at}: a proposal needs cost_minutes and displaces`);
	}
	const open = goals.filter(g => g.status === "active" || g.status === "proposed").length;
	if (open > policy.limits.max_open_goals) err(`${PATHS.goals}: ${open} open goals exceeds max_open_goals (${policy.limits.max_open_goals})`);
	const activeGoals = new Set(goals.filter(g => g.status === "active").map(g => g.id));

	// Backlog
	unique(PATHS.backlog, backlog.map(b => b.id), /^B-\d+$/);
	for (const b of backlog) {
		const at = `${PATHS.backlog} ${b.id}`;
		if (!BACKLOG_STATUS.includes(b.status)) err(`${at}: status must be one of ${BACKLOG_STATUS.join(", ")}`);
		if (!APPROVAL.includes(b.approval)) err(`${at}: approval must be one of ${APPROVAL.join(", ")}`);
		if (!b.title || !b.source || !b.evidence) err(`${at}: needs title, source and evidence`);
		if (typeof b.size_minutes !== "number") err(`${at}: size_minutes must be a number`);
		if ((b.status === "approved" || b.status === "dispatched") && b.approval === "pending") err(`${at}: ${b.status} without approval`);
		if (b.approval === "goal" && b.status !== "done" && b.status !== "dropped") {
			if (!b.goal || !activeGoals.has(b.goal)) err(`${at}: approval goal needs an active goal`);
			if (b.size_minutes > policy.budgets.approval_threshold_minutes) err(`${at}: ${b.size_minutes} minutes is over approval_threshold_minutes; needs approval human`);
		}
		if (b.status === "dropped" && !b.reason) err(`${at}: dropped without a reason`);
	}
	const backlogById = new Map(backlog.map(b => [b.id, b]));

	// Register
	unique(PATHS.register, register.map(w => w.id), /^W-\d+$/);
	let live = 0;
	let todayMinutes = 0;
	for (const w of register) {
		const at = `${PATHS.register} ${w.id}`;
		if (!WORK_STATUS.includes(w.status)) err(`${at}: status must be one of ${WORK_STATUS.join(", ")}`);
		const b = backlogById.get(w.backlog);
		if (!b) err(`${at}: backlog item ${w.backlog} does not exist`);
		else if (b.approval !== "goal" && b.approval !== "human") err(`${at}: backlog item ${w.backlog} is not approved`);
		if (!w.contract || !existsSync(join(org, w.contract))) err(`${at}: contract file ${w.contract} does not exist`);
		if (typeof w.max_time_minutes !== "number" || w.max_time_minutes <= 0) err(`${at}: max_time_minutes must be a positive number`);
		if (w.status === "running" && !w.started) err(`${at}: running without started`);
		if (w.status === "running" || w.status === "ready") live++;
		const startedToday = typeof w.started === "string" && w.started.startsWith(today());
		if (w.status === "ready" || startedToday) todayMinutes += w.max_time_minutes || 0;
	}
	if (live > policy.limits.max_concurrent_work) err(`${PATHS.register}: ${live} running or ready items exceeds max_concurrent_work (${policy.limits.max_concurrent_work})`);
	if (todayMinutes > policy.budgets.daily_dispatch_minutes) err(`${PATHS.register}: ${todayMinutes} minutes dispatched today exceeds daily_dispatch_minutes (${policy.budgets.daily_dispatch_minutes})`);

	// Incidents
	const incDir = join(org, PATHS.incidents);
	if (existsSync(incDir)) {
		for (const f of readdirSync(incDir).filter(f => f.endsWith(".md"))) {
			const text = readText(org, `${PATHS.incidents}/${f}`) ?? "";
			const status = /^Status:\s*(\w+)/m.exec(text)?.[1];
			if (status !== "open" && status !== "resolved") err(`${PATHS.incidents}/${f}: Status must be open or resolved`);
			if (status === "resolved" && !/^Resolved:\s*\d{4}-\d{2}-\d{2}/m.test(text)) err(`${PATHS.incidents}/${f}: resolved without a Resolved date`);
		}
	}

	// Changes since base
	const changed: string[] = [];
	if (base) {
		const diff = git(org, "diff", "--name-only", base).split("\n");
		const untracked = git(org, "ls-files", "--others", "--exclude-standard").split("\n");
		changed.push(...new Set([...diff, ...untracked].filter(Boolean)));

		for (const p of changed) {
			if (matches(p, PROTECTED)) err(`${p}: human-only path changed`);
			else if (!matches(p, MANAGER_WRITABLE)) err(`${p}: outside ops/ and docs/adr/; work belongs to workers`);
		}
		if (policy.mode === "shadow") {
			for (const p of changed) if (!p.startsWith(`${PATHS.reports}/`) && p !== PATHS.progress && !matches(p, PROTECTED)) err(`${p}: shadow mode allows only ${PATHS.reports}/ and ${PATHS.progress}`);
		}
		if (policy.mode === "dispatch" && changed.includes(PATHS.goals)) err(`${PATHS.goals}: goal proposals start in propose mode`);

		const deleted = git(org, "diff", "--name-only", "--diff-filter=D", base, "--", PATHS.incidents).split("\n").filter(Boolean);
		for (const p of deleted) err(`${p}: incidents are never deleted`);

		const before = run(["git", "show", `${base}:${PATHS.progress}`], org);
		if (before.code === 0) {
			const after = readText(org, PATHS.progress) ?? "";
			if (!after.startsWith(before.stdout)) err(`${PATHS.progress}: earlier entries changed; the log is append-only`);
		}
	}

	const approvalPaths = changed.filter(p => matches(p, NEEDS_APPROVAL));
	const directPaths = changed.filter(p => !matches(p, NEEDS_APPROVAL));
	return { ok: errors.length === 0, errors, changed, approvalPaths, directPaths };
}

if (import.meta.main) {
	const { flags } = args(Bun.argv.slice(2));
	const org = orgRoot(typeof flags.org === "string" ? flags.org : process.cwd());
	const v = validate(org, typeof flags.base === "string" ? flags.base : undefined);
	if (flags.json) console.log(JSON.stringify(v, null, 2));
	else if (v.ok) console.log(`valid${v.changed.length ? `: ${v.changed.length} changed (${v.approvalPaths.length} need approval)` : ""}`);
	else console.error(v.errors.map(e => `error: ${e}`).join("\n"));
	process.exit(v.ok ? 0 : 1);
}
