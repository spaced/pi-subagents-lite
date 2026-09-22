/**
 * project-trust.ts — Resolve the trust state for a cross-repo worktree target.
 *
 * Targets are gated by pi's existing trust framework, using pi's exported
 * building blocks only (never reimplemented, never reading trust.json
 * directly). Same-repo targets follow the saved decision when one exists and
 * otherwise inherit the parent session's own trust state; cross-repo targets
 * without trust-requiring project resources are never gated, and an
 * undecided trust-requiring target falls back to the global
 * `defaultProjectTrust` setting; anything other than "always" means untrusted.
 *
 * The SDK building blocks are injected as deps so the branching logic stays
 * unit-testable; createSubagentTrustDeps wires the real functions at the
 * call site.
 */

import {
  hasTrustRequiringProjectResources,
  ProjectTrustStore,
  SettingsManager,
  type DefaultProjectTrust,
  type ProjectTrustDecision,
} from "@earendil-works/pi-coding-agent";

/** The trust primitives the gate is built from. Injected for testability. */
export interface SubagentTrustDeps {
  /** pi's hasTrustRequiringProjectResources: `.pi` entries or `.agents/skills`. */
  hasTrustRequiringProjectResources: (cwd: string) => boolean;
  /** pi's ProjectTrustStore.get: nearest-ancestor decision, null when undecided. */
  getTrustDecision: (cwd: string) => ProjectTrustDecision;
  /** pi's SettingsManager.getDefaultProjectTrust: global default. */
  getDefaultProjectTrust: () => DefaultProjectTrust;
}

/**
 * Wire the real pi building blocks behind the trust gate. agentDir is where
 * trust decisions are stored; parentCwd is the parent session's working dir
 * (source of the global defaultProjectTrust setting).
 */
export function createSubagentTrustDeps(agentDir: string, parentCwd: string): SubagentTrustDeps {
  const trustStore = new ProjectTrustStore(agentDir);
  return {
    hasTrustRequiringProjectResources,
    getTrustDecision: (cwd) => trustStore.get(cwd),
    getDefaultProjectTrust: () => SettingsManager.create(parentCwd, agentDir).getDefaultProjectTrust(),
  };
}

/**
 * Resolve whether a spawn into `targetPath` loads the target's project
 * resources. Returns true = trusted (load resources), false = untrusted
 * target (the caller ignores its resources and surfaces a warning).
 *
 * Same-repo targets follow the saved decision for the target path when one
 * exists, otherwise the parent session's own trust state (parentTrusted): a
 * subagent must never load project resources the parent session itself is
 * running without. Cross-repo targets are gated only when they carry
 * trust-requiring resources, and an undecided one falls back to the global
 * defaultProjectTrust setting.
 */
export function resolveSubagentTrust(opts: {
  targetPath: string;
  /** False when the parent and target live in different git repos (or the parent is in none). */
  sameRepo: boolean;
  /** The parent session's trust state for its own cwd (ctx.isProjectTrusted()). */
  parentTrusted: boolean;
  deps: SubagentTrustDeps;
}): boolean {
  if (opts.sameRepo) {
    return opts.deps.getTrustDecision(opts.targetPath) ?? opts.parentTrusted;
  }
  if (!opts.deps.hasTrustRequiringProjectResources(opts.targetPath)) return true;
  const decision = opts.deps.getTrustDecision(opts.targetPath);
  if (decision !== null) return decision;
  return opts.deps.getDefaultProjectTrust() === "always";
}

/** Warning surfaced when a spawn proceeds into an untrusted cross-repo target. */
export function untrustedProjectWarning(targetPath: string): string {
  return `Target project at ${targetPath} is not trusted: its project resources (.pi/ settings, extensions, skills, prompts, themes, system prompt files, .agents/skills) will be ignored for this subagent`;
}
