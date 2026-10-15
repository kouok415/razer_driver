import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  checkDoc, findProseCitations, packetChecksum, parseArgs, parseDoc, parseCitation, parseCitationCell, splitRow,
  SECTION_KEYS, UsageError,
} from './check-protocol-doc.mjs'

// All document text below is checker test data, not protocol claims.
const Z = 'zexrox:native/host.py:22@840f03dc'
const S = 'synapse:c1e6a425@430900#_calculateChecksum'
const P = 'probe:.ai_context/knowledge/hid-02a7-macos.txt#if3'
const U = 'url:https://example.com/spec'

const table = (header, rows) => [
  `| ${header.join(' | ')} |`,
  `|${header.map(() => '---|').join('')}`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
].join('\n')

const packet = (head, args = []) => {
  const b = new Array(90).fill(0)
  head.forEach((v, i) => { b[i] = v })
  args.forEach((v, i) => { b[8 + i] = v })
  b[88] = packetChecksum(b)
  return b
}
const hexBlock = (b) => {
  const rows = []
  for (let i = 0; i < b.length; i += 16) rows.push(b.slice(i, i + 16).map((v) => v.toString(16).padStart(2, '0')).join(' '))
  return ['```hex', ...rows, '```'].join('\n')
}
const gold = (n, kind, name, bytes, src = Z) => `### G${n}: ${kind} ${name}\n- Source: ${src}\n\n${hexBlock(bytes)}\n`

const FRAMING_ROWS = [
  ['0', '1', 'status', 's', Z, 'confirmed'], ['1', '1', 'txn', 't', Z, 'confirmed'],
  ['2-3', '2', 'remaining', 'r', Z, 'likely'], ['4', '1', 'proto', 'p', Z, 'likely'],
  ['5', '1', 'size', 'n', Z, 'confirmed'], ['6', '1', 'class', 'c', S, 'confirmed'],
  ['7', '1', 'id', 'i', Z, 'confirmed'], ['8-87', '80', 'args', 'a', Z, 'confirmed'],
  ['88', '1', 'checksum', 'x', `${Z}; ${S}`, 'confirmed'], ['89', '1', 'reserved', '-', Z, '[HYPOTHESIS]'],
]
const framing = (rows = FRAMING_ROWS, prose = 'Fixture: checksum byte and transaction id.') =>
  `## Framing\n\n${prose}\n\n${table(['Offset', 'Size', 'Field', 'Meaning', 'Source', 'Confidence'], rows)}\n`

const STATUS_ROWS = [0, 1, 2, 3, 4, 5].map((c) => [`0x0${c}`, `n${c}`, 'm', S, 'confirmed'])
const status = (rows = STATUS_ROWS, { txn = `Fixture text \`${S}\`.`, cycle = `Fixture text ${Z}.` } = {}) =>
  `## Transaction and status\n\n### Status codes\n\n${table(['Code', 'Name', 'Meaning', 'Source', 'Confidence'], rows)}\n\n` +
  `### Transaction ID\n\n${txn}\n\n### Request cycle\n\n${cycle}\n`

const CLAIM_ROWS = [1, 2, 3, 4, 5].map((n) => [`claim ${n}`, n === 5 ? U : P, 'confirmed'])
// The plan's literal probe citation form (keys IOUSBHostInterface@0..@5 exist in the probe file).
const PROBE_IF = (n) => `probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@${n}`
const IFACE_ROWS = [0, 1, 2, 3, 4, 5].map((n) => [`${n}`, 'HID', 'd', '1/6', 'in', PROBE_IF(n)])
const control = ({ claims = CLAIM_ROWS, ifaces = IFACE_ROWS, statusLine = '02A7 status: [UNVERIFIED]', open = '- q1' } = {}) =>
  `## Control interface\n\n${table(['Claim', 'Source', 'Confidence'], claims)}\n\n${statusLine}\n\n` +
  `### Interfaces on macOS\n\n${table(['Interface', 'Class', 'Driver', 'Usage page/usage', 'Reports', 'Source'], ifaces)}\n\n` +
  '### Protected collections\n\nchromium:services/device/hid/hid_service.cc:120@0123abcd#protected\n\n' +
  `### Transport options\n\n${U}\n\n### Open questions\n\n${open}\n`

const LAMP_ROWS = [1, 2, 3, 4, 5, 6].map((n) => [`r${n}`, `${n}`, 'in', '4', 'f', U, 'confirmed'])
const lamparray = (rows = LAMP_ROWS) =>
  `## LampArray (standard HID lighting)\n\n${table(['Report', 'ID', 'Direction', 'Size', 'Fields', 'Source', 'Confidence'], rows)}\n`

const CMD_HEADER = ['Group', 'Class', 'ID', 'Name', 'Dir', 'Size', 'Safe', 'Confidence', 'Source', 'Notes']
const CMD_ROWS = [
  ['device-info', '0x00', '0x81', 'Firmware version', 'read', '2', 'yes', 'confirmed', Z, ''],
  ['device-info', '0x00', '0x82', 'Serial number', 'read', '22', 'yes', 'confirmed', `${Z}; ${U}`, ''],
  ['lighting', '0x0f', '0x02', 'Set effect', 'write', '9', 'no', 'likely', S, ''],
  ['other', '0x00', '0x04', 'Mode', 'write', '2', 'no', '[HYPOTHESIS]', Z, ''],
]
const GAP_GROUPS = ['actuation', 'rapid-trigger', 'snap-tap', 'keymap', 'hypershift', 'macro', 'profile', 'polling']
const GAPS = GAP_GROUPS.map((g) => `- ${g}: fixture gap — ${Z}`)
const commands = ({ rows = CMD_ROWS, diag = 'Diagnostics reads: 0x00:0x81, `0x00:0x82`', gaps = GAPS, extra = '', tail = '' } = {}) =>
  `## Commands\n\n${table(CMD_HEADER, rows)}\n\n${extra}${diag}\n\n### Gaps\n\n${gaps.join('\n')}\n${tail}`

const G1 = packet([0x00, 0x1f, 0, 0, 0, 0x02, 0x00, 0x81])
const G2 = packet([0x00, 0x1f, 0, 0, 0, 0x16, 0x00, 0x82])
const G3 = packet([0x02, 0x1f, 0, 0, 0, 0x02, 0x00, 0x81], [1, 2])
const GOLDEN = [gold(1, 'request', 'firmware', G1), gold(2, 'request', 'serial', G2), gold(3, 'response', 'firmware', G3)]
const golden = (packets = GOLDEN) => `## Golden packets\n\nFixture intro.\n\n${packets.join('\n')}`

const MATRIX_ROWS = Array.from({ length: 10 }, (_, i) => [`feature ${i}`, 'area', ['yes', 'no', 'unknown'][i % 3], 'likely', i ? S : U])
const matrix = (rows = MATRIX_ROWS) =>
  `## Feature matrix\n\n${table(['Feature', 'Synapse UI area', 'RZ03-0498', 'Confidence', 'Source'], rows)}\n`

const sources = (body = 'See [protocol sources](protocol-sources.md).') => `## Sources\n\n${body}\n`

const BASE = {
  framing: framing(), status: status(), control: control(), lamparray: lamparray(),
  commands: commands(), golden: golden(), matrix: matrix(), sources: sources(),
}
const doc = (patch = {}) => ['# Test doc', '', ...SECTION_KEYS.map((k) => patch[k] ?? BASE[k])].join('\n')
const run = (text, opts = {}) => checkDoc(text, { sections: SECTION_KEYS, groups: [], ...opts })
const ok = (text, opts) => {
  const failures = run(text, opts)
  assert.deepEqual(failures, [], JSON.stringify(failures, null, 1))
}
const bad = (text, pattern, opts) => {
  const failures = run(text, opts)
  const lines = failures.map((f) => `[${f.section}] ${f.message}`)
  assert.ok(lines.some((l) => pattern.test(l)), `expected ${pattern} in:\n${lines.join('\n') || '(no failures)'}`)
  return failures
}

const SCRIPT = fileURLToPath(new URL('./check-protocol-doc.mjs', import.meta.url))
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })

test('a complete document passes every section and group rule', () => {
  ok(doc(), { groups: parseArgs(['--groups=all']).groups })
})

test('citation grammar accepts each form', () => {
  for (const c of [Z, 'zexrox:native/host.py:10-20@840f03dc#packet_checksum', S, P, U,
    'chromium:services/device/hid/hid_service.cc:120@0123abcd',
    'chromium:third_party/blink/renderer/modules/hid/hid.cc:5@0123456789abcdef0123456789abcdef01234567#Foo',
    'openrgb#4418:1234567']) {
    assert.ok(parseCitation(c), c)
  }
})

test('citation grammar rejects malformed citations', () => {
  for (const c of ['zexrox:native/host.py@840f03dc', 'zexrox:native/host.py:22@deadbeef', 'zexrox:native/host.py:20-10@840f03dc',
    'zexrox:native/host.py:0@840f03dc', 'synapse:c1e6a425@430900', 'synapse:C1E6A425@1#t', 'chromium:a.cc:1',
    'openrgb#999:1', 'probe:file.txt', 'url:http://example.com', 'host.py line 22']) {
    assert.equal(parseCitation(c), null, c)
  }
  assert.deepEqual(parseCitationCell('  ').errors, ['empty Source'])
  assert.match(parseCitationCell(`${Z}; nonsense`).errors[0], /bad citation "nonsense"/)
  assert.equal(parseCitationCell(`\`${Z}\`; ${S}`).cites.length, 2)
  assert.equal(findProseCitations(`see ${Z}. and synapse:bad`).cites.length, 1)
  assert.equal(findProseCitations(`see ${Z}. and synapse:bad`).errors.length, 1)
})

test('table rows split on unescaped pipes only', () => {
  assert.deepEqual(splitRow('| a | b \\| c |  |'), ['a', 'b | c', ''])
})

test('missing section is reported with the fixed message', () => {
  bad(doc({ framing: '' }), /\[framing\] missing section "## Framing"/)
  ok(doc({ framing: '' }), { sections: ['commands'] })
  bad(doc({ sources: `${sources()}\n${sources()}` }), /duplicate section/)
})

test('framing: contiguous 0..89 coverage, checksum/transaction mention', () => {
  bad(doc({ framing: framing(FRAMING_ROWS.filter((r) => r[0] !== '4')) }), /bytes 4-4 not covered/)
  bad(doc({ framing: framing([...FRAMING_ROWS, ['3-4', '2', 'dup', 'd', Z, 'likely']]) }), /bytes 3-3 overlap/)
  bad(doc({ framing: framing(FRAMING_ROWS.slice(0, -1)) }), /bytes 89-89 not covered/)
  bad(doc({ framing: framing([...FRAMING_ROWS, ['90', '1', 'x', 'x', Z, 'likely']]) }), /Offset must be N or N-M/)
  const noChecksumWord = FRAMING_ROWS.map((r) => [r[0], r[1], r[2] === 'checksum' ? 'xor' : r[2], r[3], Z, r[5]])
  bad(doc({ framing: framing(noChecksumWord, 'Fixture: transaction only.') }), /must mention "checksum"/)
  bad(doc({ framing: framing(FRAMING_ROWS, 'Fixture: checksum only.') }), /must mention "transaction"/)
  bad(doc({ framing: framing(FRAMING_ROWS.map((r, i) => (i ? r : [...r.slice(0, 4), '', r[5]]))) }), /offset 0: empty Source/)
  bad(doc({ framing: framing(FRAMING_ROWS.map((r, i) => (i ? r : [...r.slice(0, 5), 'sure']))) }), /Confidence "sure"/)
  bad(doc({ framing: framing(FRAMING_ROWS.map((r, i) => (i ? r : r.slice(0, 5)))) }), /row has 5 cells, expected 6/)
})

test('status: codes 0x00..0x05 and cited Transaction ID / Request cycle', () => {
  bad(doc({ status: status(STATUS_ROWS.filter((r) => r[0] !== '0x03')) }), /missing status code 0x03/)
  bad(doc({ status: status(STATUS_ROWS.map((r, i) => (i ? r : ['0X00', ...r.slice(1)]))) }), /Code must be lower-case/)
  bad(doc({ status: status(STATUS_ROWS, { txn: 'No citation here.' }) }), /"### Transaction ID" needs >= 1 citation/)
  bad(doc({ status: status(STATUS_ROWS, { cycle: '' }) }), /"### Request cycle" is empty/)
  bad(doc({ status: status(STATUS_ROWS, { cycle: 'see zexrox:native/host.py@840f03dc' }) }), /bad citation/)
  bad(doc({ status: status().replace('### Status codes', '### Codes') }), /missing table .* under "### Status codes"/)
})

test('control: claims, interfaces 0..5, subsections, 02A7 status line', () => {
  bad(doc({ control: control({ claims: CLAIM_ROWS.slice(0, 4) }) }), /needs >= 5 rows, has 4/)
  bad(doc({ control: control({ ifaces: IFACE_ROWS.filter((r) => r[0] !== '4') }) }), /missing row for interface 4/)
  bad(doc({ control: control({ statusLine: '02A7 status: unknown' }) }), /missing line "02A7 status/)
  bad(doc({ control: control({ open: '' }) }), /"### Open questions" is empty/)
  bad(doc({ control: control().replace('### Transport options', '### Transports') }), /missing subsection "### Transport options"/)
  ok(doc({ control: control({ statusLine: '02A7 status: [CONFIRMED] by probe' }) }))
})

test('lamparray: >= 6 rows covering report ids 1..6', () => {
  bad(doc({ lamparray: lamparray(LAMP_ROWS.slice(0, 5)) }), /needs >= 6 rows, has 5/)
  bad(doc({ lamparray: lamparray([...LAMP_ROWS.slice(0, 5), ['r7', '0x07', 'in', '4', 'f', U, 'likely']]) }), /missing LampArray report id 6/)
  ok(doc({ lamparray: lamparray(LAMP_ROWS.map((r, i) => (i ? r : [r[0], '0x01', ...r.slice(2)]))) }))
})

const cmdWith = (row) => doc({ commands: commands({ rows: [...CMD_ROWS, row] }) })
test('commands: per-row rules', () => {
  bad(cmdWith(['other', '0x00', '0x83', 'R', 'read', '2', 'no', 'likely', '', '']), /0x00:0x83 R: empty Source/)
  bad(cmdWith(['other', '0x00', '0x83', 'R', 'read', '2', 'no', 'likely', U, '']), /needs a zexrox or synapse citation/)
  bad(cmdWith(['other', '0x00', '0x83', 'R', 'read', '2', 'no', 'likely', P, '']), /needs a zexrox or synapse citation/)
  bad(cmdWith(['other', '0x00', '0x83', 'R', 'read', '2', 'no', 'likely', 'zexrox:x.py:1', '']), /bad citation/)
  bad(cmdWith(['other', '0x0F', '0x83', 'R', 'read', '2', 'no', 'likely', Z, '']), /Class must be lower-case 0xNN/)
  bad(cmdWith(['other', '0x00', '0x81', 'Again', 'read', '2', 'no', 'likely', Z, '']), /duplicate \(Class,ID\)/)
  bad(cmdWith(['other', '0x00', '0x05', 'W', 'read', '2', 'no', 'likely', Z, '']), /Dir=read but ID 0x05/)
  bad(cmdWith(['other', '0x00', '0x85', 'R', 'write', '2', 'no', 'likely', Z, '']), /Dir=write but ID 0x85/)
  bad(cmdWith(['other', '0x00', '0x86', 'R', 'read', '2', 'yes', '[HYPOTHESIS]', Z, '']), /Safe=yes needs Dir=read and Confidence=confirmed/)
  bad(cmdWith(['other', '0x00', '0x87', 'R', 'read', '2', 'yes', 'likely', Z, '']), /Safe=yes needs/)
  bad(cmdWith(['bogus', '0x00', '0x88', 'R', 'read', '2', 'no', 'likely', Z, '']), /Group "bogus"/)
  bad(cmdWith(['other', '0x00', '0x89', 'R', 'read', '2', 'maybe', 'probable', Z, '']), /Safe "maybe"/)
  bad(cmdWith(['other', '0x00', '0x89', 'R', 'read', '2', 'no', 'probable', Z, '']), /Confidence "probable"/)
  bad(doc({ commands: commands({ extra: `${table(CMD_HEADER, CMD_ROWS.slice(0, 1))}\n\n` }) }), /more than one table/)
  ok(cmdWith(['other', '0x00', '0x8a', 'R', 'read', '2', 'no', 'likely', `${U}; ${S}`, 'note']))
})

test('probe citation: the plan literal probe:...#IOUSBHostInterface@3 parses in cells and prose', () => {
  const lit = 'probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3'
  assert.equal(lit, PROBE_IF(3))
  assert.deepEqual(parseCitation(lit), { kind: 'probe', text: lit })
  for (const cell of [lit, `\`${lit}\``, `${Z}; ${lit}`, `${lit}; ${Z}`, `${lit};${S}`]) {
    const { cites, errors } = parseCitationCell(cell)
    assert.deepEqual(errors, [], cell)
    assert.ok(cites.some((c) => c.kind === 'probe' && c.text === lit), cell)
  }
  for (const prose of [`Seen as ${lit}.`, `(see \`${lit}\`)`, `${lit}; also ${Z}`, `x ${lit}, y`]) {
    const { cites, errors } = findProseCitations(prose)
    assert.deepEqual(errors, [], prose)
    assert.deepEqual(cites.filter((c) => c.kind === 'probe').map((c) => c.text), [lit], prose)
  }
  assert.equal(parseCitation(`${lit} x`), null)
  assert.equal(parseCitation(`${lit}|x`), null)
  assert.equal(parseCitation('probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3#x'), null)
  // In a document: a Source table cell (Claims) and the only citation of a cited subsection (prose).
  const claims = CLAIM_ROWS.map((r, i) => (i ? r : [r[0], lit, r[2]]))
  ok(doc({ control: control({ claims }), status: status(STATUS_ROWS, { txn: `Observed in ${lit}.` }) }))
  ok(doc({ commands: commands({ rows: CMD_ROWS.map((r, i) => (i ? r : [...r.slice(0, 8), `${Z}; ${lit}`, r[9]])) }) }), { sections: ['commands'] })
})

test('commands: exactly ONE command-like table; side tables need grammatical Source cells', () => {
  const SIDE = ['Group', 'Class', 'ID', 'Name', 'Dir', 'Size', 'Safe', 'Confidence', 'Source']
  const bogus = ['lighting', '0x0F', '0x02', 'Bogus', 'read', '9', 'yes', '[HYPOTHESIS]', '']
  const all = { groups: parseArgs(['--groups=all']).groups }
  // The verifier's repro: same columns minus Notes, a row that breaks every row rule.
  bad(doc({ commands: commands({ extra: `${table(SIDE, [bogus])}\n\n` }) }), /\[commands\] command-like table \| Group \| Class \| ID .*exactly one command table/, all)
  bad(doc({ commands: commands({ tail: `\n### Extra\n\n${table(SIDE, [bogus])}\n` }) }), /command-like table/, all)
  bad(doc({ commands: commands({ extra: `${table(CMD_HEADER.map((h) => h.toLowerCase()), [[...bogus, '']])}\n\n` }) }), /command-like table/)
  bad(doc({ commands: commands({ extra: `${table(['Cmd', 'Class', 'Report ID', 'Source'], [['x', '0x0f', '0x02', Z]])}\n\n` }) }), /command-like table/)
  bad(doc({ commands: commands({ extra: `| ${bogus.join(' | ')} |\n\n` }) }), /command-like table \| lighting \|/)
  bad(doc({ commands: commands({ extra: `${table(CMD_HEADER, CMD_ROWS.slice(0, 1))}\n\n` }) }), /more than one table/)
  // M4's Reply layouts table is not command-like and passes; its Source cells are checked.
  const REPLY = ['Command', 'Bytes', 'Meaning', 'Source']
  const reply = (rows) => commands({ tail: `\n### Reply layouts\n\n${table(REPLY, rows)}\n` })
  ok(doc({ commands: reply([['0x00:0x81', '8-9', 'major, minor', Z], ['0x00:0x82', '8-29', 'serial', `${S}; ${PROBE_IF(3)}`]]) }), all)
  bad(doc({ commands: reply([['0x00:0x81', '8-9', 'major', '']]) }), /\[commands\] row "0x00:0x81" under "### Reply layouts": empty Source/)
  bad(doc({ commands: reply([['0x00:0x81', '8-9', 'major', 'host.py line 22']]) }), /under "### Reply layouts": bad citation "host.py line 22"/)
  bad(doc({ commands: reply([['0x00:0x81', '8-9', 'major']]) }), /row has 3 cells, expected 4/)
  bad(doc({ commands: commands({ tail: `\n### Reply layouts\n\n${table(['Command', 'Bytes', 'Meaning'], [['0x00:0x81', '8', 'm']])}\n` }) }), /needs a Source column/)
})

test('commands: Diagnostics reads line', () => {
  bad(doc({ commands: commands({ diag: '' }) }), /missing line "Diagnostics reads/)
  bad(doc({ commands: commands({ diag: 'Diagnostics reads: 0x0f:0x02' }) }), /0x0f:0x02 is not a Safe=yes Commands row/)
  bad(doc({ commands: commands({ diag: 'Diagnostics reads: 0x00:0x99' }) }), /0x00:0x99 is not a Safe=yes/)
  bad(doc({ commands: commands({ diag: 'Diagnostics reads: 00:81' }) }), /must be 0xCC:0xII/)
})

test('commands: --groups coverage via rows or Gaps bullets; device-info needs firmware and serial', () => {
  const all = parseArgs(['--groups=all']).groups
  assert.ok(!all.includes('other'))
  bad(doc({ commands: commands({ gaps: GAPS.filter((g) => !g.startsWith('- macro:')) }) }), /group macro has no rows/, { groups: all })
  ok(doc({ commands: commands({ gaps: GAPS.filter((g) => !g.startsWith('- macro:')) }) }), { groups: ['actuation'] })
  bad(doc({ commands: commands({ gaps: [...GAPS, `- polling: no reason — ${U}`, '- keymap: missing dash'] }) }), /Gaps bullet must be/)
  bad(doc({ commands: commands({ gaps: [...GAPS, `- device-info: no — ${Z}`] }) }), /Gaps group "device-info" not allowed/)
  const noSerial = CMD_ROWS.filter((r) => r[2] !== '0x82')
  bad(doc({ commands: commands({ rows: noSerial, diag: 'Diagnostics reads: 0x00:0x81' }) }), /confirmed serial read row/, { groups: ['device-info'] })
  const likelyFw = CMD_ROWS.map((r) => (r[2] === '0x81' ? [...r.slice(0, 6), 'no', 'likely', ...r.slice(8)] : r))
  bad(doc({ commands: commands({ rows: likelyFw, diag: 'Diagnostics reads: 0x00:0x82' }) }), /confirmed firmware read row/, { groups: ['device-info'] })
})

test('golden: 90 bytes, XOR checksum, data size, command cross-check, counts', () => {
  const g1 = [...G1]
  g1[88] ^= 1
  bad(doc({ golden: golden([gold(1, 'request', 'firmware', g1), ...GOLDEN.slice(1)]) }), /G1: checksum byte 88/)
  bad(doc({ golden: golden([gold(1, 'request', 'firmware', G1.slice(0, 89)), ...GOLDEN.slice(1)]) }), /G1: 89 bytes, expected 90/)
  bad(doc({ golden: golden([gold(1, 'request', 'big', packet([0, 0x1f, 0, 0, 0, 81, 0, 0x81])), ...GOLDEN.slice(1)]) }), /data size \(byte 5\) 81 > 80/)
  bad(doc({ golden: golden([gold(1, 'request', 'hyp', packet([0, 0x1f, 0, 0, 0, 2, 0, 0x04])), ...GOLDEN.slice(1)]) }), /0x00:0x04 is a \[HYPOTHESIS\] command/)
  bad(doc({ golden: golden([gold(1, 'request', 'unknown', packet([0, 0x1f, 0, 0, 0, 2, 0x07, 0x81])), ...GOLDEN.slice(1)]) }), /0x07:0x81 \(bytes 6,7\) is not a Commands row/)
  bad(doc({ golden: golden(GOLDEN.slice(1)) }), /needs >= 2 request packets, has 1/)
  bad(doc({ golden: golden(GOLDEN.slice(0, 2)) }), /needs >= 1 response packet, has 0/)
  bad(doc({ golden: golden([gold(1, 'request', 'firmware', G1, ''), ...GOLDEN.slice(1)]) }), /G1: empty Source/)
  bad(doc({ golden: golden([GOLDEN[0].replace(/- Source: .*\n/, ''), ...GOLDEN.slice(1)]) }), /first line must be "- Source:/)
  bad(doc({ golden: golden([gold(1, 'request', 'firmware', G1, U), ...GOLDEN.slice(1)]) }), /url citations alone/)
  bad(doc({ golden: golden([GOLDEN[0].replace('request firmware', 'req firmware'), ...GOLDEN.slice(1)]) }), /golden heading must be/)
  bad(doc({ golden: golden([GOLDEN[0].replace(/```hex\n[0-9a-f]{2}/, '```hex\nzz'), ...GOLDEN.slice(1)]) }), /bad hex byte "zz"/)
  bad(doc({ commands: '' }), /no Commands table to cross-check/, { sections: ['golden'] })
})

test('matrix: >= 10 rows, yes|no|unknown, cited', () => {
  bad(doc({ matrix: matrix(MATRIX_ROWS.slice(0, 9)) }), /needs >= 10 rows, has 9/)
  bad(doc({ matrix: matrix(MATRIX_ROWS.map((r, i) => (i ? r : [r[0], r[1], 'maybe', r[3], r[4]]))) }), /RZ03-0498 "maybe"/)
  bad(doc({ matrix: matrix(MATRIX_ROWS.map((r, i) => (i ? r : [...r.slice(0, 4), '']))) }), /empty Source/)
})

test('sources: links protocol-sources.md without duplicating it', () => {
  bad(doc({ sources: sources('See the sources file.') }), /must link .*protocol-sources\.md/)
  bad(doc({ sources: sources(`[s](protocol-sources.md)\n\n${table(['Id', 'Url'], [['a', 'b']])}`) }), /no tables here/)
})

test('failure lines carry the document line number', () => {
  const text = cmdWith(['other', '0x00', '0x83', 'R', 'read', '2', 'no', 'likely', '', ''])
  const [f] = run(text, { sections: ['commands'] })
  assert.match(text.split('\n')[f.line - 1], /\| 0x83 \| R \|/)
})

test('argument parsing: keys, groups, usage errors', () => {
  assert.deepEqual(parseArgs([]).sections, [...SECTION_KEYS])
  assert.deepEqual(parseArgs(['--require=none']).sections, [])
  assert.deepEqual(parseArgs(['x.md', '--require=commands,golden']), { doc: 'x.md', sections: ['commands', 'golden'], groups: [], help: false })
  assert.throws(() => parseArgs(['--require=bogus']), UsageError)
  assert.throws(() => parseArgs(['--groups=nope']), UsageError)
  assert.throws(() => parseArgs(['--sources=/tmp']), UsageError)
  assert.throws(() => parseArgs(['a.md', 'b.md']), UsageError)
})

test('CLI exit codes on the fixtures', () => {
  const okRun = cli('--require=commands,golden', '--groups=all', fixture('ok-minimal.md'))
  assert.equal(okRun.status, 0, okRun.stderr)
  const empty = cli('--require=commands', fixture('empty-source.md'))
  assert.equal(empty.status, 1)
  assert.match(empty.stderr, /empty-source\.md:\d+: \[commands\] 0x00:0x83 .*: empty Source/)
  const hyp = cli('--require=commands', fixture('hypothesis-safe.md'))
  assert.equal(hyp.status, 1)
  assert.match(hyp.stderr, /hypothesis-safe\.md:\d+: \[commands\] 0x00:0x83 .*: Safe=yes needs Dir=read and Confidence=confirmed/)
  const dir = cli('--require=commands', fixture('dir-mismatch.md'))
  assert.equal(dir.status, 1)
  assert.match(dir.stderr, /dir-mismatch\.md:\d+: \[commands\] 0x00:0x04 .*: Dir=read but ID 0x04 \(read iff ID >= 0x80\)/)
  const second = cli('--require=commands,golden', '--groups=all', fixture('second-commands-table.md'))
  assert.equal(second.status, 1)
  assert.match(second.stderr, /second-commands-table\.md:14: \[commands\] command-like table \| Group \| Class \| ID \| Name \| Dir \| Size \| Safe \| Confidence \| Source \|/)
  const sum = cli('--require=golden', fixture('bad-checksum.md'))
  assert.equal(sum.status, 1)
  assert.match(sum.stderr, /G1: checksum byte 88/)
  const missing = cli('--require=framing', fixture('ok-minimal.md'))
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /missing section/)
  assert.equal(cli('--require=bogus', fixture('ok-minimal.md')).status, 2)
  assert.equal(cli('--require=commands', fixture('does-not-exist.md')).status, 2)
})

test('canonical form: every pipe-bearing line is a canonical line of an allowlisted table', () => {
  const all = { groups: parseArgs(['--groups=all']).groups }
  const row = '| lighting | 0x0f | 0x02 | Bogus | read | 9 | yes | [HYPOTHESIS] |  | x |'
  const fence = '    ' + '`'.repeat(3)
  bad(doc({ commands: commands({ extra: `${row.slice(2, -2)}\n\n` }) }), /\[commands\] stray "\|" outside a canonical table line/, all)
  bad(doc({ commands: commands({ extra: `> ${row}\n\n` }) }), /\[commands\] "\|" inside a blockquote/, all)
  bad(doc({ commands: commands({ extra: `- item\n  ${row}\n\n` }) }), /\[commands\] indented table line/, all)
  bad(doc({ commands: commands({ extra: '<table><tr><td>0x0f</td></tr></table>\n\n' }) }), /raw HTML table markup/, all)
  // A fence the checker would skip but Markdown does not (indented, or a backtick in the info string).
  bad(doc({ commands: commands({ extra: `${fence}\n\n${row}\n\n${fence}\n\n` }) }), /non-canonical code fence/, all)
  bad(doc({ commands: commands({ extra: `\`\`\`x\`\n\n${row}\n\n\`\`\`\n\n` }) }), /non-canonical code fence/, all)
  bad(doc({ golden: golden().replace(/```\n*$/, '') }), /unclosed code fence/)
  // A pipe-less line right after a table renders as one more row.
  bad(doc({ commands: commands().replace('|\n\nDiagnostics', '|\nlighting 0x0f 0x02 Bogus\n\nDiagnostics') }), /table must be followed by a blank line/, all)
  bad(doc({ commands: commands().replace(`|${'---|'.repeat(10)}`, '|---|---|') }), /separator row with one cell per column/)
  bad(doc({ status: status().replace('### Status codes', '### Status codes\n\n### Other') }), /\[status\] table \| Code .* under "### Other" not allowed/)
  bad(doc({ sources: `${sources()}\n## Commands ##\n\n${table(CMD_HEADER, [CMD_ROWS[0]])}\n` }), /\[doc\] table \| Group .* outside a checked section/)
  ok(doc({ commands: commands({ extra: 'Pipes in prose are escaped: a \\| b.\n\n' }) }), all)
})

test('bypass fixtures: every variant exits 1 with a canonical-form failure; probe-and-reply passes', () => {
  const expected = {
    'v1-renamed-groupcol2.md': /:16: \[commands\] command-like table \| Name \| Category \| Cmd \|/,
    'v2-abbrev-headers.md': /:16: \[commands\] command-like table \| Grp \| Cls \| Cmd \|/,
    'v3-class-command.md': /:14: \[commands\] command-like table \| Group name \| Class \| Command \|/,
    'v4-pipeless-row.md': /:11: \[commands\] stray "\|" outside a canonical table line/,
    'v5-pipeless-table.md': /:14: \[commands\] stray "\|" outside a canonical table line/,
    'v6-blockquote-table.md': /:14: \[commands\] "\|" inside a blockquote/,
    'v7-control-otherH3.md': /:16: \[commands\] command-like table \| Group \| Class \| ID \| Name \| Dir \| Size \| Safe \| Confidence \| Source \| under "### Vendor extras"/,
    'v8-html-comment-hides-fence.md': /:14: \[commands\] raw HTML block/,
    'v9-html-div-hides-fence.md': /:14: \[commands\] raw HTML block/,
  }
  for (const [name, re] of Object.entries(expected)) {
    const r = cli('--require=commands,golden', '--groups=all', fixture(`bypass/${name}`))
    assert.equal(r.status, 1, `${name}: ${r.stdout}`)
    assert.match(r.stderr, re, name)
  }
  const f1 = cli('--require=control,commands,golden', '--groups=device-info', fixture('probe-and-reply.md'))
  assert.equal(f1.status, 0, f1.stderr)
})

test('raw HTML blocks, lone CR line endings and NBSP-only lines cannot hide or glue rows', () => {
  const all = { groups: parseArgs(['--groups=all']).groups }
  // An HTML block can hide a fence line from GitHub's renderer while the checker still sees a fence.
  bad(doc({ commands: commands({ extra: '<!-- note -->\n\n' }) }), /\[commands\] raw HTML block/, all)
  bad(doc({ commands: commands({ extra: '<div>\n\n</div>\n\n' }) }), /\[commands\] raw HTML block/, all)
  // A lone \r is a CommonMark line ending, so it must split lines too.
  assert.deepEqual(parseDoc('a\rb\r\nc\nd').lines.map((l) => l.text), ['a', 'b', 'c', 'd'])
  // A line holding only a NBSP is not blank in Markdown: it would read as one more table row.
  const glued = doc().replace(/(\|)\n\n(Diagnostics reads)/, '$1\n\u00a0\n$2')
  assert.notEqual(glued, doc())
  bad(glued, /table must be followed by a blank line/, all)
})
