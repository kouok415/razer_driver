import { describe, expect, it } from 'vitest'
import { PROBE_VERSION, buildReport, countNonZero, hex, hexBytes } from './report'

describe('buildReport', () => {
  it('carries only the probe version, timestamp, user agent and the two sections', () => {
    const report = buildReport({ webusb: { steps: [] }, webhid: null }, new Date('2026-10-14T01:02:03.000Z'), 'UA/1.0')
    expect(report).toEqual({
      probeVersion: PROBE_VERSION,
      generatedAt: '2026-10-14T01:02:03.000Z',
      userAgent: 'UA/1.0',
      webusb: { steps: [] },
      webhid: null,
    })
  })
})

describe('byte helpers', () => {
  const view = new DataView(new Uint8Array([0x00, 0x0a, 0xff, 0x00, 0x10]).buffer)

  it('formats ids and byte ranges as hex', () => {
    expect(hex(0x1532)).toBe('0x1532')
    expect(hex(0x1, 2)).toBe('0x01')
    expect(hexBytes(view)).toBe('00 0a ff 00 10')
    expect(hexBytes(view, 1, 3)).toBe('0a ff')
    expect(hexBytes(view, 3, 99)).toBe('00 10')
    expect(hexBytes(undefined)).toBe('')
  })

  it('counts non-zero bytes in a range', () => {
    expect(countNonZero(view, 0, 5)).toBe(3)
    expect(countNonZero(view, 3, 90)).toBe(1)
    expect(countNonZero(undefined, 0, 8)).toBe(0)
  })
})
