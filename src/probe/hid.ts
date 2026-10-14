// WebHID half of the read-only diagnostic page: which HID interfaces of the
// keyboard Chrome exposes, and their report layouts. Nothing is opened, sent
// or received; the only device method called is forget().

import { DEVICE_FILTERS } from '../hid/device'
import { StepLog, hex, type ProbeSection } from './report'

export interface HidProbeEnv {
  hid: HID | undefined
  isSecureContext: boolean
  timeoutMs?: number
  onChange?: (section: ProbeSection) => void
}

export async function runWebHidProbe(env: HidProbeEnv): Promise<ProbeSection> {
  const log = new StepLog(env.onChange, env.timeoutMs)

  log.record({
    step: '1.environment',
    ok: true,
    result: { navigatorHid: Boolean(env.hid), isSecureContext: env.isSecureContext },
  })
  const hid = env.hid
  if (!hid) {
    log.skip('2.requestDevice', 'navigator.hid is not available in this browser')
    return log.section
  }

  // Device picker. Not time-limited: the person is choosing. Cancelling
  // resolves with an empty list.
  let devices: HIDDevice[]
  try {
    devices = await hid.requestDevice({ filters: DEVICE_FILTERS })
    log.record({
      step: '2.requestDevice',
      ok: true,
      result: {
        filters: DEVICE_FILTERS.map((f) => ({ vendorId: hex(f.vendorId ?? 0), productId: hex(f.productId ?? 0) })),
        deviceCount: devices.length,
      },
    })
  } catch (e) {
    log.fail('2.requestDevice', e)
    return log.section
  }

  devices.forEach((d, i) => {
    try {
      log.record({ step: `3.describeDevice[${i}]`, ok: true, result: describeHidDevice(d) })
    } catch (e) {
      log.fail(`3.describeDevice[${i}]`, e)
    }
  })

  for (const [i, d] of devices.entries()) {
    if (typeof d.forget === 'function') {
      await log.attempt(`4.forget[${i}]`, () => d.forget())
    } else {
      log.skip(`4.forget[${i}]`, 'HIDDevice.forget() is not available in this browser')
    }
  }

  return log.section
}

export function describeHidDevice(d: HIDDevice) {
  return {
    vendorId: hex(d.vendorId),
    productId: hex(d.productId),
    productName: d.productName,
    opened: d.opened,
    collections: d.collections.map(describeCollection),
  }
}

export interface CollectionSummary {
  usagePage: string
  usage: string
  type: number | null
  inputReports: ReportSummary[]
  outputReports: ReportSummary[]
  featureReports: ReportSummary[]
  children: CollectionSummary[]
}

export interface ReportSummary {
  reportId: number
  bytes: number
}

function describeCollection(c: HIDCollectionInfo): CollectionSummary {
  return {
    usagePage: hex(c.usagePage ?? 0),
    usage: hex(c.usage ?? 0),
    type: c.type ?? null,
    inputReports: (c.inputReports ?? []).map(describeReport),
    outputReports: (c.outputReports ?? []).map(describeReport),
    featureReports: (c.featureReports ?? []).map(describeReport),
    children: (c.children ?? []).map(describeCollection),
  }
}

// Report size in bytes, excluding the report-id prefix:
// Σ(reportSize × reportCount) / 8 over the report's items.
function describeReport(r: HIDReportInfo): ReportSummary {
  const bits = (r.items ?? []).reduce((sum, item) => sum + (item.reportSize ?? 0) * (item.reportCount ?? 0), 0)
  return { reportId: r.reportId ?? 0, bytes: bits / 8 }
}
