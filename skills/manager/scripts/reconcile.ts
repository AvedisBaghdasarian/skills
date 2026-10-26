#!/usr/bin/env bun
// Compares the register with ground truth: pull requests, CI and worker sessions.
// Usage: bun reconcile.ts [--org <dir>] [--fix]
// Without --fix, prints the mismatches. With --fix, corrects the register, logs to
// the progress file, and turns a mismatch that repeats into a backlog item.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	appendProgress,
	args,
	ghJson,
	loadBacklog,
	loadPolicy,
	loadRegister,
	nextId,
	now,
	orgRoot,
	pidAlive,
	runtimeDir,
	saveBacklog,
	saveRegister,
	today,
	type Policy,
	type WorkItem,
} from "./lib";

interface Pr {
	number: number;
	state: "OPEN" | "CLOSED" | "MERGED";
	mergedAt: string | null;
}

type Checks = "pass" | "fail" | "pending" | "none";

/** Whether a worker session is still running, or null when that cannot be determined. */
export function sessionAlive(org: string, policy: Policy, item: WorkItem): boolean | null {
	if (policy.worker.backend === "local") {
		const file = join(runtimeDir(org, "sessions"), `${item.id}.json`);
		if (!existsSync(file)) return false;
		const { pid } = JSON.parse(readFileSync(file, "utf8")) as { pid: number };
		return pidAlive(pid);
	}
	const runs = ghJson<{ displayTitle: string; status: string }[]>(
		org, "run", "list", "--workflow", policy.worker.workflow, "--json", "displayTitle,status", "--limit", "100",
	);
	if (!runs) return null;
	return runs.some(r => r.displayTitle.includes(item.id) && ["queued", "in_progress", "waiting", "pending", "requested"].includes(r.status));
}

function findPr(org: string, branch: string): Pr | null | undefined {
	const prs = ghJson<Pr[]>(org, "pr", "list", "--head", branch, "--state", "all", "--json", "number,state,mergedAt", "--limit", "1");
	return prs === null ? undefined : (prs[0] ?? null);
}

function prChecks(org: string, pr: number): Checks {
	const checks = ghJson<{ bucket: string }[]>(org, "pr", "checks", String(pr), "--json", "bucket");
	if (!checks || checks.length === 0) return "none";
	if (checks.some(c => c.bucket === "fail" || c.bucket === "cancel")) return "fail";
	if (checks.some(c => c.bucket === "pending")) return "pending";
	return "pass";
}

export interface Reconciliation {
	notes: string[];
	changed: boolean;
}

export function reconcile(org: string, fix: boolean): Reconciliation {
	const policy = loadPolicy(org);
	const register = loadRegister(org);
	const backlog = loadBacklog(org);
	const notes: string[] = [];
	let changed = false;
	let backlogChanged = false;
	const staleMs = policy.limits.stale_work_days * 86_400_000;
	const recentMs = 7 * 86_400_000;

	const set = (w: WorkItem, status: string, why: string) => {
		notes.push(`${w.id}: ${w.status} -> ${status} (${why})`);
		w.status = status;
		changed = true;
	};
	const mismatch = (w: WorkItem, kind: string, status: string, why: string) => {
		set(w, status, `mismatch: ${why}`);
		w.mismatches = { ...w.mismatches, [kind]: (w.mismatches?.[kind] ?? 0) + 1 };
		if (w.mismatches[kind] === 2) {
			const id = nextId("B", backlog.map(b => b.id));
			backlog.push({
				id,
				title: `Repeated mismatch on ${w.id}: ${kind}`,
				source: "manager",
				evidence: `Reconciliation found "${why}" twice for ${w.id} (${w.title}); the procedure that produced it is likely broken.`,
				goal: null,
				size_minutes: 30,
				status: "candidate",
				approval: "pending",
				created: today(),
				reason: null,
			});
			backlogChanged = true;
			notes.push(`${w.id}: ${kind} repeated; added ${id} to the backlog`);
		}
	};

	for (const w of register) {
		if (["ready", "cancelled", "failed"].includes(w.status)) continue;
		if (w.status === "merged" && w.finished && Date.now() - Date.parse(w.finished) > recentMs) continue;

		const pr = findPr(org, w.branch);
		if (pr === undefined) {
			notes.push(`${w.id}: could not reach GitHub; not reconciled`);
			continue;
		}
		if (pr) {
			if (w.pr !== pr.number) {
				w.pr = pr.number;
				changed = true;
			}
			if (pr.state === "MERGED") {
				const checks = prChecks(org, pr.number);
				if (checks === "fail") mismatch(w, "merged_failing_ci", "failed", `pull request #${pr.number} merged with failing checks`);
				else if (w.status !== "merged") {
					set(w, "merged", `pull request #${pr.number} merged`);
					w.finished = pr.mergedAt ?? now();
				}
			} else if (pr.state === "CLOSED") {
				set(w, "failed", `pull request #${pr.number} closed without merging`);
				w.finished = now();
			} else if (w.status !== "review") {
				set(w, "review", `pull request #${pr.number} open`);
			}
			continue;
		}

		// No pull request.
		if (w.status === "merged" || w.status === "review") {
			mismatch(w, `${w.status}_without_pr`, "stalled", `marked ${w.status} but branch ${w.branch} has no pull request`);
			continue;
		}
		const alive = sessionAlive(org, policy, w);
		if (alive === null) notes.push(`${w.id}: could not check the worker session`);
		else if (w.status === "running" && !alive) mismatch(w, "no_session", "stalled", "marked running with no live session and no pull request");
		else if (w.status === "running" && w.started && Date.now() - Date.parse(w.started) > staleMs) notes.push(`${w.id}: running for more than stale_work_days`);
		else if (w.status === "stalled" && alive) set(w, "running", "session is live");
	}

	if (fix && changed) {
		saveRegister(org, register);
		if (backlogChanged) saveBacklog(org, backlog);
		appendProgress(org, `${today()} reconcile`, notes);
	}
	return { notes, changed };
}

if (import.meta.main) {
	const { flags } = args(Bun.argv.slice(2));
	const org = orgRoot(typeof flags.org === "string" ? flags.org : process.cwd());
	const r = reconcile(org, flags.fix === true);
	console.log(r.notes.length ? r.notes.join("\n") : "register matches ground truth");
}
