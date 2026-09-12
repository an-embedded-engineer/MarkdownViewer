import { describe, expect, it, vi } from "vitest";
import { SettingsQueue, preferencesPatch } from "./projectSettings";

describe("project settings boundaries", () => {
  it("patches only fields changed by the user and preserves explicit jar clear", () => {
    expect(preferencesPatch({ theme: "light", plantUmlJarPath: "/a.jar" }, { theme: "dark", plantUmlJarPath: "/a.jar" }))
      .toEqual({ theme: { kind: "set", value: "dark" } });
    expect(preferencesPatch({ theme: "light", plantUmlJarPath: "/a.jar" }, { theme: "light", plantUmlJarPath: null }))
      .toEqual({ plantUmlJarPath: { kind: "set", value: null } });
  });
  it("does not persist startup, programmatic resize, or leaving a special window state", () => {
    const q = new SettingsQueue();
    expect(q.observe({ width: 800, height: 600 }, false)).toBe(false);
    q.apply(q.context, { actualLogicalSize: { width: 1000, height: 700 }, sizeApplied: true, specialState: false });
    q.busy = false;
    expect(q.observe({ width: 1000, height: 700 }, false)).toBe(false);
    expect(q.observe({ width: 2000, height: 1400 }, true)).toBe(false);
    expect(q.observe({ width: 1100, height: 700 }, false)).toBe(false);
    expect(q.observe({ width: 1150, height: 700 }, false)).toBe(true);
  });
  it("flushes old-context resize before a context switch and discards debounce", async () => {
    vi.useFakeTimers();
    try {
      const q = new SettingsQueue();
      const saved: string[] = [];
      const old = q.context;
      q.schedule(async () => { saved.push(old.rootGeneration); }, () => {});
      await q.flush();
      q.apply({ kind: "project", projectId: "b", rootGeneration: "1" }, { actualLogicalSize: null, sizeApplied: false, specialState: false });
      await vi.runAllTimersAsync();
      expect(saved).toEqual(["0"]);
    } finally { vi.useRealTimers(); }
  });
  it("serializes writes and allows later operations after a failed flush", async () => {
    const q = new SettingsQueue();
    const order: string[] = [];
    let release!: () => void;
    const first = q.enqueue(() => new Promise<void>((resolve) => { release = () => { order.push("first"); resolve(); }; }));
    const second = q.enqueue(async () => { order.push("second"); });
    await Promise.resolve(); release(); await first; await second;
    expect(order).toEqual(["first", "second"]);
    q.schedule(async () => { throw new Error("read-only"); }, () => {});
    await expect(q.flush()).rejects.toThrow("read-only");
    await expect(q.enqueue(async () => "new project")).resolves.toBe("new project");
  });
});
