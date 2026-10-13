/**
 * shell-detect.ts — Windows shell availability detection.
 *
 * On Windows, pi's bash tool falls back to `C:\Windows\System32\bash.exe`
 * when Git Bash is missing. That file is the WSL launcher stub, which usually
 * targets a distro without a real bash (e.g. the docker-desktop distro) and
 * fails every command with WSL relay errors. The subagent shell tool choice
 * uses this detector to avoid registering a tool that cannot work.
 */

import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";

/** True when the path points at the WSL launcher stub (System32/Sysnative bash.exe). */
export function isWslBashStub(path: string): boolean {
  const normalized = path.replace(/\//g, "\\").toLowerCase();
  return /^[a-z]:\\windows\\(?:system32|sysnative)\\bash\.exe$/.test(normalized);
}

/**
 * Find a usable bash.exe on Windows: Git Bash in known locations, then the
 * first PATH hit that is not the WSL launcher stub. Null when none qualifies.
 * Mirrors pi's own bash resolution (`utils/shell.ts`), minus the stub.
 */
export function findUsableBash(): string | null {
  if (process.platform !== "win32") return null;

  for (const envVar of ["ProgramFiles", "ProgramFiles(x86)"]) {
    const base = process.env[envVar];
    const candidate = base ? join(base, "Git", "bin", "bash.exe") : null;
    if (candidate && existsSync(candidate)) return candidate;
  }

  try {
    const result = spawnSync("where.exe", ["bash.exe"], {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    });
    if (result.status === 0 && result.stdout) {
      for (const line of result.stdout.trim().split(/\r?\n/)) {
        const candidate = line.trim();
        if (candidate && existsSync(candidate) && !isWslBashStub(candidate)) return candidate;
        // where.exe returns PATH order; a stub hit doesn't end the search —
        // later PATH entries can still hold a real bash (MSYS2, Cygwin, WSL
        // per-distro bash.exe like C:\...\Ubuntu\…).
        continue;
      }
    }
  } catch {
    // where.exe missing or timed out — fall through to null
  }
  return null;
}

/**
 * Resolve the shell tool set for an agent config.
 *
 * Returns "bash" when a usable bash exists (or on non-Windows platforms),
 * "powershell" when bash is unusable but PowerShell is present, and null when
 * neither can be resolved (caller keeps the config's literal tools).
 *
 * This is the one definition of "which shell tool a subagent should get when
 * its config asks for bash". Always picks exactly one of bash/powershell —
 * registering both would offer the model a guaranteed-broken tool.
 */
export function resolveShellTool(): "bash" | "powershell" | null {
  if (process.platform !== "win32") return "bash";
  if (findUsableBash()) return "bash";
  return findPowerShell() ? "powershell" : null;
}

/** True when pwsh.exe or powershell.exe is reachable via where.exe. */
export function findPowerShell(): boolean {
  try {
    for (const exe of ["pwsh.exe", "powershell.exe"]) {
      const result = spawnSync("where.exe", [exe], { encoding: "utf-8", timeout: 5000, windowsHide: true });
      if (result.status === 0 && result.stdout) {
        const first = result.stdout.trim().split(/\r?\n/)[0];
        if (first && existsSync(first)) return true;
      }
    }
  } catch {
    // where.exe missing or timed out
  }
  return false;
}

/** Shell tool label for prompts/UI; falls back to "bash" when nothing is available. */
export function shellToolLabel(): "bash" | "powershell" {
  return resolveShellTool() ?? "bash";
}

export const PATH_DELIMITER = delimiter;
