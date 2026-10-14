import { describe, expect, it } from 'vitest'
import { detectWebHidSupport } from './device'

describe('detectWebHidSupport', () => {
  it('requires a secure context', () => {
    expect(detectWebHidSupport({ isSecureContext: false, hid: {} })).toBe('insecure-context')
  })

  it('reports browsers without navigator.hid', () => {
    expect(detectWebHidSupport({ isSecureContext: true })).toBe('unsupported-browser')
  })

  it('accepts a secure context with navigator.hid', () => {
    expect(detectWebHidSupport({ isSecureContext: true, hid: {} })).toBe('supported')
  })
})
