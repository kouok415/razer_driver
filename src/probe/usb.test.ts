import { describe, expect, it } from 'vitest'
import { runWebUsbProbe } from './usb'
import type { ProbeSection, StepRecord } from './report'

// Fake WebUSB. Every call is logged; methods that could change device state
// throw, so a probe that calls one fails loudly. Interface layout is made up
// for the test — it is not a capture of the real keyboard.

const SERIAL = 'PM2339H01234567'
const SERIAL_HEX = [...SERIAL].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))

const FORBIDDEN = [
  'controlTransferOut',
  'transferOut',
  'isochronousTransferOut',
  'selectConfiguration',
  'selectAlternateInterface',
  'reset',
  'clearHalt',
] as const

interface Call {
  method: string
  args: unknown[]
}

interface FakeOptions {
  claimSucceeds?: boolean
  configurationAfterOpen?: 'keep' | 'null'
  reportReply?: Uint8Array
  hangOnRequest?: number
  noForget?: boolean
  requestDeviceError?: DOMException
}

// A 90-byte Razer-style reply whose argument bytes hold ASCII text, as a
// serial-number answer would.
function serialReply(): Uint8Array {
  const r = new Uint8Array(90)
  r.set([0x02, 0x1f, 0x00, 0x00, 0x00, 0x16, 0x00, 0x82], 0)
  r.set([...SERIAL].map((c) => c.charCodeAt(0)), 8)
  r[88] = 0x5a
  return r
}

const REPORT_DESCRIPTOR = new Uint8Array([0x06, 0x00, 0xff, 0x09, 0x01, 0xa1, 0x01, 0xc0])

function makeInterface(n: number, cls: number) {
  return {
    interfaceNumber: n,
    claimed: false,
    alternates: [
      {
        alternateSetting: 0,
        interfaceClass: cls,
        interfaceSubclass: n === 0 ? 1 : 0,
        interfaceProtocol: n === 0 ? 1 : 0,
        interfaceName: null,
        endpoints: [{ endpointNumber: n + 1, direction: 'in', type: 'interrupt', packetSize: n === 3 ? 64 : 16 }],
      },
    ],
  }
}

function makeFake(opts: FakeOptions = {}) {
  const calls: Call[] = []
  let serialReads = 0
  const configuration = {
    configurationValue: 1,
    configurationName: null,
    interfaces: [makeInterface(0, 3), makeInterface(1, 3), makeInterface(2, 3), makeInterface(3, 3)],
  }
  const log = (method: string, ...args: unknown[]) => calls.push({ method, args })

  const device: Record<string, unknown> = {
    vendorId: 0x1532,
    productId: 0x02a7,
    productName: 'Razer Huntsman V3 Pro TKL',
    manufacturerName: 'Razer',
    usbVersionMajor: 2,
    usbVersionMinor: 0,
    usbVersionSubminor: 0,
    deviceVersionMajor: 2,
    deviceVersionMinor: 0,
    deviceVersionSubminor: 0,
    deviceClass: 0,
    deviceSubclass: 0,
    deviceProtocol: 0,
    get serialNumber() {
      serialReads++
      return SERIAL
    },
    opened: false,
    configuration,
    configurations: [configuration],
    async open() {
      log('open')
      device.opened = true
      if (opts.configurationAfterOpen === 'null') device.configuration = null
    },
    async close() {
      log('close')
      device.opened = false
    },
    async claimInterface(n: number) {
      log('claimInterface', n)
      if (!opts.claimSucceeds) throw new DOMException('Unable to claim interface.', 'SecurityError')
      configuration.interfaces[n].claimed = true
    },
    async releaseInterface(n: number) {
      log('releaseInterface', n)
      configuration.interfaces[n].claimed = false
    },
    controlTransferIn(setup: USBControlTransferParameters, length: number) {
      log('controlTransferIn', setup, length)
      const n = calls.filter((c) => c.method === 'controlTransferIn').length
      if (opts.hangOnRequest === n) return new Promise(() => {})
      // Like Chrome: an interface-recipient transfer needs a claimed interface.
      if (setup.recipient === 'interface' && !configuration.interfaces[setup.index & 0xff].claimed) {
        return Promise.reject(new DOMException('The specified interface has not been claimed.', 'InvalidStateError'))
      }
      if (setup.request === 0x01) {
        const reply = opts.reportReply ?? new Uint8Array(90)
        return Promise.resolve({ status: 'ok', data: new DataView(reply.buffer.slice(0)) })
      }
      return Promise.resolve({ status: 'ok', data: new DataView(REPORT_DESCRIPTOR.buffer.slice(0)) })
    },
  }
  if (!opts.noForget) {
    device.forget = async () => {
      log('forget')
    }
  }
  for (const name of FORBIDDEN) {
    device[name] = (...args: unknown[]) => {
      log(name, ...args)
      throw new Error(`forbidden method ${name} called`)
    }
  }

  const usb = {
    async requestDevice(options: USBDeviceRequestOptions) {
      log('requestDevice', options)
      if (opts.requestDeviceError) throw opts.requestDeviceError
      return device
    },
  }

  return {
    usb: usb as unknown as USB,
    calls,
    methods: () => calls.map((c) => c.method),
    serialReads: () => serialReads,
  }
}

const SETUP_A = { requestType: 'class', recipient: 'interface', request: 0x01, value: 0x0300, index: 3 }
const SETUP_B = { requestType: 'class', recipient: 'device', request: 0x01, value: 0x0300, index: 3 }
const SETUP_C = { requestType: 'standard', recipient: 'interface', request: 0x06, value: 0x2200, index: 3 }
const SETUP_D = { requestType: 'standard', recipient: 'device', request: 0x06, value: 0x2200, index: 3 }

function step(section: ProbeSection, name: string): StepRecord {
  const found = section.steps.find((s) => s.step === name)
  if (!found) throw new Error(`step ${name} not recorded; got ${section.steps.map((s) => s.step).join(', ')}`)
  return found
}

function expectNoForbiddenCalls(methods: string[]) {
  for (const name of FORBIDDEN) expect(methods).not.toContain(name)
}

describe('runWebUsbProbe', () => {
  it('runs the read-only sequence when claiming interface 3 is refused', async () => {
    const fake = makeFake()
    const section = await runWebUsbProbe({ usb: fake.usb, isSecureContext: true })

    expect(fake.calls).toEqual([
      { method: 'requestDevice', args: [{ filters: [{ vendorId: 0x1532, productId: 0x02a7 }] }] },
      { method: 'open', args: [] },
      { method: 'claimInterface', args: [3] },
      { method: 'controlTransferIn', args: [SETUP_A, 90] },
      { method: 'controlTransferIn', args: [SETUP_B, 90] },
      { method: 'controlTransferIn', args: [SETUP_C, 1024] },
      { method: 'controlTransferIn', args: [SETUP_D, 1024] },
      { method: 'close', args: [] },
      { method: 'forget', args: [] },
    ])
    expectNoForbiddenCalls(fake.methods())

    expect(section.steps.map((s) => s.step)).toEqual([
      '1.environment',
      '2.requestDevice',
      '3.describeDevice',
      '4.open',
      '5.claimInterface',
      '6a.getFeatureReport.interface',
      '6b.getFeatureReport.device',
      '6c.getReportDescriptor.interface',
      '6d.getReportDescriptor.device',
      '7.close',
      '7.forget',
    ])
    expect(step(section, '1.environment').result).toEqual({ navigatorUsb: true, isSecureContext: true })
    expect(step(section, '5.claimInterface')).toMatchObject({
      ok: false,
      error: { name: 'SecurityError', message: 'Unable to claim interface.' },
    })
    // A failed transfer is recorded and the probe goes on to the next one.
    expect(step(section, '6a.getFeatureReport.interface')).toMatchObject({
      ok: false,
      error: { name: 'InvalidStateError' },
      request: { requestType: 'class', recipient: 'interface', request: '0x01', value: '0x0300', index: 3, length: 90 },
    })
    expect(step(section, '6b.getFeatureReport.device')).toMatchObject({
      ok: true,
      result: { status: 'ok', byteLength: 90, bytes0to7: '00 00 00 00 00 00 00 00', argsNonZeroCount: 0, bytes88to89: '00 00' },
    })
    expect(step(section, '6d.getReportDescriptor.device')).toMatchObject({
      ok: true,
      result: { status: 'ok', byteLength: 8, hex: '06 00 ff 09 01 a1 01 c0' },
    })
  })

  it('records the device layout without opening it first', async () => {
    const fake = makeFake()
    const section = await runWebUsbProbe({ usb: fake.usb, isSecureContext: true })
    const described = step(section, '3.describeDevice').result as {
      opened: boolean
      usbVersion: string
      activeConfigurationValue: number | null
      configurations: { configurationValue: number; interfaces: { interfaceNumber: number }[] }[]
    }

    expect(described.opened).toBe(false)
    expect(described.usbVersion).toBe('2.0.0')
    expect(described.activeConfigurationValue).toBe(1)
    expect(described.configurations).toHaveLength(1)
    expect(described.configurations[0].configurationValue).toBe(1)
    expect(described.configurations[0].interfaces.map((i) => i.interfaceNumber)).toEqual([0, 1, 2, 3])
    expect(described.configurations[0].interfaces[3]).toEqual({
      interfaceNumber: 3,
      claimed: false,
      alternateCount: 1,
      alternate0: {
        alternateSetting: 0,
        interfaceClass: 3,
        interfaceSubclass: 0,
        interfaceProtocol: 0,
        interfaceName: null,
        endpoints: [{ endpointNumber: 4, direction: 'in', type: 'interrupt', packetSize: 64 }],
      },
    })
  })

  it('releases interface 3 before closing when the claim succeeds', async () => {
    const fake = makeFake({ claimSucceeds: true })
    const section = await runWebUsbProbe({ usb: fake.usb, isSecureContext: true })

    expect(fake.methods()).toEqual([
      'requestDevice',
      'open',
      'claimInterface',
      'controlTransferIn',
      'controlTransferIn',
      'controlTransferIn',
      'controlTransferIn',
      'releaseInterface',
      'close',
      'forget',
    ])
    expect(fake.calls.find((c) => c.method === 'releaseInterface')?.args).toEqual([3])
    expect(step(section, '5.claimInterface')).toMatchObject({ ok: true, result: { claimed: true } })
    expect(step(section, '6a.getFeatureReport.interface')).toMatchObject({ ok: true })
    expect(step(section, '7.releaseInterface')).toMatchObject({ ok: true })
  })

  it('never leaks GET_REPORT argument bytes or the serial number', async () => {
    const fake = makeFake({ claimSucceeds: true, reportReply: serialReply() })
    const section = await runWebUsbProbe({ usb: fake.usb, isSecureContext: true })
    const json = JSON.stringify(section)

    expect(json).not.toContain(SERIAL)
    expect(json).not.toContain(SERIAL.slice(0, 6))
    expect(json).not.toContain(SERIAL_HEX.join(' '))
    expect(json).not.toContain(SERIAL_HEX.join(''))
    expect(json).not.toContain(SERIAL_HEX.slice(0, 4).join(' '))
    expect(fake.serialReads()).toBe(0)

    for (const name of ['6a.getFeatureReport.interface', '6b.getFeatureReport.device']) {
      expect(step(section, name).result).toEqual({
        status: 'ok',
        byteLength: 90,
        bytes0to7: '02 1f 00 00 00 16 00 82',
        argsNonZeroCount: SERIAL.length,
        bytes88to89: '5a 00',
      })
    }
  })

  it('skips claim and transfers when there is no active configuration', async () => {
    const fake = makeFake({ configurationAfterOpen: 'null' })
    const section = await runWebUsbProbe({ usb: fake.usb, isSecureContext: true })

    expect(fake.methods()).toEqual(['requestDevice', 'open', 'close', 'forget'])
    expect(step(section, '4.open').result).toEqual({ opened: true, activeConfigurationValue: null })
    for (const name of [
      '5.claimInterface',
      '6a.getFeatureReport.interface',
      '6b.getFeatureReport.device',
      '6c.getReportDescriptor.interface',
      '6d.getReportDescriptor.device',
    ]) {
      expect(step(section, name).skipped).toMatch(/configuration is null/)
    }
  })

  it('records a cancelled device picker and stops', async () => {
    const fake = makeFake({ requestDeviceError: new DOMException('No device selected.', 'NotFoundError') })
    const section = await runWebUsbProbe({ usb: fake.usb, isSecureContext: true })

    expect(fake.methods()).toEqual(['requestDevice'])
    expect(section.steps).toEqual([
      { step: '1.environment', ok: true, result: { navigatorUsb: true, isSecureContext: true } },
      { step: '2.requestDevice', ok: false, error: { name: 'NotFoundError', message: 'No device selected.' } },
    ])
  })

  it('reports a browser without navigator.usb', async () => {
    const section = await runWebUsbProbe({ usb: undefined, isSecureContext: true })
    expect(section.steps).toEqual([
      { step: '1.environment', ok: true, result: { navigatorUsb: false, isSecureContext: true } },
      { step: '2.requestDevice', skipped: 'navigator.usb is not available in this browser' },
    ])
  })

  it('times out a transfer that never answers and still cleans up', async () => {
    const fake = makeFake({ hangOnRequest: 2 })
    const section = await runWebUsbProbe({ usb: fake.usb, isSecureContext: true, timeoutMs: 20 })

    expect(step(section, '6b.getFeatureReport.device')).toMatchObject({
      ok: false,
      error: { name: 'ProbeTimeout', message: 'no answer within 20 ms' },
    })
    expect(step(section, '6c.getReportDescriptor.interface')).toMatchObject({ ok: false })
    expect(step(section, '6d.getReportDescriptor.device')).toMatchObject({ ok: true })
    expect(fake.methods().slice(-2)).toEqual(['close', 'forget'])
  })

  it('records when forget() is unavailable', async () => {
    const fake = makeFake({ noForget: true })
    const section = await runWebUsbProbe({ usb: fake.usb, isSecureContext: true })

    expect(fake.methods()).not.toContain('forget')
    expect(step(section, '7.forget').skipped).toMatch(/not available/)
  })

  it('reports progress after every step', async () => {
    const fake = makeFake()
    const seen: number[] = []
    const section = await runWebUsbProbe({
      usb: fake.usb,
      isSecureContext: true,
      onChange: (s) => seen.push(s.steps.length),
    })
    expect(seen).toEqual(section.steps.map((_, i) => i + 1))
  })
})
