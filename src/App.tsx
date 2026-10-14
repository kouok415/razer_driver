import { detectWebHidSupport } from './hid/device'

const SUPPORT_TEXT = {
  supported: 'WebHID 可用 / WebHID available',
  'insecure-context': '需要 HTTPS 或 localhost / Requires HTTPS or localhost',
  'unsupported-browser': '此瀏覽器不支援 WebHID，請用 Chrome、Edge、Opera 或 Brave / WebHID unsupported — use Chrome, Edge, Opera or Brave',
} as const

function App() {
  const support = detectWebHidSupport({
    isSecureContext: window.isSecureContext,
    hid: (navigator as Navigator & { hid?: unknown }).hid,
  })

  return (
    <main>
      <h1>Razer Huntsman V3 Pro TKL</h1>
      <p data-testid="webhid-support" data-status={support}>
        {SUPPORT_TEXT[support]}
      </p>
    </main>
  )
}

export default App
