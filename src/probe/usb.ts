// WebUSB half of the read-only diagnostic page.
//
// Question it answers: can Chrome's WebUSB reach the vendor control channel
// on USB interface 3 (macOS binds no driver to it, so WebHID cannot see it)?
//
// READ-ONLY by construction: the only device methods called are open,
// claimInterface/releaseInterface (interface 3 only), controlTransferIn,
// close and forget. Never controlTransferOut, transferOut,
// isochronousTransferOut, selectConfiguration, selectAlternateInterface,
// reset or clearHalt. `device.serialNumber` is never read.

import { HUNTSMAN_V3_PRO_TKL_PRODUCT_ID, RAZER_VENDOR_ID } from '../hid/device'
import { StepLog, countNonZero, hex, hexBytes, type ProbeSection } from './report'

// Interface 3 carries the vendor control channel (src/hid/device.ts).
export const CONTROL_INTERFACE = 3

export const USB_FILTERS: USBDeviceFilter[] = [
  { vendorId: RAZER_VENDOR_ID, productId: HUNTSMAN_V3_PRO_TKL_PRODUCT_ID },
]

// Razer's 90-byte report frame: bytes 0-7 header, 8-87 arguments, 88-89
// CRC + reserved (layout per OpenRazer razercommon.h, read for facts only).
// HID GET_REPORT is bRequest 0x01; wValue 0x0300 = report type Feature (3),
// report id 0. GET_DESCRIPTOR is bRequest 0x06; wValue 0x2200 = descriptor
// type HID Report (0x22), index 0 (USB HID 1.11, sections 7.1.1 and 7.2.1).
interface ProbeTransfer {
  step: string
  kind: 'feature-report' | 'report-descriptor'
  setup: USBControlTransferParameters
  length: number
}

export const PROBE_TRANSFERS: readonly ProbeTransfer[] = [
  {
    step: '6a.getFeatureReport.interface',
    kind: 'feature-report',
    setup: { requestType: 'class', recipient: 'interface', request: 0x01, value: 0x0300, index: CONTROL_INTERFACE },
    length: 90,
  },
  {
    step: '6b.getFeatureReport.device',
    kind: 'feature-report',
    setup: { requestType: 'class', recipient: 'device', request: 0x01, value: 0x0300, index: CONTROL_INTERFACE },
    length: 90,
  },
  {
    step: '6c.getReportDescriptor.interface',
    kind: 'report-descriptor',
    setup: { requestType: 'standard', recipient: 'interface', request: 0x06, value: 0x2200, index: CONTROL_INTERFACE },
    length: 1024,
  },
  {
    step: '6d.getReportDescriptor.device',
    kind: 'report-descriptor',
    setup: { requestType: 'standard', recipient: 'device', request: 0x06, value: 0x2200, index: CONTROL_INTERFACE },
    length: 1024,
  },
]

export interface UsbProbeEnv {
  usb: USB | undefined
  isSecureContext: boolean
  timeoutMs?: number
  onChange?: (section: ProbeSection) => void
}

export async function runWebUsbProbe(env: UsbProbeEnv): Promise<ProbeSection> {
  const log = new StepLog(env.onChange, env.timeoutMs)

  // 1. Environment
  log.record({
    step: '1.environment',
    ok: true,
    result: { navigatorUsb: Boolean(env.usb), isSecureContext: env.isSecureContext },
  })
  const usb = env.usb
  if (!usb) {
    log.skip('2.requestDevice', 'navigator.usb is not available in this browser')
    return log.section
  }

  // 2. Device picker. Not time-limited: the person is choosing.
  let device: USBDevice
  try {
    device = await usb.requestDevice({ filters: USB_FILTERS })
    log.record({ step: '2.requestDevice', ok: true, result: { filters: describeFilters() } })
  } catch (e) {
    log.fail('2.requestDevice', e)
    return log.section
  }

  // 3. Describe without opening.
  try {
    log.record({ step: '3.describeDevice', ok: true, result: describeDevice(device) })
  } catch (e) {
    log.fail('3.describeDevice', e)
  }

  // 4. Open.
  const opened = await log.attempt(
    '4.open',
    () => device.open(),
    () => ({
      opened: device.opened,
      activeConfigurationValue: device.configuration ? device.configuration.configurationValue : null,
    }),
  )

  if (!opened.ok) {
    skipTransfers(log, 'device.open() failed')
  } else if (device.configuration === null) {
    // Never pick a configuration ourselves (selectConfiguration is a write).
    skipTransfers(log, 'device.configuration is null after open; selectConfiguration is never called')
  } else {
    // 5. Claim interface 3 (expected: SecurityError, HID is a protected class).
    const claim = await log.attempt(
      '5.claimInterface',
      () => device.claimInterface(CONTROL_INTERFACE),
      () => ({ claimed: true }),
      { interfaceNumber: CONTROL_INTERFACE },
    )

    // 6. Read-only control transfers; each failure is recorded, then we go on.
    for (const t of PROBE_TRANSFERS) {
      await log.attempt(
        t.step,
        () => device.controlTransferIn(t.setup, t.length),
        (r) => (t.kind === 'feature-report' ? summarizeFeatureReport(r) : summarizeDescriptor(r)),
        describeSetup(t),
      )
    }

    // 7. Clean up.
    if (claim.ok) {
      await log.attempt('7.releaseInterface', () => device.releaseInterface(CONTROL_INTERFACE), undefined, {
        interfaceNumber: CONTROL_INTERFACE,
      })
    }
  }

  if (opened.ok) await log.attempt('7.close', () => device.close())

  if (typeof device.forget === 'function') {
    await log.attempt('7.forget', () => device.forget())
  } else {
    log.skip('7.forget', 'USBDevice.forget() is not available in this browser')
  }

  return log.section
}

function skipTransfers(log: StepLog, reason: string): void {
  log.skip('5.claimInterface', reason)
  for (const t of PROBE_TRANSFERS) log.skip(t.step, reason)
}

function describeFilters() {
  return USB_FILTERS.map((f) => ({ vendorId: hex(f.vendorId ?? 0), productId: hex(f.productId ?? 0) }))
}

function describeSetup(t: ProbeTransfer): Record<string, unknown> {
  return {
    requestType: t.setup.requestType,
    recipient: t.setup.recipient,
    request: hex(t.setup.request, 2),
    value: hex(t.setup.value),
    index: t.setup.index,
    length: t.length,
  }
}

/**
 * A GET_REPORT reply may be the firmware's last answer, which can hold the
 * serial number in the argument bytes. Only the header (bytes 0-7), a count
 * of non-zero argument bytes (8-87) and bytes 88-89 are kept.
 */
export function summarizeFeatureReport(r: USBInTransferResult) {
  const data = r.data
  return {
    status: r.status,
    byteLength: data?.byteLength ?? 0,
    bytes0to7: hexBytes(data, 0, 8),
    argsNonZeroCount: countNonZero(data, 8, 88),
    bytes88to89: hexBytes(data, 88, 90),
  }
}

export function summarizeDescriptor(r: USBInTransferResult) {
  const data = r.data
  return { status: r.status, byteLength: data?.byteLength ?? 0, hex: hexBytes(data) }
}

// Deliberately lists fields one by one: never spread or serialize the
// device object itself, which would pull in serialNumber.
export function describeDevice(d: USBDevice) {
  return {
    vendorId: hex(d.vendorId),
    productId: hex(d.productId),
    productName: d.productName,
    manufacturerName: d.manufacturerName,
    usbVersion: `${d.usbVersionMajor}.${d.usbVersionMinor}.${d.usbVersionSubminor}`,
    deviceVersion: `${d.deviceVersionMajor}.${d.deviceVersionMinor}.${d.deviceVersionSubminor}`,
    deviceClass: d.deviceClass,
    deviceSubclass: d.deviceSubclass,
    deviceProtocol: d.deviceProtocol,
    opened: d.opened,
    // The active configuration is listed once, inside `configurations`.
    activeConfigurationValue: d.configuration ? d.configuration.configurationValue : null,
    configurations: d.configurations.map(describeConfiguration),
  }
}

function describeConfiguration(c: USBConfiguration) {
  return {
    configurationValue: c.configurationValue,
    configurationName: c.configurationName,
    interfaces: c.interfaces.map((i) => {
      const alt = i.alternates[0]
      return {
        interfaceNumber: i.interfaceNumber,
        claimed: i.claimed,
        alternateCount: i.alternates.length,
        alternate0: alt
          ? {
              alternateSetting: alt.alternateSetting,
              interfaceClass: alt.interfaceClass,
              interfaceSubclass: alt.interfaceSubclass,
              interfaceProtocol: alt.interfaceProtocol,
              interfaceName: alt.interfaceName,
              endpoints: alt.endpoints.map((e) => ({
                endpointNumber: e.endpointNumber,
                direction: e.direction,
                type: e.type,
                packetSize: e.packetSize,
              })),
            }
          : null,
      }
    }),
  }
}
