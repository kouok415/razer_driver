// USB identity of the Razer Huntsman V3 Pro Tenkeyless (RZ03-0498).
// Sources: OpenRGB issue #4418 and zexrox/huntsman-synapse-web README
// (control traffic goes to USB interface 3).
export const RAZER_VENDOR_ID = 0x1532
export const HUNTSMAN_V3_PRO_TKL_PRODUCT_ID = 0x02a7

export const DEVICE_FILTERS: HIDDeviceFilter[] = [
  { vendorId: RAZER_VENDOR_ID, productId: HUNTSMAN_V3_PRO_TKL_PRODUCT_ID },
]

export type WebHidSupport = 'supported' | 'insecure-context' | 'unsupported-browser'

export function detectWebHidSupport(env: { isSecureContext: boolean; hid?: unknown }): WebHidSupport {
  if (!env.isSecureContext) return 'insecure-context'
  if (!env.hid) return 'unsupported-browser'
  return 'supported'
}
