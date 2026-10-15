import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_DOC, DEFAULT_LOCK, SourcesError, checkCitations, parseCitation, readGitHead, verifySources,
} from './check-protocol-doc.mjs'

// Fake source trees in temp dirs (CI-runnable). All text below is test data,
// not protocol claims and not taken from any real source.
const SCRIPT = fileURLToPath(new URL('./check-protocol-doc.mjs', import.meta.url))
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
const cli = (args, cwd) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd })
const sha256 = (s) => createHash('sha256').update(s).digest('hex')

const COMMIT = `840f03dc${'0'.repeat(32)}`
const HOST = `${[
  '# fake module',
  'IDS = [0x81, 0x82]',
  '',
  'def packet_checksum(packet):',
  '    return 0',
  'A = 1',
  'B = 0X85',
  'C = "00:84"',
].join('\n')}\n`
// A non-BMP character before the token: its code-point offset is one less than its UTF-16 offset.
const BUNDLE = 'var a="\u{1F600}";function _calculateChecksum(e){return e}'
const OFFSET = Array.from(BUNDLE.slice(0, BUNDLE.indexOf('_calculateChecksum'))).length
const SHA = sha256(BUNDLE)
const SYN = `synapse:${SHA.slice(0, 8)}@${OFFSET}#_calculateChecksum`
const Z = (lines, token) => `zexrox:native/host.py:${lines}@840f03dc${token ? `#${token}` : ''}`

const put = (file, text) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}
const withTree = (t) => {
  const root = mkdtempSync(join(tmpdir(), 'protocol-sources-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const dir = join(root, 'sources')
  put(join(dir, 'zexrox/.git/HEAD'), 'ref: refs/heads/main\n')
  put(join(dir, 'zexrox/.git/refs/heads/main'), `${COMMIT}\n`)
  put(join(dir, 'zexrox/native/host.py'), HOST)
  put(join(dir, 'synapse-web/p/main.js'), BUNDLE)
  const manifest = { zexrox: { commit: COMMIT }, synapse: { 'p/main.js': SHA } }
  put(join(root, 'manifest.json'), JSON.stringify(manifest))
  return { root, dir, manifest, manifestFile: join(root, 'manifest.json') }
}

const CMD = ['| Group | Class | ID | Name | Dir | Size | Safe | Confidence | Source | Notes |', `|${'---|'.repeat(10)}`]
const row = (source, id = '0x81') => `| device-info | 0x00 | ${id} | Fixture read | read | 2 | no | likely | ${source} | t |`
const doc = (rows, prose = '') => `# T\n\n## Commands\n\n${[...CMD, ...rows].join('\n')}\n\n${prose}\n`
const resolveIn = (s, text, opts = {}) => checkCitations(text, { sources: s.dir, manifest: s.manifest, ...opts })
const messages = (r) => r.failures.map((f) => `[${f.section}] ${f.message}`)
const passes = (r) => assert.deepEqual(messages(r), [])
const fails = (r, re) => assert.ok(messages(r).some((m) => re.test(m)), `expected ${re} in:\n${messages(r).join('\n') || '(none)'}`)

test('parseCitation returns the fields resolution needs', () => {
  const p = (text, fields) => assert.deepEqual(parseCitation(text), { text, ...fields })
  p('zexrox:native/host.py:10-20@840f03dc#packet_checksum', { kind: 'zexrox', path: 'native/host.py', from: 10, to: 20, token: 'packet_checksum' })
  p('zexrox:native/host.py:22@840f03dc', { kind: 'zexrox', path: 'native/host.py', from: 22, to: 22, token: null })
  p('synapse:c1e6a425@430900#_calculateChecksum', { kind: 'synapse', sha: 'c1e6a425', offset: 430900, token: '_calculateChecksum' })
  p('chromium:a/b.cc:5@0123abcd#Foo', { kind: 'chromium', path: 'a/b.cc', line: 5, commit: '0123abcd', token: 'Foo' })
  p('openrgb#4418:abc-1', { kind: 'openrgb', note: 'abc-1' })
  p('probe:a/b.txt#IOUSBHostInterface@3', { kind: 'probe', path: 'a/b.txt', key: 'IOUSBHostInterface@3' })
  p('url:https://example.com/x', { kind: 'url', url: 'https://example.com/x' })
})

test('zexrox: the file, line range and token must resolve', (t) => {
  const s = withTree(t)
  passes(resolveIn(s, doc([row(Z(2))], `Also ${Z('4-5', 'packet_checksum')}.`)))
  fails(resolveIn(s, doc([], `See ${Z(9)}.`)), /\[commands\] citation not found: .*:9@840f03dc — line 9 outside zexrox\/native\/host\.py \(8 lines\)/)
  fails(resolveIn(s, doc([], `See ${Z(3)}.`)), /citation not found: .* line 3 is blank/)
  fails(resolveIn(s, doc([], `See ${Z(4, 'nope')}.`)), /citation not found: .* token "nope" not in zexrox\/native\/host\.py line 4/)
  fails(resolveIn(s, doc([], 'See zexrox:native/missing.py:1@840f03dc.')), /citation not found: .* zexrox\/native\/missing\.py not found/)
  fails(resolveIn(s, doc([], 'See zexrox:../synapse-web/p/main.js:1@840f03dc.')), /citation not found/)
  fails(resolveIn(s, doc([], 'See zexrox:.git/HEAD:1@840f03dc.')), /citation not found/)
})

test('zexrox: an all-zexrox Commands row needs its ID within the cited lines +-2', (t) => {
  const s = withTree(t)
  passes(resolveIn(s, doc([row(Z(4))])))
  fails(resolveIn(s, doc([row(Z(5))])), /\[commands\] citation not found: zexrox:native\/host\.py:5@840f03dc — command 0x00:0x81 \(0x81 or 00:81\) not within lines 3-7/)
  fails(resolveIn(s, doc([row(Z(4), '0x83')])), /command 0x00:0x83 /)
  passes(resolveIn(s, doc([row(Z(7), '0x85')])))
  passes(resolveIn(s, doc([row(Z(8), '0x84')])))
  passes(resolveIn(s, doc([row(`${Z(5)}; ${SYN}`)])))
  passes(resolveIn(s, doc([row(Z(5))]), { kinds: ['synapse'] }))
})

test('synapse: the token must sit at its exact code-point offset', (t) => {
  const s = withTree(t)
  passes(resolveIn(s, doc([], `See ${SYN}.`)))
  const utf16 = `synapse:${SHA.slice(0, 8)}@${OFFSET + 1}#_calculateChecksum`
  fails(resolveIn(s, doc([], `See ${utf16}.`)),
    new RegExp(`citation not found: ${utf16} — token "_calculateChecksum" is not at code-point offset ${OFFSET + 1} \\(nearest occurrence at ${OFFSET}\\)`))
  fails(resolveIn(s, doc([], 'See synapse:00000000@1#var.')), /no manifest synapse file has sha256 00000000/)
  fails(resolveIn(s, doc([], `See synapse:${SHA.slice(0, 8)}@0#nothere.`)), /the token does not occur in the file/)
})

test('sources directory: missing or not matching the manifest throws (exit 2)', (t) => {
  const s = withTree(t)
  assert.throws(() => verifySources(join(s.root, 'nope'), s.manifest), SourcesError)
  assert.equal(readGitHead(join(s.dir, 'zexrox')), COMMIT)
  rmSync(join(s.dir, 'zexrox/.git/refs/heads/main'))
  put(join(s.dir, 'zexrox/.git/packed-refs'), `# pack-refs with: peeled\n${COMMIT} refs/heads/main\n`)
  assert.equal(readGitHead(join(s.dir, 'zexrox')), COMMIT)
  put(join(s.dir, 'zexrox/.git/HEAD'), `${COMMIT}\n`)
  assert.equal(readGitHead(join(s.dir, 'zexrox')), COMMIT)
  verifySources(s.dir, s.manifest)
  assert.throws(() => verifySources(s.dir, { ...s.manifest, zexrox: { commit: `840f03dc${'1'.repeat(32)}` } }), /the manifest pins 840f03dc1/)
  assert.throws(() => verifySources(s.dir, { ...s.manifest, zexrox: { commit: 'f'.repeat(40) } }), SourcesError)
  put(join(s.dir, 'synapse-web/p/main.js'), `${BUNDLE} `)
  assert.throws(() => verifySources(s.dir, s.manifest), /synapse file .* has sha256 /)
  verifySources(s.dir, s.manifest, ['zexrox'])
  rmSync(join(s.dir, 'synapse-web'), { recursive: true })
  assert.throws(() => verifySources(s.dir, s.manifest), /synapse file .* missing/)
  verifySources(s.dir, s.manifest, ['zexrox'])
})

test('lock: every citation locked, none stale, resolved hashes match', (t) => {
  const s = withTree(t)
  const text = doc([row(Z(2))], `See ${SYN} and url:https://example.com/x.`)
  const { hashes } = resolveIn(s, text)
  assert.deepEqual([...hashes.keys()].sort(), [SYN, Z(2)].sort())
  const lock = Object.fromEntries(hashes)
  passes(checkCitations(text, { lock }))
  passes(resolveIn(s, text, { lock }))
  passes(resolveIn(s, text, { lock, kinds: ['zexrox'] }))
  fails(checkCitations(text, { lock: { [Z(2)]: lock[Z(2)] } }), /\[lock\] citation not in lock: synapse:/)
  fails(checkCitations(text, { lock: { ...lock, [Z(4)]: lock[Z(2)] } }), /\[lock\] stale lock entry: zexrox:native\/host\.py:4@840f03dc /)
  put(join(s.dir, 'zexrox/native/host.py'), HOST.replace('0x82', '0x83'))
  fails(resolveIn(s, text, { lock }), /\[lock\] citation changed since lock: zexrox:native\/host\.py:2@840f03dc /)
  passes(checkCitations(text, { lock }))
})

test('CLI: --sources exit codes, --write-lock round trip, the default doc uses the lock', (t) => {
  const s = withTree(t)
  const docFile = join(s.root, 'doc.md')
  const lockFile = join(s.root, 'lock.json')
  put(docFile, doc([row(Z(2))], `See ${SYN}.`))
  const src = [`--sources=${s.dir}`, `--manifest=${s.manifestFile}`]
  assert.equal(cli(['--require=none', '--sources=/nonexistent/dir', `--manifest=${s.manifestFile}`, docFile]).status, 2)
  assert.equal(cli(['--require=none', '--write-lock', docFile]).status, 2)
  assert.equal(cli(['--require=none', ...src, '--write-lock', docFile]).status, 2)
  assert.equal(cli(['--require=none', '--only=zexrox', docFile]).status, 2)
  let r = cli(['--require=none', ...src, `--lock=${lockFile}`, '--write-lock', docFile])
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(lockFile, 'utf8'))), [SYN, Z(2)].sort())
  r = cli(['--require=none', `--lock=${lockFile}`, docFile])
  assert.equal(r.status, 0, r.stderr)
  r = cli(['--require=none', ...src, '--only=zexrox', `--lock=${lockFile}`, docFile])
  assert.equal(r.status, 0, r.stderr)
  put(docFile, doc([row(Z(5))], `See ${SYN}.`))
  r = cli(['--require=none', ...src, docFile])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /doc\.md:\d+: \[commands\] citation not found: .*:5@840f03dc — command 0x00:0x81/)
  const repo = join(s.root, 'repo')
  put(join(repo, DEFAULT_DOC), doc([row(Z(2))]))
  assert.equal(cli(['--require=none'], repo).status, 2)
  put(join(repo, DEFAULT_LOCK), '{}\n')
  r = cli(['--require=none'], repo)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /\[lock\] citation not in lock: zexrox:native\/host\.py:2@840f03dc/)
  r = cli(['--require=none', ...src, '--write-lock'], repo)
  assert.equal(r.status, 0, r.stderr)
  r = cli(['--require=none'], repo)
  assert.equal(r.status, 0, r.stderr)
})

test('fixtures bad-anchor and bad-zexrox-line pass the lint; only resolution fails them', () => {
  for (const name of ['bad-anchor.md', 'bad-zexrox-line.md']) {
    const r = cli(['--require=commands,golden', '--groups=all', fixture(name)])
    assert.equal(r.status, 0, `${name}: ${r.stderr}`)
  }
})
