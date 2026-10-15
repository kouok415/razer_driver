// Shared pieces of the read-only USB/HID diagnostic page (probe.html).

// Bump when the report layout changes, so pasted reports can be told apart.
export const PROBE_VERSION = 1

// Upper bound for any single device operation (open, claim, transfer,
// close, forget). A probe that never finishes produces no report at all.
export const DEFAULT_TIMEOUT_MS = 5000

export interface ErrorInfo {
  name: string
  message: string
}

export interface StepRecord {
  step: string
  request?: Record<string, unknown>
  ok?: boolean
  result?: unknown
  error?: ErrorInfo
  skipped?: string
}

export interface ProbeSection {
  steps: StepRecord[]
}

export interface ProbeReport {
  probeVersion: number
  generatedAt: string
  userAgent: string
  webusb: ProbeSection | null
  webhid: ProbeSection | null
}

export function buildReport(
  sections: { webusb: ProbeSection | null; webhid: ProbeSection | null },
  now: Date,
  userAgent: string,
): ProbeReport {
  return {
    probeVersion: PROBE_VERSION,
    generatedAt: now.toISOString(),
    userAgent,
    webusb: sections.webusb,
    webhid: sections.webhid,
  }
}

export function errorInfo(e: unknown): ErrorInfo {
  if (e instanceof Error || e instanceof DOMException) return { name: e.name, message: e.message }
  return { name: typeof e, message: String(e) }
}

/** `hex(0x1532)` → `'0x1532'` */
export function hex(n: number, digits = 4): string {
  return `0x${n.toString(16).padStart(digits, '0')}`
}

/** Bytes [start, end) of `view` as space-separated hex; out-of-range bytes are omitted. */
export function hexBytes(view: DataView | undefined, start = 0, end = view?.byteLength ?? 0): string {
  if (!view) return ''
  const out: string[] = []
  for (let i = start; i < Math.min(end, view.byteLength); i++) {
    out.push(view.getUint8(i).toString(16).padStart(2, '0'))
  }
  return out.join(' ')
}

export function countNonZero(view: DataView | undefined, start: number, end: number): number {
  if (!view) return 0
  let n = 0
  for (let i = start; i < Math.min(end, view.byteLength); i++) {
    if (view.getUint8(i) !== 0) n++
  }
  return n
}

export class ProbeTimeoutError extends Error {
  constructor(ms: number) {
    super(`no answer within ${ms} ms`)
    this.name = 'ProbeTimeout'
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProbeTimeoutError(ms)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Ordered step log. `attempt` runs one device operation, records its result
 * (or error name + message) and never throws, so the probe can continue.
 */
export class StepLog {
  readonly section: ProbeSection = { steps: [] }
  private readonly onChange?: (section: ProbeSection) => void
  private readonly timeoutMs: number

  constructor(onChange?: (section: ProbeSection) => void, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.onChange = onChange
    this.timeoutMs = timeoutMs
  }

  record(rec: StepRecord): void {
    this.section.steps.push(rec)
    this.onChange?.(this.section)
  }

  skip(step: string, reason: string): void {
    this.record({ step, skipped: reason })
  }

  fail(step: string, e: unknown): void {
    this.record({ step, ok: false, error: errorInfo(e) })
  }

  async attempt<T>(
    step: string,
    run: () => Promise<T>,
    summarize?: (value: T) => unknown,
    request?: Record<string, unknown>,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    const base: StepRecord = request ? { step, request } : { step }
    try {
      const value = await withTimeout(run(), this.timeoutMs)
      this.record(summarize ? { ...base, ok: true, result: summarize(value) } : { ...base, ok: true })
      return { ok: true, value }
    } catch (e) {
      this.record({ ...base, ok: false, error: errorInfo(e) })
      return { ok: false }
    }
  }
}
