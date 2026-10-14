import { describe, expect, it } from 'vitest'
import { runWebHidProbe } from './hid'

// Fake WebHID. Anything that opens the device or moves a report throws.
// Collections are made up for the test, not captured from the keyboard.

const FORBIDDEN = ['open', 'close', 'sendReport', 'sendFeatureReport', 'receiveFeatureReport'] as const

function makeFake(devices: { productName: string; collections: HIDCollectionInfo[] }[], opts: { noForget?: boolean } = {}) {
  const calls: { method: string; args: unknown[] }[] = []
  const log = (method: string, ...args: unknown[]) => calls.push({ method, args })

  const fakeDevices = devices.map((d, i) => {
    const device: Record<string, unknown> = {
      vendorId: 0x1532,
      productId: 0x02a7,
      productName: d.productName,
      opened: false,
      collections: d.collections,
    }
    if (!opts.noForget) {
      device.forget = async () => {
        log(`forget[${i}]`)
      }
    }
    for (const name of FORBIDDEN) {
      device[name] = (...args: unknown[]) => {
        log(name, ...args)
        throw new Error(`forbidden method ${name} called`)
      }
    }
    return device
  })

  const hid = {
    async requestDevice(options: HIDDeviceRequestOptions) {
      log('requestDevice', options)
      return fakeDevices
    },
  }
  return { hid: hid as unknown as HID, calls, methods: () => calls.map((c) => c.method) }
}

const item = (reportSize: number, reportCount: number): HIDReportItem => ({ reportSize, reportCount })

const KEYBOARD: HIDCollectionInfo = {
  usagePage: 0x01,
  usage: 0x06,
  type: 1,
  inputReports: [{ reportId: 0, items: [item(1, 8), item(8, 1), item(8, 6)] }],
  outputReports: [{ reportId: 0, items: [item(1, 5), item(3, 1)] }],
  featureReports: [],
  children: [],
}

const VENDOR: HIDCollectionInfo = {
  usagePage: 0xff00,
  usage: 0x01,
  type: 1,
  inputReports: [],
  outputReports: [],
  featureReports: [{ reportId: 0, items: [item(8, 90)] }],
  children: [
    {
      usagePage: 0xff00,
      usage: 0x02,
      type: 2,
      inputReports: [{ reportId: 5, items: [item(8, 15)] }],
    },
  ],
}

describe('runWebHidProbe', () => {
  it('describes every returned device without opening it, then forgets each', async () => {
    const fake = makeFake([
      { productName: 'Razer Huntsman V3 Pro TKL', collections: [KEYBOARD] },
      { productName: 'Razer Huntsman V3 Pro TKL', collections: [VENDOR] },
    ])
    const section = await runWebHidProbe({ hid: fake.hid, isSecureContext: true })

    expect(fake.calls).toEqual([
      { method: 'requestDevice', args: [{ filters: [{ vendorId: 0x1532, productId: 0x02a7 }] }] },
      { method: 'forget[0]', args: [] },
      { method: 'forget[1]', args: [] },
    ])
    for (const name of FORBIDDEN) expect(fake.methods()).not.toContain(name)

    expect(section.steps.map((s) => s.step)).toEqual([
      '1.environment',
      '2.requestDevice',
      '3.describeDevice[0]',
      '3.describeDevice[1]',
      '4.forget[0]',
      '4.forget[1]',
    ])
    expect(section.steps[1].result).toEqual({
      filters: [{ vendorId: '0x1532', productId: '0x02a7' }],
      deviceCount: 2,
    })
    expect(section.steps[2].result).toEqual({
      vendorId: '0x1532',
      productId: '0x02a7',
      productName: 'Razer Huntsman V3 Pro TKL',
      opened: false,
      collections: [
        {
          usagePage: '0x0001',
          usage: '0x0006',
          type: 1,
          inputReports: [{ reportId: 0, bytes: 8 }],
          outputReports: [{ reportId: 0, bytes: 1 }],
          featureReports: [],
          children: [],
        },
      ],
    })
    expect(section.steps[3].result).toEqual({
      vendorId: '0x1532',
      productId: '0x02a7',
      productName: 'Razer Huntsman V3 Pro TKL',
      opened: false,
      collections: [
        {
          usagePage: '0xff00',
          usage: '0x0001',
          type: 1,
          inputReports: [],
          outputReports: [],
          featureReports: [{ reportId: 0, bytes: 90 }],
          children: [
            {
              usagePage: '0xff00',
              usage: '0x0002',
              type: 2,
              inputReports: [{ reportId: 5, bytes: 15 }],
              outputReports: [],
              featureReports: [],
              children: [],
            },
          ],
        },
      ],
    })
    expect(section.steps[4]).toEqual({ step: '4.forget[0]', ok: true })
  })

  it('records a cancelled picker (empty list)', async () => {
    const fake = makeFake([])
    const section = await runWebHidProbe({ hid: fake.hid, isSecureContext: true })
    expect(fake.methods()).toEqual(['requestDevice'])
    expect(section.steps.map((s) => s.step)).toEqual(['1.environment', '2.requestDevice'])
    expect(section.steps[1].result).toMatchObject({ deviceCount: 0 })
  })

  it('reports a browser without navigator.hid', async () => {
    const section = await runWebHidProbe({ hid: undefined, isSecureContext: false })
    expect(section.steps).toEqual([
      { step: '1.environment', ok: true, result: { navigatorHid: false, isSecureContext: false } },
      { step: '2.requestDevice', skipped: 'navigator.hid is not available in this browser' },
    ])
  })

  it('records when forget() is unavailable', async () => {
    const fake = makeFake([{ productName: 'x', collections: [] }], { noForget: true })
    const section = await runWebHidProbe({ hid: fake.hid, isSecureContext: true })
    expect(section.steps.at(-1)).toEqual({
      step: '4.forget[0]',
      skipped: 'HIDDevice.forget() is not available in this browser',
    })
  })
})
