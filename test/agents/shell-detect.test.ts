/**
 * shell-detect.test.ts — Windows shell availability detection.
 *
 * Pure logic is tested directly (isWslBashStub); the filesystem/PATH probes
 * (findUsableBash, findPowerShell, resolveShellTool) are tested against the
 * real machine on win32 and via the platform branch elsewhere.
 */

import { describe, it, expect } from "vite-plus/test";
import { isWslBashStub, resolveShellTool, shellToolLabel } from "../../src/agents/shell-detect.js";

describe("isWslBashStub", () => {
  it("matches System32 and Sysnative bash.exe in any casing", () => {
    expect(isWslBashStub("C:\\Windows\\System32\\bash.exe")).toBe(true);
    expect(isWslBashStub("c:\\windows\\system32\\bash.exe")).toBe(true);
    expect(isWslBashStub("C:\\Windows\\Sysnative\\bash.exe")).toBe(true);
  });

  it("matches forward-slash variants", () => {
    expect(isWslBashStub("C:/Windows/System32/bash.exe")).toBe(true);
  });

  it("rejects real bash locations", () => {
    expect(isWslBashStub("C:\\Program Files\\Git\\bin\\bash.exe")).toBe(false);
    expect(isWslBashStub("C:\\msys64\\usr\\bin\\bash.exe")).toBe(false);
    expect(isWslBashStub("C:\\Program Files\\WSL\\Ubuntu\\bash.exe")).toBe(false);
    expect(isWslBashStub("/bin/bash")).toBe(false);
  });

  it("rejects non-bash System32 files", () => {
    expect(isWslBashStub("C:\\Windows\\System32\\wsl.exe")).toBe(false);
    expect(isWslBashStub("C:\\Windows\\System32\\bash.txt")).toBe(false);
  });
});

describe("resolveShellTool", () => {
  it("returns bash on non-Windows platforms", () => {
    if (process.platform !== "win32") {
      expect(resolveShellTool()).toBe("bash");
      expect(shellToolLabel()).toBe("bash");
    } else {
      // On Windows the result depends on the machine; only shape is asserted.
      expect(["bash", "powershell", null]).toContain(resolveShellTool());
    }
  });

  it("shellToolLabel never returns null", () => {
    expect(["bash", "powershell"]).toContain(shellToolLabel());
  });
});
