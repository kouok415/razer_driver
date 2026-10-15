import '../index.css'
import './probe.css'
import { runWebHidProbe } from './hid'
import { buildReport, errorInfo, type ProbeSection } from './report'
import { runWebUsbProbe } from './usb'

const sections: { webusb: ProbeSection | null; webhid: ProbeSection | null } = { webusb: null, webhid: null }

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} missing from probe.html`)
  return el as T
}

const usbButton = byId<HTMLButtonElement>('probe-usb')
const hidButton = byId<HTMLButtonElement>('probe-hid')
const copyButton = byId<HTMLButtonElement>('probe-copy')
const output = byId<HTMLTextAreaElement>('probe-report')
const status = byId<HTMLElement>('probe-status')

function render(): void {
  output.value = JSON.stringify(buildReport(sections, new Date(), navigator.userAgent), null, 2)
}

const RUNNING = '檢查中…請在 Chrome 跳出的視窗中選擇鍵盤。 / Checking… pick the keyboard in the Chrome pop-up.'
const DONE = '完成。可以按「複製報告」。 / Done. You can click “Copy report”.'
const FAILED = '檢查意外中斷，報告裡有錯誤訊息。 / The check stopped unexpectedly; the report contains the error.'

// Each button is its own user gesture: requestDevice() is the first thing
// the probe awaits, so it still runs inside the click's activation.
function wire(
  button: HTMLButtonElement,
  key: 'webusb' | 'webhid',
  run: (onChange: (s: ProbeSection) => void) => Promise<ProbeSection>,
): void {
  button.addEventListener('click', () => {
    button.disabled = true
    status.textContent = RUNNING
    const onChange = (s: ProbeSection) => {
      sections[key] = s
      render()
    }
    run(onChange)
      .then((s) => {
        onChange(s)
        status.textContent = DONE
      })
      .catch((e: unknown) => {
        // The probes record their own errors; this only catches bugs.
        const partial = sections[key] ?? { steps: [] }
        onChange({ steps: [...partial.steps, { step: 'unexpected', ok: false, error: errorInfo(e) }] })
        status.textContent = FAILED
      })
      .finally(() => {
        button.disabled = false
      })
  })
}

wire(usbButton, 'webusb', (onChange) =>
  runWebUsbProbe({
    usb: 'usb' in navigator ? navigator.usb : undefined,
    isSecureContext: window.isSecureContext,
    onChange,
  }),
)

wire(hidButton, 'webhid', (onChange) =>
  runWebHidProbe({
    hid: 'hid' in navigator ? navigator.hid : undefined,
    isSecureContext: window.isSecureContext,
    onChange,
  }),
)

copyButton.addEventListener('click', () => {
  if (!output.value) {
    status.textContent = '還沒有報告，請先按上面的檢查按鈕。 / No report yet — click a check button above first.'
    return
  }
  Promise.resolve()
    .then(() => navigator.clipboard.writeText(output.value))
    .then(() => {
      status.textContent = '已複製，可以貼上了。 / Copied — you can paste it now.'
    })
    .catch(() => {
      output.focus()
      output.select()
      status.textContent = '無法自動複製，報告已全選，請按 ⌘C。 / Could not copy automatically; the report is selected — press ⌘C.'
    })
})
