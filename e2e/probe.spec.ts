import { expect, test, type Page } from '@playwright/test'

// Serial-number-like text the fake keyboard hides in its GET_REPORT reply
// and in device.serialNumber; it must never reach the report.
const SERIAL = 'PM2339H01234567'

const FORBIDDEN = [
  'controlTransferOut',
  'transferOut',
  'isochronousTransferOut',
  'selectConfiguration',
  'selectAlternateInterface',
  'reset',
  'clearHalt',
  'hid.open',
  'hid.sendReport',
  'hid.sendFeatureReport',
  'hid.receiveFeatureReport',
]

// Runs in the page before any app script. Self-contained: Playwright
// serializes the function source. The interface layout is invented for the
// test; it is not a capture of the real keyboard.
function installFakes(serial: string) {
  const calls: string[] = []
  ;(globalThis as unknown as { __probeCalls: string[] }).__probeCalls = calls

  const iface = (n: number, subclass: number, protocol: number, packetSize: number) => ({
    interfaceNumber: n,
    claimed: false,
    alternates: [
      {
        alternateSetting: 0,
        interfaceClass: 3,
        interfaceSubclass: subclass,
        interfaceProtocol: protocol,
        interfaceName: null,
        endpoints: [{ endpointNumber: n + 1, direction: 'in', type: 'interrupt', packetSize }],
      },
    ],
  })
  const configuration = {
    configurationValue: 1,
    configurationName: null,
    interfaces: [iface(0, 1, 1, 16), iface(1, 0, 0, 16), iface(2, 0, 0, 16), iface(3, 0, 0, 64)],
  }

  const reply = new Uint8Array(90)
  reply.set([0x02, 0x1f, 0x00, 0x00, 0x00, 0x16, 0x00, 0x82], 0)
  for (let i = 0; i < serial.length; i++) reply[8 + i] = serial.charCodeAt(i)
  reply[88] = 0x5a
  const descriptor = new Uint8Array([0x06, 0x00, 0xff, 0x09, 0x02, 0xa1, 0x01, 0x15, 0x00, 0x26, 0xff, 0x00, 0xc0])

  const forbidden = (name: string) => () => {
    calls.push(name)
    throw new Error(`forbidden ${name}`)
  }

  const usbDevice = {
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
    serialNumber: serial,
    opened: false,
    configuration,
    configurations: [configuration],
    async open() {
      calls.push('open')
      usbDevice.opened = true
    },
    async close() {
      calls.push('close')
      usbDevice.opened = false
    },
    async forget() {
      calls.push('forget')
    },
    async claimInterface(n: number) {
      calls.push(`claimInterface(${n})`)
      throw new DOMException('Unable to claim interface.', 'SecurityError')
    },
    async releaseInterface(n: number) {
      calls.push(`releaseInterface(${n})`)
    },
    async controlTransferIn(setup: { recipient: string; request: number }, length: number) {
      calls.push(`controlTransferIn(${setup.recipient},0x${setup.request.toString(16)},${length})`)
      if (setup.recipient === 'interface') {
        throw new DOMException('The specified interface has not been claimed.', 'InvalidStateError')
      }
      const bytes = setup.request === 0x01 ? reply : descriptor
      return { status: 'ok', data: new DataView(bytes.buffer.slice(0)) }
    },
    controlTransferOut: forbidden('controlTransferOut'),
    transferOut: forbidden('transferOut'),
    isochronousTransferOut: forbidden('isochronousTransferOut'),
    selectConfiguration: forbidden('selectConfiguration'),
    selectAlternateInterface: forbidden('selectAlternateInterface'),
    reset: forbidden('reset'),
    clearHalt: forbidden('clearHalt'),
  }

  const hidDevice = {
    vendorId: 0x1532,
    productId: 0x02a7,
    productName: 'Razer Huntsman V3 Pro TKL',
    opened: false,
    collections: [
      {
        usagePage: 0x01,
        usage: 0x06,
        type: 1,
        inputReports: [{ reportId: 0, items: [{ reportSize: 1, reportCount: 8 }, { reportSize: 8, reportCount: 7 }] }],
        outputReports: [{ reportId: 0, items: [{ reportSize: 1, reportCount: 5 }, { reportSize: 3, reportCount: 1 }] }],
        featureReports: [],
        children: [],
      },
    ],
    async forget() {
      calls.push('hid.forget')
    },
    open: forbidden('hid.open'),
    sendReport: forbidden('hid.sendReport'),
    sendFeatureReport: forbidden('hid.sendFeatureReport'),
    receiveFeatureReport: forbidden('hid.receiveFeatureReport'),
  }

  Object.defineProperty(navigator, 'usb', {
    configurable: true,
    value: {
      async requestDevice(options: unknown) {
        calls.push(`usb.requestDevice(${JSON.stringify(options)})`)
        return usbDevice
      },
    },
  })
  Object.defineProperty(navigator, 'hid', {
    configurable: true,
    value: {
      async requestDevice(options: unknown) {
        calls.push(`hid.requestDevice(${JSON.stringify(options)})`)
        return [hidDevice]
      },
    },
  })
}

async function reportJson(page: Page) {
  return JSON.parse(await page.getByRole('textbox', { name: /Report/ }).inputValue())
}

test('probe page loads from the build with both buttons and both languages', async ({ page }) => {
  await page.goto('/probe.html')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('鍵盤連線診斷')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Keyboard connection check')
  await expect(page.getByText('它只會讀取資訊，不會改變鍵盤上的任何設定。')).toBeVisible()
  await expect(page.getByText('It only reads. It changes nothing on your keyboard.')).toBeVisible()
  await expect(page.getByRole('button', { name: '1. 檢查 WebUSB / Check WebUSB' })).toBeVisible()
  await expect(page.getByRole('button', { name: '2. 檢查 WebHID / Check WebHID' })).toBeVisible()
  await expect(page.getByRole('button', { name: '複製報告 / Copy report' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: /Report/ })).toHaveAttribute('readonly', '')
})

test('both checks fill the report against fake WebUSB/WebHID without leaking the serial', async ({
  page,
  context,
}, testInfo) => {
  await page.addInitScript(installFakes, SERIAL)
  await page.goto('/probe.html')

  await page.getByRole('button', { name: /Check WebUSB/ }).click()
  await expect(page.getByRole('status')).toContainText('Done')

  const afterUsb = await reportJson(page)
  const steps = afterUsb.webusb.steps as { step: string; ok?: boolean; result?: unknown; error?: { name: string } }[]
  const described = steps.find((s) => s.step === '3.describeDevice')?.result as {
    activeConfigurationValue: number
    configurations: { interfaces: { interfaceNumber: number; alternate0: { interfaceClass: number } }[] }[]
  }
  expect(described.activeConfigurationValue).toBe(1)
  const interfaces = described.configurations[0].interfaces
  expect(interfaces.map((i) => i.interfaceNumber)).toEqual([0, 1, 2, 3])
  expect(interfaces.map((i) => i.alternate0.interfaceClass)).toEqual([3, 3, 3, 3])
  expect(steps.find((s) => s.step === '5.claimInterface')?.error?.name).toBe('SecurityError')
  expect(steps.find((s) => s.step === '6b.getFeatureReport.device')?.result).toEqual({
    status: 'ok',
    byteLength: 90,
    bytes0to7: '02 1f 00 00 00 16 00 82',
    argsNonZeroCount: SERIAL.length,
    bytes88to89: '5a 00',
  })
  expect(afterUsb.webhid).toBeNull()

  await page.getByRole('button', { name: /Check WebHID/ }).click()
  await expect.poll(async () => (await reportJson(page)).webhid?.steps.length).toBe(4)

  const text = await page.getByRole('textbox', { name: /Report/ }).inputValue()
  const report = JSON.parse(text)
  expect(Object.keys(report)).toEqual(['probeVersion', 'generatedAt', 'userAgent', 'webusb', 'webhid'])
  expect(report.webhid.steps[2].result.collections[0]).toMatchObject({
    usagePage: '0x0001',
    usage: '0x0006',
    inputReports: [{ reportId: 0, bytes: 8 }],
    outputReports: [{ reportId: 0, bytes: 1 }],
  })
  expect(text).not.toContain(SERIAL)
  expect(text).not.toContain(SERIAL.slice(0, 6))

  const calls = await page.evaluate(() => (globalThis as unknown as { __probeCalls: string[] }).__probeCalls)
  expect(calls).toEqual([
    'usb.requestDevice({"filters":[{"vendorId":5426,"productId":679}]})',
    'open',
    'claimInterface(3)',
    'controlTransferIn(interface,0x1,90)',
    'controlTransferIn(device,0x1,90)',
    'controlTransferIn(interface,0x6,1024)',
    'controlTransferIn(device,0x6,1024)',
    'close',
    'forget',
    'hid.requestDevice({"filters":[{"vendorId":5426,"productId":679}]})',
    'hid.forget',
  ])
  for (const name of FORBIDDEN) expect(calls).not.toContain(name)

  // The Copy button puts the same report on the clipboard.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: /Copy report/ }).click()
  await expect(page.getByRole('status')).toContainText('Copied')
  const clipboard = await page.evaluate(() =>
    (navigator as unknown as { clipboard: { readText(): Promise<string> } }).clipboard.readText(),
  )
  expect(clipboard).toBe(text)

  await testInfo.attach('probe-report.json', { body: text, contentType: 'application/json' })
})
