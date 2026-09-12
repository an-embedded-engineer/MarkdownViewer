export type SettingsContext =
  | { kind: "default"; rootGeneration: string }
  | { kind: "project"; projectId: string; rootGeneration: string };
export type LogicalSize = { width: number; height: number };
export type Presentation = { actualLogicalSize: LogicalSize | null; sizeApplied: boolean; specialState: boolean };
export type Preferences = { theme: "light" | "dark"; plantUmlJarPath: string | null };
export type SettingsPatch = {
  theme?: { kind: "set"; value: Preferences["theme"] };
  plantUmlJarPath?: { kind: "set"; value: string | null };
  windowSize?: { kind: "set"; value: LogicalSize };
};

export function preferencesPatch(before: Preferences, after: Preferences): SettingsPatch {
  const patch: SettingsPatch = {};
  if (before.theme !== after.theme) patch.theme = { kind: "set", value: after.theme };
  if (before.plantUmlJarPath !== after.plantUmlJarPath) {
    patch.plantUmlJarPath = { kind: "set", value: after.plantUmlJarPath };
  }
  return patch;
}

/** Root contextと保存queueをApp instanceごとに所有する。 */
export class SettingsQueue {
  context: SettingsContext = { kind: "default", rootGeneration: "0" };
  busy = true;
  private baseline: LogicalSize | null = null;
  private wasSpecial = false;
  private tail: Promise<void> = Promise.resolve();
  private pending: (() => Promise<unknown>) | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async changeRoot<T extends { context: SettingsContext; presentation: Presentation }>(
    operation: (context: SettingsContext) => Promise<T>,
    onFlushError: (error: unknown) => void,
  ): Promise<T> {
    if (this.busy) throw new Error("The selected folder is already changing.");
    this.busy = true;
    try {
      try { await this.flush(); } catch (error) { onFlushError(error); }
      const result = await operation(this.context);
      this.apply(result.context, result.presentation);
      return result;
    } finally { this.busy = false; }
  }

  observe(size: LogicalSize, special: boolean): boolean {
    if (this.busy) return false;
    if (special) { this.wasSpecial = true; return false; }
    if (this.wasSpecial || this.baseline === null) {
      this.wasSpecial = false;
      this.baseline = size;
      return false;
    }
    if (size.width === this.baseline.width && size.height === this.baseline.height) return false;
    this.baseline = size;
    return true;
  }

  schedule(operation: () => Promise<unknown>, onError: (error: unknown) => void): void {
    this.pending = operation;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush().catch(onError); }, 500);
  }

  async flush(): Promise<void> {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const pending = this.pending;
    this.pending = null;
    if (pending) await this.enqueue(pending);
    await this.tail;
  }

  apply(context: SettingsContext, presentation: Presentation): void {
    this.cancelPending();
    this.context = context;
    this.baseline = presentation.actualLogicalSize;
    this.wasSpecial = presentation.specialState;
  }

  cancelPending(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = null;
  }
}
