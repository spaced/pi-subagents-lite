/**
 * default-agents.test.ts — Embedded default agent configs.
 *
 * The Explore agent's shell tool resolves per machine (bash, or powershell on
 * Windows without usable bash). These tests pin the contract: exactly one
 * shell tool in the registered set, and the system prompt names that tool.
 */

import { describe, it, expect } from "vite-plus/test";
import { DEFAULT_AGENTS } from "../../src/agents/default-agents.js";
import { resolveShellTool } from "../../src/agents/shell-detect.js";

const SHELL_TOOLS = ["bash", "powershell"];

describe("DEFAULT_AGENTS — general-purpose", () => {
  it("registers no explicit tools (delegates to pi)", () => {
    const config = DEFAULT_AGENTS.get("general-purpose");
    expect(config).toBeDefined();
    expect(config!.registeredTools).toBeUndefined();
  });
});

describe("DEFAULT_AGENTS — Explore", () => {
  it("registers exactly one shell tool, matching the machine resolution", () => {
    const config = DEFAULT_AGENTS.get("Explore")!;
    expect(config).toBeDefined();

    const shellTools = config.registeredTools!.filter((t) => SHELL_TOOLS.includes(t));
    expect(shellTools).toHaveLength(1);

    const resolved = resolveShellTool();
    if (resolved !== null) {
      expect(shellTools[0]).toBe(resolved);
    }
  });

  it("keeps read-only companions alongside the shell tool", () => {
    const config = DEFAULT_AGENTS.get("Explore")!;
    expect(config.registeredTools).toContain("read");
    expect(config.registeredTools).toContain("grep");
    expect(config.registeredTools).toContain("find");
    expect(config.registeredTools).not.toContain("edit");
    expect(config.registeredTools).not.toContain("write");
  });

  it("system prompt references the registered shell tool only", () => {
    const config = DEFAULT_AGENTS.get("Explore")!;
    const shellTool = config.registeredTools!.find((t) => SHELL_TOOLS.includes(t))!;

    expect(config.systemPrompt).toContain(`Use the ${shellTool} tool ONLY for read-only operations`);

    // The other shell tool must not appear anywhere in the prompt.
    const other = shellTool === "bash" ? "powershell" : "bash";
    expect(config.systemPrompt).not.toContain(other);
  });

  it("prohibits file writes and redirects", () => {
    const config = DEFAULT_AGENTS.get("Explore")!;
    expect(config.systemPrompt).toContain("STRICTLY PROHIBITED");
    expect(config.systemPrompt).toContain("redirect operators");
  });
});
