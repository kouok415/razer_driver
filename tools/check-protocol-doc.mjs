// Protocol-doc checker for .ai_context/knowledge/protocol.md: section structure,
// table rules and citation grammar, plus citation resolution against the
// downloaded sources (--sources) and the citation lock.
//
// Usage: node tools/check-protocol-doc.mjs [DOC] [--require=k,..|all|none] [--groups=g,..|all]
//          [--sources=DIR [--only=k,..] [--write-lock]] [--manifest=FILE] [--lock=FILE]
// Exit:  0 ok; 1 rule failures (one line each: doc:line: [section] message);
//        2 usage or IO error (including an unknown section key or group, and a
//          sources directory that is missing or does not match the manifest).
//
// --sources=DIR first checks DIR against tools/sources.manifest.json: the zexrox
// commit is read from DIR/zexrox/.git as files (git is never run) and every
// DIR/synapse-web file must have its pinned sha256. It then resolves each
// citation of the kinds in --only (default: all). The default DOC is also
// checked against tools/citations.lock.json (--lock=FILE for another DOC): every
// citation needs an entry, no entry may be stale, and a citation resolved now
// must hash to its entry. --write-lock regenerates the lock from DIR.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const DEFAULT_DOC = '.ai_context/knowledge/protocol.md'
export const ZEXROX_COMMIT = '840f03dc'
export const PACKET_SIZE = 90
export const MAX_DATA_SIZE = 80

// Fixed strings that gates grep for.
export const MSG = Object.freeze({
  emptySource: 'empty Source',
  citationNotFound: 'citation not found',
  missingSection: 'missing section',
  notInLock: 'citation not in lock',
  lockMismatch: 'citation changed since lock',
  staleLock: 'stale lock entry',
})

export const SECTIONS = Object.freeze({
  framing: 'Framing',
  status: 'Transaction and status',
  control: 'Control interface',
  lamparray: 'LampArray (standard HID lighting)',
  commands: 'Commands',
  golden: 'Golden packets',
  matrix: 'Feature matrix',
  sources: 'Sources',
})
export const SECTION_KEYS = Object.freeze(Object.keys(SECTIONS))

export const GROUPS = Object.freeze([
  'device-info', 'actuation', 'rapid-trigger', 'snap-tap', 'lighting', 'keymap',
  'hypershift', 'macro', 'profile', 'polling', 'other',
])
export const CONFIDENCE = Object.freeze(['confirmed', 'likely', '[HYPOTHESIS]'])
export const MATRIX_VALUES = Object.freeze(['yes', 'no', 'unknown'])

export const DEFAULT_MANIFEST = 'tools/sources.manifest.json'
export const DEFAULT_LOCK = 'tools/citations.lock.json'
// Citation kinds that resolve against a file; url citations are only grammar-checked.
export const RESOLVE_KINDS = Object.freeze(['zexrox', 'synapse', 'chromium', 'openrgb', 'probe'])

const USAGE = 'usage: node tools/check-protocol-doc.mjs [DOC] [--require=k,..|all|none] [--groups=g,..|all] ' +
  '[--sources=DIR [--only=k,..] [--write-lock]] [--manifest=FILE] [--lock=FILE]'

const HEADERS = {
  framing: ['Offset', 'Size', 'Field', 'Meaning', 'Source', 'Confidence'],
  status: ['Code', 'Name', 'Meaning', 'Source', 'Confidence'],
  claims: ['Claim', 'Source', 'Confidence'],
  interfaces: ['Interface', 'Class', 'Driver', 'Usage page/usage', 'Reports', 'Source'],
  lamparray: ['Report', 'ID', 'Direction', 'Size', 'Fields', 'Source', 'Confidence'],
  commands: ['Group', 'Class', 'ID', 'Name', 'Dir', 'Size', 'Safe', 'Confidence', 'Source', 'Notes'],
  matrix: ['Feature', 'Synapse UI area', 'RZ03-0498', 'Confidence', 'Source'],
  reply: ['Command', 'Bytes', 'Meaning', 'Source'],
}

// ---- citation grammar -------------------------------------------------------

const TOKEN = String.raw`[\w.$-]+`
// Probe keys name IORegistry entries such as IOUSBHostInterface@3. ";" (the
// Source-cell separator), whitespace, "|" and "#" stay excluded.
const PROBE_KEY = String.raw`[\w.$@-]+`
const PATH = String.raw`[\w./-]+`
// Each form captures the fields resolution needs; FIELDS names them.
const CITATION_FORMS = [
  ['zexrox', new RegExp(String.raw`^zexrox:(${PATH}):(\d+)(?:-(\d+))?@${ZEXROX_COMMIT}(?:#(${TOKEN}))?$`)],
  ['synapse', new RegExp(String.raw`^synapse:([0-9a-f]{8})@(\d+)#(${TOKEN})$`)],
  ['chromium', new RegExp(String.raw`^chromium:(${PATH}):(\d+)@([0-9a-f]{7,40})(?:#(${TOKEN}))?$`)],
  ['openrgb', /^openrgb#4418:([\w-]+)$/],
  ['probe', new RegExp(String.raw`^probe:(${PATH})#(${PROBE_KEY})$`)],
  ['url', /^url:(https:\/\/[^\s|;<>`]+)$/],
]
const FIELDS = {
  zexrox: (m) => ({ path: m[1], from: Number(m[2]), to: Number(m[3] ?? m[2]), token: m[4] ?? null }),
  synapse: (m) => ({ sha: m[1], offset: Number(m[2]), token: m[3] }),
  chromium: (m) => ({ path: m[1], line: Number(m[2]), commit: m[3], token: m[4] ?? null }),
  openrgb: (m) => ({ note: m[1] }),
  probe: (m) => ({ path: m[1], key: m[2] }),
  url: (m) => ({ url: m[1] }),
}
const PROSE_CITATION = /(?<![\w./:#-])(?:(?:zexrox|synapse|chromium|probe|url):|openrgb#)[^\s;|,`()<>]+/g
const PRIMARY = new Set(['zexrox', 'synapse'])

// { kind, text, ...fields } or null. Fields (an absent #token is null): zexrox
// path/from/to/token, synapse sha/offset/token, chromium path/line/commit/token,
// openrgb note, probe path/key, url url.
export const parseCitation = (text) => {
  for (const [kind, re] of CITATION_FORMS) {
    const m = re.exec(text)
    if (!m) continue
    const cite = { kind, text, ...FIELDS[kind](m) }
    if (kind === 'zexrox' && (cite.from < 1 || cite.to < cite.from)) return null
    return cite
  }
  return null
}

// A Source cell: one or more citations separated by "; ".
export const parseCitationCell = (cell) => {
  const text = cell.trim()
  if (!text) return { cites: [], errors: [MSG.emptySource] }
  const cites = []
  const errors = []
  for (const raw of text.split(';')) {
    const part = raw.trim().replace(/^`(.*)`$/, '$1')
    if (!part) {
      errors.push('empty citation between ";" separators')
      continue
    }
    const cite = parseCitation(part)
    if (cite) cites.push(cite)
    else errors.push(`bad citation "${part}"`)
  }
  return { cites, errors }
}

// Citation-like tokens inside prose; each must be grammatical.
export const findProseCitations = (text) => {
  const cites = []
  const errors = []
  for (const [match] of text.matchAll(PROSE_CITATION)) {
    const part = match.replace(/\.+$/, '')
    const cite = parseCitation(part)
    if (cite) cites.push(cite)
    else errors.push(`bad citation "${part}"`)
  }
  return { cites, errors }
}

// ---- markdown model ---------------------------------------------------------

const H2 = /^## (.+?)\s*$/
const H3 = /^### (.+?)\s*$/
const FENCE = /^\s*(```|~~~)/
// Anything Markdown could read as a fence line (any indentation, >= 3 marks).
const FENCE_LIKE = /^\s*(`{3,}|~{3,})/
// The only accepted opener: three marks in column 1 plus an optional [\w-] info string.
const FENCE_OPEN = /^(```|~~~)[\w-]*\s*$/

export const splitRow = (line) => {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
    } else if (s[i] === '|') {
      cells.push(cur.trim())
      cur = ''
    } else cur += s[i]
  }
  cells.push(cur.trim())
  return cells
}

const makeTable = (block, sub) => {
  const [head, sep, ...rows] = block
  const header = splitRow(head.text)
  const delim = sep === undefined ? [] : splitRow(sep.text)
  return {
    sub,
    no: head.no,
    end: block.at(-1).no,
    header,
    valid: delim.length === header.length && delim.every((c) => /^:?-{3,}:?$/.test(c)),
    rows: rows.map((l) => ({ no: l.no, cells: splitRow(l.text) })),
  }
}

const parseTables = (body) => {
  const tables = []
  let sub = null
  let block = []
  const flush = () => {
    if (block.length) tables.push(makeTable(block, sub))
    block = []
  }
  for (const line of body) {
    if (!line.fenced && line.text.trim().startsWith('|')) {
      block.push(line)
      continue
    }
    flush()
    const m = line.fenced ? null : H3.exec(line.text)
    if (m) sub = m[1]
  }
  flush()
  return tables
}

const makeSection = (title, no, body) => {
  const subs = []
  for (const line of body) {
    const m = line.fenced ? null : H3.exec(line.text)
    if (m) subs.push({ title: m[1], no: line.no, body: [] })
    else if (subs.length) subs.at(-1).body.push(line)
  }
  return { title, no, body, subs, tables: parseTables(body) }
}

export const parseDoc = (text) => {
  // CommonMark line endings: \r\n, \n or a lone \r (a lone \r must not hide lines from the checker).
  const lines = text.split(/\r\n|\r|\n/).map((t, i) => ({ no: i + 1, text: t, fenced: false }))
  // Canonical fences only: the opener is ``` or ~~~ (plus [\w-] info) in column
  // 1 and the closer is the same three marks alone. Every other fence-like line
  // is marked badFence (and rejected), so an accepted doc fences exactly what
  // Markdown fences and no table can hide behind an odd fence.
  let fence = null
  let opened = 0
  for (const line of lines) {
    if (fence) {
      line.fenced = true
      if (line.text.trimEnd() === fence) fence = null
      else if (FENCE_LIKE.test(line.text)) line.badFence = true
    } else if (FENCE_LIKE.test(line.text)) {
      line.fenced = true
      const m = FENCE_OPEN.exec(line.text)
      if (m) {
        fence = m[1]
        opened = line.no
      } else line.badFence = true
    }
  }
  const heads = lines.filter((l) => !l.fenced && H2.test(l.text))
  const sections = heads.map((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].no - 1 : lines.length
    return makeSection(H2.exec(h.text)[1], h.no, lines.slice(h.no, end))
  })
  return { lines, sections, unclosed: fence ? opened : 0 }
}

// ---- rule helpers -----------------------------------------------------------

const sameHeader = (a, b) => a.length === b.length && a.every((c, i) => c === b[i])
const fmtHeader = (h) => `| ${h.join(' | ')} |`
const findSub = (section, title) => section.subs.find((s) => s.title === title)
const hx = (n) => `0x${n.toString(16).padStart(2, '0')}`
const HEX_BYTE = /^0x[0-9a-f]{2}$/
const short = (s) => (s.length > 40 ? `${s.slice(0, 37)}...` : s)

const rowsOf = (table, header) => table.rows
  .filter((r) => r.cells.length === header.length)
  .map((r) => ({ no: r.no, c: Object.fromEntries(header.map((h, i) => [h, r.cells[i]])) }))

const requireTable = (ctx, key, section, header, { sub, minRows = 1 } = {}) => {
  const where = sub === undefined ? '' : ` under "### ${sub}"`
  const found = section.tables.filter((t) => sameHeader(t.header, header) && (sub === undefined || t.sub === sub))
  if (!found.length) {
    ctx.fail(key, section.no, `missing table ${fmtHeader(header)}${where}`)
    return null
  }
  for (const extra of found.slice(1)) ctx.fail(key, extra.no, `more than one table ${fmtHeader(header)}${where}`)
  const table = found[0]
  for (const r of table.rows) {
    if (r.cells.length !== header.length) ctx.fail(key, r.no, `row has ${r.cells.length} cells, expected ${header.length}`)
  }
  const rows = rowsOf(table, header)
  if (rows.length < minRows) ctx.fail(key, table.no, `table ${fmtHeader(header)} needs >= ${minRows} rows, has ${rows.length}`)
  return { no: table.no, rows }
}

const checkSource = (ctx, key, no, cell, label, { primary = false } = {}) => {
  const { cites, errors } = parseCitationCell(cell)
  for (const e of errors) ctx.fail(key, no, `${label}: ${e}`)
  if (primary && cites.length && !cites.some((c) => PRIMARY.has(c.kind))) {
    ctx.fail(key, no, `${label}: Source needs a zexrox or synapse citation`)
  }
  return cites
}

const checkConfidence = (ctx, key, no, value, label) => {
  if (!CONFIDENCE.includes(value)) ctx.fail(key, no, `${label}: Confidence "${value}" not one of ${CONFIDENCE.join(' | ')}`)
}

// A subsection that must exist and be non-empty; prose citations in it must be
// grammatical, and with `cited` at least one is required.
const checkSub = (ctx, key, section, title, { cited = false } = {}) => {
  const sub = findSub(section, title)
  if (!sub) {
    ctx.fail(key, section.no, `missing subsection "### ${title}"`)
    return
  }
  const lines = sub.body.filter((l) => l.text.trim())
  if (!lines.length) {
    ctx.fail(key, sub.no, `"### ${title}" is empty`)
    return
  }
  let valid = 0
  for (const line of lines) {
    const { cites, errors } = findProseCitations(line.text)
    valid += cites.length
    for (const e of errors) ctx.fail(key, line.no, e)
  }
  if (cited && !valid) ctx.fail(key, sub.no, `"### ${title}" needs >= 1 citation`)
}

const parseNumber = (s) => (/^(0x[0-9a-f]+|\d+)$/i.test(s) ? Number(s) : null)

// ---- section rules ----------------------------------------------------------

const checkFraming = (ctx, section) => {
  const key = 'framing'
  const text = section.body.map((l) => l.text).join('\n').toLowerCase()
  for (const word of ['checksum', 'transaction']) {
    if (!text.includes(word)) ctx.fail(key, section.no, `section must mention "${word}"`)
  }
  const table = requireTable(ctx, key, section, HEADERS.framing)
  if (!table) return
  const spans = []
  for (const { no, c } of table.rows) {
    const label = `offset ${c.Offset || '(empty)'}`
    checkSource(ctx, key, no, c.Source, label)
    checkConfidence(ctx, key, no, c.Confidence, label)
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(c.Offset)
    const from = m ? Number(m[1]) : -1
    const to = m && m[2] !== undefined ? Number(m[2]) : from
    if (!m || to < from || to >= PACKET_SIZE) {
      ctx.fail(key, no, `${label}: Offset must be N or N-M within 0..${PACKET_SIZE - 1}`)
      continue
    }
    spans.push({ from, to, no })
  }
  spans.sort((a, b) => a.from - b.from)
  let next = 0
  for (const s of spans) {
    if (s.from > next) ctx.fail(key, s.no, `bytes ${next}-${s.from - 1} not covered (gap)`)
    else if (s.from < next) ctx.fail(key, s.no, `bytes ${s.from}-${Math.min(s.to, next - 1)} overlap an earlier row`)
    next = Math.max(next, s.to + 1)
  }
  if (next < PACKET_SIZE) ctx.fail(key, table.no, `bytes ${next}-${PACKET_SIZE - 1} not covered (gap)`)
}

const checkStatus = (ctx, section) => {
  const key = 'status'
  const table = requireTable(ctx, key, section, HEADERS.status, { sub: 'Status codes' })
  if (table) {
    const seen = new Set()
    for (const { no, c } of table.rows) {
      const label = `code ${c.Code || '(empty)'}`
      checkSource(ctx, key, no, c.Source, label)
      checkConfidence(ctx, key, no, c.Confidence, label)
      if (HEX_BYTE.test(c.Code)) seen.add(Number(c.Code))
      else ctx.fail(key, no, `${label}: Code must be lower-case 0xNN`)
    }
    for (let code = 0; code <= 5; code++) {
      if (!seen.has(code)) ctx.fail(key, table.no, `missing status code ${hx(code)}`)
    }
  }
  checkSub(ctx, key, section, 'Transaction ID', { cited: true })
  checkSub(ctx, key, section, 'Request cycle', { cited: true })
}

const STATUS_LINE = /^02A7 status: \[(UNVERIFIED|CONFIRMED)\]/

const checkControl = (ctx, section) => {
  const key = 'control'
  const claims = requireTable(ctx, key, section, HEADERS.claims, { minRows: 5 })
  for (const { no, c } of claims?.rows ?? []) {
    const label = `claim "${short(c.Claim)}"`
    checkSource(ctx, key, no, c.Source, label)
    checkConfidence(ctx, key, no, c.Confidence, label)
  }
  checkSub(ctx, key, section, 'Interfaces on macOS')
  const ifaces = requireTable(ctx, key, section, HEADERS.interfaces, { sub: 'Interfaces on macOS' })
  if (ifaces) {
    const seen = new Set()
    for (const { no, c } of ifaces.rows) {
      const label = `interface ${c.Interface || '(empty)'}`
      checkSource(ctx, key, no, c.Source, label)
      if (/^\d+$/.test(c.Interface)) seen.add(Number(c.Interface))
      else ctx.fail(key, no, `${label}: Interface must be a number`)
    }
    for (let n = 0; n <= 5; n++) {
      if (!seen.has(n)) ctx.fail(key, ifaces.no, `missing row for interface ${n}`)
    }
  }
  for (const title of ['Protected collections', 'Transport options', 'Open questions']) checkSub(ctx, key, section, title)
  if (!section.body.some((l) => !l.fenced && STATUS_LINE.test(l.text))) {
    ctx.fail(key, section.no, 'missing line "02A7 status: [UNVERIFIED]" (or [CONFIRMED])')
  }
}

const checkLampArray = (ctx, section) => {
  const key = 'lamparray'
  const table = requireTable(ctx, key, section, HEADERS.lamparray, { minRows: 6 })
  if (!table) return
  const seen = new Set()
  for (const { no, c } of table.rows) {
    const label = `report ${c.Report || '(empty)'}`
    checkSource(ctx, key, no, c.Source, label)
    checkConfidence(ctx, key, no, c.Confidence, label)
    const id = parseNumber(c.ID)
    if (id === null) ctx.fail(key, no, `${label}: ID must be a number`)
    else seen.add(id)
  }
  for (let id = 1; id <= 6; id++) {
    if (!seen.has(id)) ctx.fail(key, table.no, `missing LampArray report id ${id}`)
  }
}

// (Class:ID) -> row of the first Commands table, without reporting; golden uses it.
const commandIndex = (section) => {
  const table = section.tables.find((t) => sameHeader(t.header, HEADERS.commands))
  if (!table) return null
  const index = new Map()
  for (const row of rowsOf(table, HEADERS.commands)) {
    const id = `${row.c.Class}:${row.c.ID}`
    if (!index.has(id)) index.set(id, row)
  }
  return index
}

const GAP = /^- ([a-z-]+): (.+?) — (.+)$/
const DIAGNOSTICS = /^Diagnostics reads: (.*)$/

// The allowlisted "### Reply layouts" table: each Source cell non-empty and grammatical.
const checkReplyTable = (ctx, key, t) => {
  const src = t.header.indexOf('Source')
  for (const r of t.rows) {
    if (r.cells.length !== t.header.length) ctx.fail(key, r.no, `row has ${r.cells.length} cells, expected ${t.header.length}`)
    else checkSource(ctx, key, r.no, r.cells[src], `row "${short(r.cells[0])}" under "### ${t.sub}"`)
  }
}

const checkCommands = (ctx, section, { groups }) => {
  const key = 'commands'
  // Exactly ONE command table: duplicates of the canonical header are reported
  // by requireTable; every other table is rejected by the canonical-form lint.
  for (const t of section.tables) {
    if (sameHeader(t.header, HEADERS.reply) && t.sub === 'Reply layouts') checkReplyTable(ctx, key, t)
  }
  const table = requireTable(ctx, key, section, HEADERS.commands)
  const rows = table?.rows ?? []
  const firstSeen = new Map()
  for (const { no, c } of rows) {
    const label = `${c.Class}:${c.ID} ${short(c.Name)}`.trim()
    if (!GROUPS.includes(c.Group)) ctx.fail(key, no, `${label}: Group "${c.Group}" not one of ${GROUPS.join(', ')}`)
    for (const col of ['Class', 'ID']) {
      if (!HEX_BYTE.test(c[col])) ctx.fail(key, no, `${label}: ${col} must be lower-case 0xNN`)
    }
    if (!c.Name) ctx.fail(key, no, `${label}: Name is empty`)
    if (c.Dir !== 'read' && c.Dir !== 'write') ctx.fail(key, no, `${label}: Dir "${c.Dir}" must be read or write`)
    else if (HEX_BYTE.test(c.ID) && (c.Dir === 'read') !== (Number(c.ID) >= 0x80)) {
      ctx.fail(key, no, `${label}: Dir=${c.Dir} but ID ${c.ID} (read iff ID >= 0x80)`)
    }
    if (c.Safe !== 'yes' && c.Safe !== 'no') ctx.fail(key, no, `${label}: Safe "${c.Safe}" must be yes or no`)
    else if (c.Safe === 'yes' && (c.Dir !== 'read' || c.Confidence !== 'confirmed')) {
      ctx.fail(key, no, `${label}: Safe=yes needs Dir=read and Confidence=confirmed`)
    }
    checkConfidence(ctx, key, no, c.Confidence, label)
    checkSource(ctx, key, no, c.Source, label, { primary: true })
    const id = `${c.Class}:${c.ID}`
    if (firstSeen.has(id)) ctx.fail(key, no, `${label}: duplicate (Class,ID), first at line ${firstSeen.get(id)}`)
    else firstSeen.set(id, no)
  }

  const gapGroups = new Set()
  const gaps = findSub(section, 'Gaps')
  for (const line of gaps?.body ?? []) {
    if (!line.text.trim()) continue
    const m = GAP.exec(line.text.trim())
    if (!m) {
      ctx.fail(key, line.no, 'Gaps bullet must be "- <group>: <reason> — <citation>"')
      continue
    }
    if (!GROUPS.includes(m[1]) || m[1] === 'device-info') ctx.fail(key, line.no, `Gaps group "${m[1]}" not allowed`)
    if (checkSource(ctx, key, line.no, m[3], `Gaps ${m[1]}`).length) gapGroups.add(m[1])
  }

  for (const group of groups) {
    if (group === 'device-info') {
      for (const what of ['firmware', 'serial']) {
        const ok = rows.some(({ c }) => c.Group === group && c.Dir === 'read' && c.Confidence === 'confirmed' &&
          c.Name.toLowerCase().includes(what))
        if (!ok) ctx.fail(key, table?.no ?? section.no, `group device-info needs a confirmed ${what} read row (Gaps does not apply)`)
      }
    } else if (!rows.some(({ c }) => c.Group === group) && !gapGroups.has(group)) {
      ctx.fail(key, table?.no ?? section.no, `group ${group} has no rows and no "### Gaps" bullet`)
    }
  }

  const diag = section.body.filter((l) => !l.fenced && DIAGNOSTICS.test(l.text))
  if (!diag.length) ctx.fail(key, section.no, 'missing line "Diagnostics reads: 0xCC:0xII, ..."')
  for (const line of diag) {
    const items = DIAGNOSTICS.exec(line.text)[1].split(',').map((s) => s.trim().replace(/^`(.*)`$/, '$1')).filter(Boolean)
    if (!items.length) ctx.fail(key, line.no, 'Diagnostics reads lists no commands')
    for (const item of items) {
      if (!/^0x[0-9a-f]{2}:0x[0-9a-f]{2}$/.test(item)) ctx.fail(key, line.no, `Diagnostics item "${item}" must be 0xCC:0xII`)
      else if (!rows.some(({ c }) => `${c.Class}:${c.ID}` === item && c.Safe === 'yes')) {
        ctx.fail(key, line.no, `Diagnostics item ${item} is not a Safe=yes Commands row`)
      }
    }
  }
}

export const packetChecksum = (bytes) => {
  let sum = 0
  for (let i = 2; i < 88; i++) sum ^= bytes[i]
  return sum
}

const checkPacket = (ctx, key, no, label, bytes, commands) => {
  if (bytes.length !== PACKET_SIZE) {
    ctx.fail(key, no, `${label}: ${bytes.length} bytes, expected ${PACKET_SIZE}`)
    return
  }
  const sum = packetChecksum(bytes)
  if (bytes[88] !== sum) ctx.fail(key, no, `${label}: checksum byte 88 is ${hx(bytes[88])}, XOR of bytes 2..87 is ${hx(sum)}`)
  if (bytes[5] > MAX_DATA_SIZE) ctx.fail(key, no, `${label}: data size (byte 5) ${bytes[5]} > ${MAX_DATA_SIZE}`)
  const cmd = `${hx(bytes[6])}:${hx(bytes[7])}`
  const row = commands?.get(cmd)
  if (!commands) ctx.fail(key, no, `${label}: no Commands table to cross-check ${cmd}`)
  else if (!row) ctx.fail(key, no, `${label}: ${cmd} (bytes 6,7) is not a Commands row`)
  else if (row.c.Confidence === '[HYPOTHESIS]') ctx.fail(key, no, `${label}: ${cmd} is a [HYPOTHESIS] command`)
}

const GOLDEN_HEAD = /^G(\d+): (request|response) (\S.*)$/

const checkGolden = (ctx, section, { commands }) => {
  const key = 'golden'
  const counts = { request: 0, response: 0 }
  const ids = new Set()
  for (const sub of section.subs) {
    if (!/^G\d/.test(sub.title)) continue
    const m = GOLDEN_HEAD.exec(sub.title)
    if (!m) {
      ctx.fail(key, sub.no, 'golden heading must be "### G<n>: request|response <name>"')
      continue
    }
    const label = `G${m[1]}`
    if (ids.has(m[1])) ctx.fail(key, sub.no, `${label}: duplicate packet number`)
    ids.add(m[1])
    const [src, open] = sub.body.filter((l) => l.text.trim())
    if (!src || !src.text.startsWith('- Source: ')) {
      ctx.fail(key, sub.no, `${label}: first line must be "- Source: <citations>"`)
      continue
    }
    const cites = checkSource(ctx, key, src.no, src.text.slice('- Source: '.length), label)
    if (cites.length && cites.every((c) => c.kind === 'url')) ctx.fail(key, src.no, `${label}: url citations alone cannot source a golden packet`)
    if (!open || open.text.trim() !== '```hex') {
      ctx.fail(key, src.no, `${label}: Source line must be followed by a \`\`\`hex block`)
      continue
    }
    const after = sub.body.slice(sub.body.indexOf(open) + 1)
    const close = after.findIndex((l) => FENCE.test(l.text))
    if (close < 0) {
      ctx.fail(key, open.no, `${label}: unclosed hex block`)
      continue
    }
    const bytes = []
    let bad = false
    for (const line of after.slice(0, close)) {
      for (const tok of line.text.trim().split(/\s+/).filter(Boolean)) {
        if (/^[0-9a-fA-F]{2}$/.test(tok)) bytes.push(parseInt(tok, 16))
        else {
          ctx.fail(key, line.no, `${label}: bad hex byte "${tok}"`)
          bad = true
        }
      }
    }
    if (bad) continue
    counts[m[2]]++
    checkPacket(ctx, key, open.no, label, bytes, commands)
  }
  if (counts.request < 2) ctx.fail(key, section.no, `needs >= 2 request packets, has ${counts.request}`)
  if (counts.response < 1) ctx.fail(key, section.no, `needs >= 1 response packet, has ${counts.response}`)
}

const checkMatrix = (ctx, section) => {
  const key = 'matrix'
  const table = requireTable(ctx, key, section, HEADERS.matrix, { minRows: 10 })
  for (const { no, c } of table?.rows ?? []) {
    const label = `feature "${short(c.Feature)}"`
    if (!c.Feature) ctx.fail(key, no, `${label}: Feature is empty`)
    if (!MATRIX_VALUES.includes(c['RZ03-0498'])) ctx.fail(key, no, `${label}: RZ03-0498 "${c['RZ03-0498']}" not one of yes | no | unknown`)
    checkConfidence(ctx, key, no, c.Confidence, label)
    checkSource(ctx, key, no, c.Source, label)
  }
}

const checkSources = (ctx, section) => {
  const key = 'sources'
  const text = section.body.map((l) => l.text).join('\n')
  if (!/\]\([^)\s]*protocol-sources\.md\)/.test(text)) {
    ctx.fail(key, section.no, 'must link .ai_context/knowledge/protocol-sources.md')
  }
}

// ---- canonical form ---------------------------------------------------------
// protocol.md has ONE table form, and anything else is rejected rather than
// interpreted. Outside code fences every line holding an unescaped "|" is a
// table line: "|" in column 1 and an unescaped "|" at the end; never quoted,
// indented or in a list; no HTML tables. A table stands between blank lines,
// has its |---| row directly under the header, and its header is allowlisted
// for its section (and subsection), so no table can hide from the rules.

const TABLES = {
  framing: [[HEADERS.framing]],
  status: [[HEADERS.status, 'Status codes']],
  control: [[HEADERS.claims], [HEADERS.interfaces, 'Interfaces on macOS']],
  lamparray: [[HEADERS.lamparray]],
  commands: [[HEADERS.commands], [HEADERS.reply, 'Reply layouts']],
  golden: [],
  matrix: [[HEADERS.matrix]],
  sources: [],
}
const TABLE_LINE = /^\|.*[^\\]\|\s*$/
const HAS_PIPE = /(?:^|[^\\])\|/
const HTML_TABLE = /<\s*\/?\s*(?:table|thead|tbody|tfoot|tr|td|th)\b/i
// Start of a CommonMark HTML block (comment, processing instruction, declaration, CDATA or tag).
// Pattern adapted from rung-3 candidate r3-1.
const HTML_BLOCK = /^ {0,3}<(?:[!?]|\/?[a-zA-Z][\w-]*(?:[\s/>]|$))/
// CommonMark blank line: spaces and tabs only. String#trim() also strips NBSP and other
// Unicode spaces, which Markdown does not treat as blank (a NBSP line would glue rows on).
const isBlank = (line) => !line || /^[ \t]*$/.test(line.text)
const fmtAllowed = (list) => list.map(([h, sub]) => `${fmtHeader(h)}${sub ? ` under "### ${sub}"` : ''}`).join(' or ')

const notAllowed = (key, title, t) => {
  const what = `${fmtHeader(t.header)}${t.sub === null ? '' : ` under "### ${t.sub}"`}`
  if (!key) return `table ${what} outside a checked section — tables belong in ${Object.values(SECTIONS).map((s) => `"## ${s}"`).join(', ')}`
  if (key === 'commands') {
    const source = t.header.includes('Source') ? '' : '; a side table also needs a Source column'
    return `command-like table ${what}: ## Commands allows exactly one command table, ${fmtHeader(HEADERS.commands)}, ` +
      `plus ${fmtAllowed(TABLES.commands.slice(1))}${source} — move these rows into the command table`
  }
  const list = TABLES[key]
  if (list.length) return `table ${what} not allowed in "## ${title}" — use ${fmtAllowed(list)}`
  return `table ${what} not allowed in "## ${title}": no tables here${key === 'sources' ? ' (the source list belongs in protocol-sources.md)' : ''}`
}

const lintDoc = (ctx, { lines, sections, unclosed }, keyOf) => {
  const first = sections.length ? sections[0].no - 1 : lines.length
  const scopes = [{ key: null, title: null, tables: parseTables(lines.slice(0, first)) }]
  const tag = new Map()
  for (const s of sections) {
    const key = keyOf.get(s.title) ?? null
    scopes.push({ key, title: s.title, tables: s.tables })
    if (key) for (const no of [s.no, ...s.body.map((l) => l.no)]) tag.set(no, key)
  }
  const at = (no) => tag.get(no) ?? 'doc'
  if (unclosed) ctx.fail(at(unclosed), unclosed, 'unclosed code fence — close it with the same three marks alone on a line')
  for (const { no, text, fenced, badFence } of lines) {
    if (badFence) ctx.fail(at(no), no, 'non-canonical code fence — open with ``` or ~~~ (optionally ```lang) in column 1 and close with the same three marks alone on a line')
    if (fenced) continue
    if (HTML_BLOCK.test(text)) ctx.fail(at(no), no, 'raw HTML block (comments included) — protocol.md allows no raw HTML: it can hide lines from the checker that GitHub still renders; write Markdown instead')
    if (HTML_TABLE.test(text)) ctx.fail(at(no), no, 'raw HTML table markup — write a canonical "| a | b |" table instead')
    if (/^\s*>/.test(text) && text.includes('|')) {
      ctx.fail(at(no), no, '"|" inside a blockquote — tables may not be quoted; move the rows out of the quote as a canonical "| a | b |" table')
    } else if (!HAS_PIPE.test(text)) continue
    else if (/^\s/.test(text)) ctx.fail(at(no), no, 'indented table line — tables may not sit in lists or indented blocks; start the line with "|" in column 1')
    else if (!TABLE_LINE.test(text)) ctx.fail(at(no), no, 'stray "|" outside a canonical table line — start and end the line with "|" ("| a | b |") or escape the pipe as "\\|"')
  }
  for (const { key, title, tables } of scopes) {
    for (const t of tables) {
      const k = key ?? 'doc'
      if (!t.valid) ctx.fail(k, t.no, 'table header must be followed directly by a |---| separator row with one cell per column')
      if (!isBlank(lines[t.no - 2])) ctx.fail(k, t.no, 'table must be preceded by a blank line')
      if (!isBlank(lines[t.end])) ctx.fail(k, t.end + 1, 'table must be followed by a blank line (Markdown reads the next line as one more row)')
      const allowed = (key ? TABLES[key] : []).some(([h, sub]) => sameHeader(t.header, h) && (sub === undefined || t.sub === sub))
      if (!allowed) ctx.fail(k, t.no, notAllowed(key, title, t))
    }
  }
}

const RULES = {
  framing: checkFraming,
  status: checkStatus,
  control: checkControl,
  lamparray: checkLampArray,
  commands: checkCommands,
  golden: checkGolden,
  matrix: checkMatrix,
  sources: checkSources,
}

// Returns [{ section, line, message }] sorted by line; empty means the doc passes.
export const checkDoc = (text, { sections = SECTION_KEYS, groups = [] } = {}) => {
  const failures = []
  const ctx = { fail: (section, line, message) => failures.push({ section, line, message }) }
  const keyOf = new Map(Object.entries(SECTIONS).map(([k, title]) => [title, k]))
  const found = new Map()
  const parsed = parseDoc(text)
  for (const section of parsed.sections) {
    const key = keyOf.get(section.title)
    if (!key) continue
    if (found.has(key)) ctx.fail(key, section.no, `duplicate section "## ${section.title}"`)
    else found.set(key, section)
  }
  const commands = found.has('commands') ? commandIndex(found.get('commands')) : null
  for (const key of new Set(sections)) {
    const section = found.get(key)
    if (section) RULES[key](ctx, section, { groups, commands })
    else ctx.fail(key, 1, `${MSG.missingSection} "## ${SECTIONS[key]}"`)
  }
  if (sections.length) lintDoc(ctx, parsed, keyOf)
  return failures.sort((a, b) => a.line - b.line)
}

export const formatFailure = (doc, f) => `${doc}:${f.line}: [${f.section}] ${f.message}`

// ---- citation resolution and lock ---------------------------------------------
// Sources are data: read as bytes or text, never executed. Failure messages name
// the doc's citation and positions only; they never echo source text.

export class SourcesError extends Error {}

const SYNAPSE_WINDOW = 64
const SHA1 = /^[0-9a-f]{40}$/
const SHA256 = /^[0-9a-f]{64}$/
const sha256 = (data) => createHash('sha256').update(data).digest('hex')

const isDir = (p) => {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

// base + a "/"-separated relative path; null for absolute paths and for "", ".",
// ".." and ".git" segments, so no citation leaves its source tree.
const safeJoin = (base, rel) => {
  const parts = rel.split('/')
  return parts.some((p) => p === '' || p === '.' || p === '..' || p === '.git') ? null : join(base, ...parts)
}

const readJson = (file, what) => {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (e) {
    throw new SourcesError(`cannot read ${what} ${file}: ${e.code ?? e.message}`)
  }
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new SourcesError(`${what} ${file} is not valid JSON: ${e.message}`)
  }
}

export const readLock = (file) => {
  const lock = readJson(file, 'citation lock')
  const valid = lock && typeof lock === 'object' && !Array.isArray(lock) &&
    Object.values(lock).every((v) => typeof v === 'string' && SHA256.test(v))
  if (!valid) throw new SourcesError(`citation lock ${file} must map each citation to a sha256 hex string`)
  return lock
}

// The commit checked out in a clone, read from its .git files (git is never run).
export const readGitHead = (repo) => {
  const read = (rel) => {
    try {
      return readFileSync(join(repo, '.git', ...rel.split('/')), 'utf8').trim()
    } catch {
      return ''
    }
  }
  const head = read('HEAD')
  if (SHA1.test(head)) return head
  const ref = /^ref: (refs\/[\w./-]+)$/.exec(head)?.[1]
  if (!ref || ref.split('/').includes('..')) return null
  const loose = read(ref)
  if (loose) return SHA1.test(loose) ? loose : null
  for (const line of read('packed-refs').split('\n')) {
    const [sha, name] = line.trim().split(' ')
    if (name === ref && SHA1.test(sha)) return sha
  }
  return null
}

// Checks DIR against the manifest for the kinds to resolve. Any mismatch throws
// SourcesError (exit 2): a wrong or partial download never passes silently.
export const verifySources = (dir, manifest, kinds = RESOLVE_KINDS) => {
  if (!isDir(dir)) throw new SourcesError(`sources directory ${dir} not found`)
  const src = { dir, synapse: new Map(), lines: new Map(), cps: new Map() }
  if (kinds.includes('zexrox')) {
    const want = manifest?.zexrox?.commit
    if (typeof want !== 'string' || !SHA1.test(want) || !want.startsWith(ZEXROX_COMMIT)) {
      throw new SourcesError(`the manifest's zexrox.commit must be the full ${ZEXROX_COMMIT}... commit id`)
    }
    const repo = join(dir, 'zexrox')
    const got = readGitHead(repo)
    if (got !== want) throw new SourcesError(`${repo} is at ${got ?? '(no readable .git HEAD)'}, the manifest pins ${want}`)
  }
  if (kinds.includes('synapse')) {
    const files = Object.entries(manifest?.synapse ?? {})
    if (!files.length) throw new SourcesError('the manifest lists no synapse files')
    for (const [rel, want] of files) {
      const file = safeJoin(join(dir, 'synapse-web'), rel)
      if (!file || typeof want !== 'string' || !SHA256.test(want)) throw new SourcesError(`bad manifest synapse entry "${rel}"`)
      let data
      try {
        data = readFileSync(file)
      } catch (e) {
        throw new SourcesError(`synapse file ${file} missing (${e.code ?? e.message}); the manifest pins it`)
      }
      const got = sha256(data)
      if (got !== want) throw new SourcesError(`synapse file ${file} has sha256 ${got}, the manifest pins ${want}`)
      src.synapse.set(want, file)
    }
  }
  return src
}

// A file's lines (no trailing empty line), cached; null when it cannot be read.
const linesOf = (src, file) => {
  if (!src.lines.has(file)) {
    let lines = null
    try {
      lines = readFileSync(file, 'utf8').split(/\r\n|\r|\n/)
      if (lines.length > 1 && lines.at(-1) === '') lines.pop()
    } catch {
      // missing or unreadable: the caller reports the citation
    }
    src.lines.set(file, lines)
  }
  return src.lines.get(file)
}

// Code points of a Synapse file: offsets are Python str indices (as ctx.py prints them), not UTF-16.
const codePointsOf = (src, sha) => {
  if (!src.cps.has(sha)) src.cps.set(sha, Array.from(readFileSync(src.synapse.get(sha), 'utf8')))
  return src.cps.get(sha)
}

const span = (from, to) => (from === to ? `line ${from}` : `lines ${from}-${to}`)

const lineWindow = (lines, from, to, token, where) => {
  if (!lines) return { error: `${where} not found` }
  if (from < 1 || to > lines.length) return { error: `${span(from, to)} outside ${where} (${lines.length} lines)` }
  const window = lines.slice(from - 1, to).join('\n')
  if (!/\S/.test(window)) return { error: `${where} ${span(from, to)} is blank` }
  if (token && !window.includes(token)) return { error: `token "${token}" not in ${where} ${span(from, to)}` }
  return { window, lines }
}

const nearest = (cps, tok, offset) => {
  let best = -1
  for (let i = 0; i + tok.length <= cps.length; i++) {
    if (cps[i] !== tok[0]) continue
    let k = 1
    while (k < tok.length && cps[i + k] === tok[k]) k++
    if (k === tok.length && (best < 0 || Math.abs(i - offset) < Math.abs(best - offset))) best = i
  }
  return best < 0 ? 'the token does not occur in the file' : `nearest occurrence at ${best}`
}

// { window } (the text the lock hashes) or { error }; zexrox also returns the file's lines.
const resolveCitation = (cite, src, root) => {
  const at = (base, rel) => {
    const file = safeJoin(base, rel)
    return file ? linesOf(src, file) : null
  }
  if (cite.kind === 'zexrox') {
    return lineWindow(at(join(src.dir, 'zexrox'), cite.path), cite.from, cite.to, cite.token, `zexrox/${cite.path}`)
  }
  if (cite.kind === 'chromium') {
    return lineWindow(at(join(src.dir, 'chromium'), cite.path), cite.line, cite.line, cite.token, `chromium/${cite.path}`)
  }
  if (cite.kind === 'synapse') {
    const shas = [...src.synapse.keys()].filter((s) => s.startsWith(cite.sha))
    if (shas.length !== 1) {
      return { error: shas.length ? `sha256 prefix ${cite.sha} is ambiguous in the manifest` : `no manifest synapse file has sha256 ${cite.sha}...` }
    }
    const cps = codePointsOf(src, shas[0])
    const tok = Array.from(cite.token)
    if (cps.slice(cite.offset, cite.offset + tok.length).join('') !== cite.token) {
      return { error: `token "${cite.token}" is not at code-point offset ${cite.offset} (${nearest(cps, tok, cite.offset)})` }
    }
    return { window: cps.slice(Math.max(0, cite.offset - SYNAPSE_WINDOW), cite.offset + tok.length + SYNAPSE_WINDOW).join('') }
  }
  if (cite.kind === 'openrgb') {
    const base = join(src.dir, 'openrgb-4418')
    let names
    try {
      names = readdirSync(base).sort()
    } catch {
      return { error: `${base} not found` }
    }
    for (const name of names) {
      const hit = linesOf(src, join(base, name))?.find((l) => l.includes(cite.note))
      if (hit !== undefined) return { window: hit }
    }
    return { error: `note ${cite.note} not in ${base}` }
  }
  if (cite.kind === 'probe') {
    const hit = at(root, cite.path)?.find((l) => l.includes(cite.key))
    return hit === undefined ? { error: `"${cite.key}" not in repo file ${cite.path}` } : { window: hit }
  }
  return { error: `${cite.kind} citations do not resolve` }
}

const sectionAt = (parsed) => {
  const keyOf = new Map(Object.entries(SECTIONS).map(([k, title]) => [title, k]))
  return (no) => {
    const s = parsed.sections.findLast((x) => x.no <= no)
    return (s && keyOf.get(s.title)) ?? 'doc'
  }
}

// A Commands row whose citations are all zexrox must show its ID as 0x<id> or
// <cc>:<id> (any case) within each cited range +-2 lines.
const checkCommandIds = (parsed, zexroxLines, fail) => {
  for (const section of parsed.sections.filter((s) => s.title === SECTIONS.commands)) {
    for (const table of section.tables.filter((t) => sameHeader(t.header, HEADERS.commands))) {
      for (const { no, c } of rowsOf(table, HEADERS.commands)) {
        const { cites } = parseCitationCell(c.Source)
        if (!cites.length || !cites.every((x) => x.kind === 'zexrox')) continue
        if (!HEX_BYTE.test(c.Class) || !HEX_BYTE.test(c.ID)) continue
        const cc = c.Class.slice(2)
        const id = c.ID.slice(2)
        const re = new RegExp(`(?<![0-9a-f])(?:0x${id}|${cc}:${id})(?![0-9a-f])`, 'i')
        for (const cite of cites) {
          const lines = zexroxLines.get(cite.text)
          if (!lines) continue
          const from = Math.max(1, cite.from - 2)
          const to = Math.min(lines.length, cite.to + 2)
          if (!re.test(lines.slice(from - 1, to).join('\n'))) {
            fail('commands', no, `${MSG.citationNotFound}: ${cite.text} — command ${c.Class}:${c.ID} (0x${id} or ${cc}:${id}) not within lines ${from}-${to}`)
          }
        }
      }
    }
  }
}

// Resolves the doc's citations (outside code fences) and checks them against a lock.
// Options: sources (DIR or null), manifest (object), kinds (to resolve), lock
// ({ citation: sha256 } or null), root (base of probe paths). Throws SourcesError
// when DIR does not match the manifest. Returns { failures, hashes, cited } with
// hashes: citation -> sha256 of its resolved window.
export const checkCitations = (text, { sources = null, manifest = null, kinds = RESOLVE_KINDS, lock = null, root = '.' } = {}) => {
  const parsed = parseDoc(text)
  const at = sectionAt(parsed)
  const failures = []
  const fail = (section, line, message) => failures.push({ section, line, message })
  const cited = new Map()
  for (const { no, text: line, fenced } of parsed.lines) {
    if (fenced) continue
    for (const cite of findProseCitations(line).cites) if (!cited.has(cite.text)) cited.set(cite.text, { cite, no })
  }
  const src = sources === null ? null : verifySources(sources, manifest, kinds)
  const hashes = new Map()
  const zexroxLines = new Map()
  if (src) {
    for (const [key, { cite, no }] of cited) {
      if (!kinds.includes(cite.kind)) continue
      const r = resolveCitation(cite, src, root)
      if (r.error) {
        fail(at(no), no, `${MSG.citationNotFound}: ${key} — ${r.error}`)
        continue
      }
      hashes.set(key, sha256(r.window))
      if (cite.kind === 'zexrox') zexroxLines.set(key, r.lines)
    }
    if (kinds.includes('zexrox')) checkCommandIds(parsed, zexroxLines, fail)
  }
  if (lock) {
    for (const [key, { cite, no }] of cited) {
      if (!RESOLVE_KINDS.includes(cite.kind)) continue
      const resolvedNow = src !== null && kinds.includes(cite.kind)
      if (!Object.hasOwn(lock, key)) {
        if (!resolvedNow || hashes.has(key)) fail('lock', no, `${MSG.notInLock}: ${key} — resolve it with --sources=DIR --write-lock`)
      } else if (hashes.has(key) && hashes.get(key) !== lock[key]) {
        fail('lock', no, `${MSG.lockMismatch}: ${key} — the cited source text no longer matches the lock; re-check the citation, then --write-lock`)
      }
    }
    for (const key of Object.keys(lock)) {
      const entry = cited.get(key)
      if (!entry || !RESOLVE_KINDS.includes(entry.cite.kind)) fail('lock', 1, `${MSG.staleLock}: ${key} is not cited in the doc — regenerate with --write-lock`)
    }
  }
  return { failures, hashes, cited: cited.size }
}

// ---- CLI --------------------------------------------------------------------

export class UsageError extends Error {}

const parseList = (value, valid, all, noun) => {
  if (value === 'all') return [...all]
  if (value === 'none') return []
  const items = value.split(',').map((s) => s.trim())
  for (const item of items) {
    if (!valid.includes(item)) throw new UsageError(`unknown ${noun} "${item}" (valid: ${valid.join(', ')}, all, none)`)
  }
  return items
}

const isDefaultDoc = (doc) => resolve(doc) === resolve(DEFAULT_DOC)
const valueOf = (name, v) => {
  if (!v) throw new UsageError(`--${name} needs a value`)
  return v
}

export const parseArgs = (argv) => {
  const opts = {
    doc: DEFAULT_DOC, sections: [...SECTION_KEYS], groups: [], help: false,
    sources: null, only: [...RESOLVE_KINDS], manifest: DEFAULT_MANIFEST, lock: null, writeLock: false,
  }
  let docSeen = false
  let onlySeen = false
  for (const arg of argv) {
    const m = /^--([a-z-]+)=(.*)$/.exec(arg)
    if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--write-lock') opts.writeLock = true
    else if (m?.[1] === 'require') opts.sections = parseList(m[2], SECTION_KEYS, SECTION_KEYS, 'section key')
    else if (m?.[1] === 'groups') opts.groups = parseList(m[2], GROUPS, GROUPS.filter((g) => g !== 'other'), 'group')
    else if (m?.[1] === 'sources') opts.sources = valueOf('sources', m[2])
    else if (m?.[1] === 'only') {
      opts.only = parseList(m[2], RESOLVE_KINDS, RESOLVE_KINDS, 'source kind')
      onlySeen = true
    } else if (m?.[1] === 'manifest') opts.manifest = valueOf('manifest', m[2])
    else if (m?.[1] === 'lock') opts.lock = valueOf('lock', m[2])
    else if (arg.startsWith('-')) throw new UsageError(`unknown option ${arg}`)
    else if (docSeen) throw new UsageError(`unexpected argument ${arg} (one DOC only)`)
    else {
      opts.doc = arg
      docSeen = true
    }
  }
  if (onlySeen && opts.sources === null) throw new UsageError('--only needs --sources=DIR')
  if (opts.writeLock) {
    if (opts.sources === null) throw new UsageError('--write-lock needs --sources=DIR')
    if (onlySeen) throw new UsageError('--write-lock resolves every kind; drop --only')
    if (opts.lock === null && !isDefaultDoc(opts.doc)) throw new UsageError('--write-lock for a DOC other than the default needs --lock=FILE')
  }
  return opts
}

const sortedObject = (map) => Object.fromEntries([...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

export const main = (argv, { stdout = process.stdout, stderr = process.stderr } = {}) => {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (e) {
    if (!(e instanceof UsageError)) throw e
    stderr.write(`check-protocol-doc: ${e.message}\n${USAGE}\n`)
    return 2
  }
  if (opts.help) {
    stdout.write(`${USAGE}\n`)
    return 0
  }
  let text
  try {
    text = readFileSync(opts.doc, 'utf8')
  } catch (e) {
    stderr.write(`check-protocol-doc: cannot read ${opts.doc}: ${e.code ?? e.message}\n`)
    return 2
  }
  const failures = checkDoc(text, opts)
  const lockFile = opts.lock ?? (isDefaultDoc(opts.doc) ? DEFAULT_LOCK : null)
  let note = ''
  if (opts.sources !== null || lockFile) {
    try {
      const manifest = opts.sources === null ? null : readJson(opts.manifest, 'sources manifest')
      const lock = lockFile && !opts.writeLock ? readLock(lockFile) : null
      const r = checkCitations(text, { sources: opts.sources, manifest, kinds: opts.only, lock })
      failures.push(...r.failures)
      if (opts.sources !== null) note += `; ${r.hashes.size} citation(s) resolved against ${opts.sources} (${opts.only.join(',') || 'none'})`
      if (lock) note += `; ${r.cited} citation(s) checked against ${lockFile}`
      if (opts.writeLock && !failures.length) {
        try {
          writeFileSync(lockFile, `${JSON.stringify(sortedObject(r.hashes), null, 2)}\n`)
        } catch (e) {
          throw new SourcesError(`cannot write ${lockFile}: ${e.code ?? e.message}`)
        }
        note += `; wrote ${r.hashes.size} entr${r.hashes.size === 1 ? 'y' : 'ies'} to ${lockFile}`
      }
    } catch (e) {
      if (!(e instanceof SourcesError)) throw e
      stderr.write(`check-protocol-doc: ${e.message}\n`)
      return 2
    }
  }
  failures.sort((a, b) => a.line - b.line)
  for (const f of failures) stderr.write(`${formatFailure(opts.doc, f)}\n`)
  if (failures.length) {
    stderr.write(`check-protocol-doc: ${failures.length} failure(s) in ${opts.doc}\n`)
    return 1
  }
  stdout.write(`check-protocol-doc: ok ${opts.doc} [${opts.sections.join(',') || 'none'}]${note}\n`)
  return 0
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2))
