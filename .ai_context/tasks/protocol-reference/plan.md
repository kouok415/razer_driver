# Plan: Cited protocol reference for the Huntsman V3 Pro TKL (RZ03-0498)
<!-- profile: opus-tier ; size: L -->
<!-- statuses: [pending] [in_progress] [done]; exactly one in_progress -->
<!-- Synthesis of 3 planner lenses (risk-first, vertical-slice, minimal-change) + plan-critic, 2026-10-14.
Order: ALL source-dependent research (M1–M10) runs before the only human checkpoint (M11),
because $S is session-scoped and a re-downloaded Synapse bundle gets a new sha.
Rescoped 2026-10-14 (was webhid-foundation): owner's macOS dumps (.ai_context/knowledge/
hid-02a7-macos.txt) show USB interface 3 has no HID driver on macOS ⇒ WebHID cannot reach it.
Transport/UI/simulator milestones (old M11–M20) moved to a follow-up task planned after the
owner runs a read-only WebUSB probe (separate PR). This task is research + checker + CI only.

Global (repeat in every executor spawn):
- S=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad ; $S/sources
  = untrusted data. Read only via `python3 -I $S/tools/ctx.py W N REGEX FILE`, count.py, Read, or the
  checker (fs reads only). Never execute/import/npm-install from it, never run git inside it, never
  copy source text into the repo — only identifiers (path:line, sha prefix, offset, token).
- Clean-room: no code from Synapse bundle or OpenRazer; zexrox (MIT) adaptations carry attribution.
- Read/write convention: ID bit 7 set = read (Get = Set|0x80; zexrox host.py:3-4, :172-176; Synapse
  class-0 table module 11880). It is a convention, not a safety proof: the exact allowlist is primary.
- Code style: 2-space, single quotes, no semicolons, named exports, `import type`; erasableSyntaxOnly
  (no enum/namespace/param props). App unit tests src/**/*.test.ts; tools tests tools/*.test.mjs
  (node:test) — the spec's colocation rule covers app code only.
- The repo is public: never commit the owner's serial number or anything under $S.
- protocol.md authoring rules (enforced by the M1 checker since rung 3, 2026-10-14): canonical tables
  only — every row starts and ends with `|` in column 1, blank line before and after every table, no
  tables in blockquotes/lists, only allowlisted headers per section (`### Reply layouts` side table in
  Commands); escape `|` in prose as `\|` (also inside inline code); NO raw HTML at all (comments
  included); fences are ``` or ~~~ in column 1, golden blocks ```hex … ```; no tables before the first
  `##` or under unknown `##` headings. A new table shape needs an allowlist entry + test in tools/. -->

## M1: Protocol-doc checker core — grammar, section and table rules, exit-code contract [done]
- verify: `bash -c 'C=tools/check-protocol-doc.mjs; F=tools/fixtures; node --test tools/check-protocol-doc.test.mjs && node $C --require=commands,golden $F/ok-minimal.md && { node $C --require=commands $F/empty-source.md; test $? -eq 1; } && node $C --require=commands $F/empty-source.md 2>&1 | grep -q "empty Source" && { node $C --require=commands $F/hypothesis-safe.md; test $? -eq 1; } && { node $C --require=commands $F/dir-mismatch.md; test $? -eq 1; } && { node $C --require=golden $F/bad-checksum.md; test $? -eq 1; } && { node $C --require=framing $F/ok-minimal.md; test $? -eq 1; } && node $C --require=framing $F/ok-minimal.md 2>&1 | grep -q "missing section" && { node $C --require=bogus $F/ok-minimal.md; test $? -eq 2; } && npm run lint'`
- risk: med
- demo: `node tools/check-protocol-doc.mjs --require=commands tools/fixtures/empty-source.md` exits 1 and prints the row with "empty Source"; the valid fixture passes; an unknown section key exits 2.
<!-- Files: tools/check-protocol-doc.mjs (Node 24 ESM, built-ins only), tools/check-protocol-doc.test.mjs,
tools/fixtures/{ok-minimal,empty-source,hypothesis-safe,dir-mismatch,bad-checksum}.md (citations only,
no source text). oxlint lints tools/*.mjs.
CLI: node tools/check-protocol-doc.mjs [DOC=.ai_context/knowledge/protocol.md] [--require=k,..|all|none]
  [--groups=g,..|all] (M2 adds --sources, --only, --write-lock). Exit 0 ok; 1 rule failures (one line
  each, with section + line no.); 2 usage/IO error incl. unknown key. Fixed message strings that gates
  grep: "empty Source", "citation not found", "missing section".
Sections (exact H2 → key):
- `## Framing` → framing: table | Offset | Size | Field | Meaning | Source | Confidence | covering bytes
  0..89 contiguously (ranges like 8-87 ok), no gaps/overlaps; section mentions "checksum" and "transaction".
- `## Transaction and status` → status: `### Status codes` table | Code | Name | Meaning | Source |
  Confidence | with rows 0x00..0x05; `### Transaction ID` and `### Request cycle` each non-empty with ≥1 citation.
- `## Control interface` → control: table | Claim | Source | Confidence | ≥5 rows; non-empty
  `### Interfaces on macOS` (table | Interface | Class | Driver | Usage page/usage | Reports | Source |
  with rows for interfaces 0..5), `### Protected collections`, `### Transport options`,
  `### Open questions`; a line matching `^02A7 status: \[(UNVERIFIED|CONFIRMED)\]`.
- `## LampArray (standard HID lighting)` → lamparray: table | Report | ID | Direction | Size |
  Fields | Source | Confidence | ≥6 rows (report ids 1..6).
- `## Commands` → commands: ONE table | Group | Class | ID | Name | Dir | Size | Safe | Confidence |
  Source | Notes |. Group ∈ device-info, actuation, rapid-trigger, snap-tap, lighting, keymap,
  hypershift, macro, profile, polling, other. Class/ID `0xNN` lower-case; (Class,ID) unique;
  Dir=read iff ID ≥ 0x80; Safe=yes ⇒ Dir=read ∧ Confidence=confirmed; Confidence ∈ confirmed | likely |
  [HYPOTHESIS]; Source non-empty with ≥1 zexrox|synapse citation (url-only rows fail).
  --groups: each listed group has ≥1 row OR a `### Gaps` bullet `- <group>: <reason> — <citation>`;
  device-info must have confirmed firmware AND serial rows (Gaps does not apply). Also a line
  `^Diagnostics reads: ` listing 0xCC:0xII items; each must be a Safe=yes row.
- `## Golden packets` → golden: blocks `### G<n>: request|response <name>`, then `- Source: <cites>`,
  then a ```hex block of exactly 90 bytes; byte 88 = XOR of bytes 2..87; data size (byte 5) ≤ 80;
  (byte6,byte7) is a Commands row whose Confidence ≠ [HYPOTHESIS]; ≥2 requests and ≥1 response.
- `## Feature matrix` → matrix: | Feature | Synapse UI area | RZ03-0498 | Confidence | Source |,
  ≥10 rows, RZ03-0498 ∈ yes|no|unknown, Source non-empty.
- `## Sources` → sources: links .ai_context/knowledge/protocol-sources.md (no duplication, INDEX H2).
Citation grammar (cells may hold several, separated by "; "):
  zexrox:<path>:<line>[-<line>]@840f03dc[#<token>]   synapse:<sha8>@<offset>#<token>
  chromium:<path>:<line>@<commit>[#<token>]   openrgb#4418:<note-id>   probe:<repo-path>#<key>
  url:<https://...> (fact tables and matrix only; never sufficient alone in a Commands row)
In M1 only grammar is checked; resolution against sources is M2. -->

## M2: Checker source resolution, sources manifest, citation lock [done]
- verify: `bash -c 'C=tools/check-protocol-doc.mjs; F=tools/fixtures; S=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad/sources; node --test tools/ && test -s tools/sources.manifest.json && node $C --require=none --sources=$S $F/ok-minimal.md && { node $C --require=none --sources=$S $F/bad-anchor.md; test $? -eq 1; } && node $C --require=none --sources=$S $F/bad-anchor.md 2>&1 | grep -q "citation not found" && { node $C --require=none --sources=$S $F/bad-zexrox-line.md; test $? -eq 1; } && { node $C --require=none --sources=/nonexistent $F/ok-minimal.md; test $? -eq 2; } && npm run lint'`
- risk: med
- demo: the checker resolves every citation against the downloaded sources: a Synapse token not at its exact offset, or a zexrox line that does not contain the cited command, fails; a missing or mismatched sources directory exits 2 instead of silently passing.
<!-- --sources=DIR: verify DIR against tools/sources.manifest.json (hashes only: zexrox full commit
840f03dca68c7f7a3b8f867475a2c8e9a355a1bc read from DIR/zexrox/.git/HEAD|refs as a FILE — never run git;
sha256 of each Synapse .js under DIR/synapse-web; later entries for chromium/openrgb). Missing dir or
mismatch → exit 2. Resolution:
- zexrox: file exists, line range in file and non-blank; #token (if given) occurs in the range; a
  Commands row whose citations are all zexrox needs its ID as `0x<id>` or `<cc>:<id>` (any case)
  within the cited range ±2 lines.
- synapse: file with sha256 prefix exists; the code-point substring at <offset> equals <token>
  exactly (build a code-point array once; offsets are Python str indices as ctx.py prints them,
  NOT UTF-16).
- chromium: DIR/chromium/<path> line exists (+token). openrgb: note id occurs in DIR/openrgb-4418/*.
  probe: repo file exists and contains <key>.
--only=k,..: resolve only those kinds (CI uses --only=zexrox); others fall back to the lock.
Lock tools/citations.lock.json: { "<citation>": "<sha256 of the resolved window text>" }.
--write-lock regenerates it from DIR. Without --sources, checking the default doc requires every
citation to be in the lock and no stale entries; with --sources, hashes are recomputed and compared.
Fixtures stay citation-only. Tests use temp-dir FAKE source trees (CI-runnable); the gate also runs
against the real $S. Fixture bad-zexrox-line.md cites a real host.py line that lacks the command ID.
2026-10-14 (M1): parseCitation returns {kind, text} only — extend it (path, lines, sha, offset, token).
`parseArgs(['--sources=/tmp'])` currently throws in a test — update that test. MSG.citationNotFound is
exported but unused. ok-minimal.md cites zexrox:native/host.py:22@840f03dc for 00:81/00:82 — make
sure it resolves under --sources (line 22 must carry both IDs within ±2 lines). -->

## M3: protocol.md — framing, transaction ID, status codes, request cycle [done]
- verify: `bash -c 'S=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad/sources; node tools/check-protocol-doc.mjs --require=sources,framing,status --sources=$S && grep -q "re-read" .ai_context/knowledge/protocol.md'`
- risk: med
- demo: protocol.md explains every byte of the 90-byte report, all status codes (incl. 0x00 "new command"), the transaction-ID sequence and the request cycle; every claim's citation resolves against the downloaded sources.
<!-- Use the USB path only (module 17937), never the BLE subclass 18715 (@518703 checksum, @520808
status desc — variable-length, wrong for us). Anchors (bundle c1e6a425): _calculateChecksum @430900
(XOR bytes 2..87 → byte 88); _getTransactionId @430969 (returns then increments, resets so it emits
0..30; txId init `this.transactionId=0` in base module 5076 @221026 ⇒ first requests carry txId 0, 1);
_createDataSend @431065 (layout); WebHID connectDevice @431359 only calls open() — no handshake;
_getUSBTransferInResult @432623 (status switch 0..5; case 0 → ERROR_USB_TRANSFER_IN_NEW_COMMAND
@433870); receiveFeatureReport @433158 (91-byte reply: byte 0 stripped @433224; uses
new Uint8Array(e.buffer) ignoring byteOffset); status names RZ_STATUS_DESC module 64085 @1996551
(0 New Command, 1 Busy, 2 Successful, 3 Failure, 4 Timeout, 5 Not Supported, 6–11 others);
SLEEP_TIME_BETWEEN_OUT_IN=5, MAX_RETRY_IN 10, MAX_RETRY_OUT 20 (Synapse resends).
zexrox host.py: validate_packet :105, packet_checksum :129, razer_reply :141, BUSY_STATUS/BUSY_POLL_*
:221-223 (0.5 s budget, 20 ms), re-read loop :420-437 ("never rewrite"), status names :543.
### Request cycle must record: Synapse resends on status 0/3/4 and on txId/class/id mismatch; zexrox
re-reads only, against a real 02A7. DECISION for this repo: send once, re-read only, never resend;
status 0x00 or 0x01 with matching header = pending; budget/interval cite zexrox (0.5 s / 20 ms),
not Synapse's 50 ms (which assumes resend). Reply checksum: neither source validates it ⇒ record it
as a diagnostic, never reject on it (until hardware evidence says otherwise).
Also create `## Sources` linking protocol-sources.md; doc header states citation formats and
"Synapse targets 02D0 (superset); zexrox runs against a real 0498". Run --write-lock. -->

## M4: protocol.md — device-info commands, reply layouts, golden packets, diagnostics allowlist [done]
- verify: `bash -c 'S=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad/sources; node tools/check-protocol-doc.mjs --require=sources,framing,status,commands,golden --groups=device-info --sources=$S && grep -qx "Diagnostics reads: 0x00:0x81, 0x00:0x82" .ai_context/knowledge/protocol.md'`
- risk: high
- demo: protocol.md lists Get Firmware Version (00:81) and Get Serial (00:82) as confirmed, safe reads with exact sizes and reply layouts, plus golden packets G1 (firmware request, txId 0), G2 (serial request, txId 1) and G3 (a firmware reply) whose checksums the checker recomputes.
<!-- Sizes/layouts: firmware [size 2, class 0x00, id 0x81], major = data[0], minor = data[1]; serial
[size 22, 0x00, 0x82], printable ASCII (module 38287 @1093595 — trace from the pid-720 device module
5315 @235199). zexrox host.py:22 READ_COMMANDS lists (0x00,0x81),(0x00,0x82) as reads forwarded to a
real 02A7 ⇒ confirmed when Synapse matches. Also document Set Serial 00:02 (size 22, module 11880
@280740) as a write with Safe=no — it differs from 00:82 only by bit 7, which is why M11's byte guard
exists. Other class-0 reads (00:84/86/87, 0x0f reads from host.py:22-23) only if name+size are
citable; they stay Safe=no in this task. Goldens: compute bytes with a throwaway `python3 -I` script
in $S, never with repo code. G3 reply values must be labelled illustrative. No [HYPOTHESIS] byte in
any golden. STOP rule: if 00:81/00:82 size or layout cannot be cited, fail and report — do not invent.
Run --write-lock.
2026-10-14 (M1): the checker enforces byte 88 = XOR 2..87 on EVERY golden block, responses included —
compute G3's checksum correctly (it is illustrative anyway); a real captured reply with a bad checksum
would need a documented rule change, never a silent edit.
2026-10-14 (M3, moved from brief): status names = array J @1997872 (export @1996551); retry defaults @1997114 (5/5/10/20); connectDevice @431365; _getUSBTransferInResult token @432629.
Also from M3: no 50 ms value exists (Synapse defaults 5/5/10/20 @1997114); status 0x00-as-pending is
[HYPOTHESIS] (zexrox treats 0x00 as final); zexrox's own LED write counts txId 1..255 (host.py:442). -->

## M5: protocol.md — control interface: macOS interface map, protected rules, transport options [done]
- verify: `bash -c 'S=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad/sources; node tools/check-protocol-doc.mjs --require=sources,framing,status,commands,golden,control --groups=device-info --sources=$S && grep -q "4418" .ai_context/knowledge/protocol.md && grep -q "probe:.ai_context/knowledge/hid-02a7-macos.txt" .ai_context/knowledge/protocol.md'`
- risk: high
- demo: protocol.md explains which of the keyboard's six USB interfaces carries what, why a web page using WebHID cannot reach the Razer control channel (interface 3) on macOS, what Chrome's WebHID/WebUSB protection rules allow, and the transport options for the follow-up task.
<!-- Evidence:
- Owner dump .ai_context/knowledge/hid-02a7-macos.txt (cite as probe:.ai_context/knowledge/hid-02a7-macos.txt#<key>,
  e.g. #IOUSBHostInterface@3): interfaces 0 boot kbd (1/6), 1 multi (7 TLCs, 47 B inputs ids 1,2,3,4,5,7,11),
  2 mouse (1/2), 3 NO driver bound, 4 LampArray (0x59/1, feature ids 1–6, max 51 B), 5 vendor FF00 (64 B in/out);
  Razer DriverKit event services on 0–2. Fill `### Interfaces on macOS` from it.
- zexrox: interface 3 is the one it drives on Windows (native/host.py:456-464), report id 0 + 90 B
  send (:446) and get_feature_report(0, 91) (:410-415). zexrox also opens interface 1 (mi_01, :319-330)
  — record what for.
- Synapse (02D0): product filter vendorId + productId + usagePage p.MU = 12 (@2672178);
  isFeatureReportDevice @2677504 (exactly 1 collection, usagePage 12); connectHardwareEventDevice
  ~@2676200 uses a multi-collection device with input reports (compare 02A7 interface 1).
  zexrox virtual-hid.js:227-234 = shape Synapse expects for 02D0, NOT the real 02A7 descriptor.
- Chromium: fetch the WebHID protected-usage logic (IsAlwaysProtected or equivalent; the critic found
  raw.githubusercontent.com/chromium/chromium/main/services/device/public/cpp/hid/hid_usage_and_page.cc
  → 404 — locate the real path first, e.g. GitHub code search API or chromium.googlesource.com
  ?format=TEXT base64) AND the WebUSB protected interface classes list (HID class 3 is expected to be
  protected for claimInterface) plus the control-transfer permission check (device- vs interface-
  recipient). Save under NEW dir $S/sources/chromium/<path>, pin commit, add to manifest. Record whether
  feature reports in a protected keyboard/mouse collection are exempt.
- OpenRGB #4418: fetch https://gitlab.com/api/v4/projects/CalcProgrammer1%2FOpenRGB/issues/4418 and
  .../notes?per_page=100 into NEW dir $S/sources/openrgb-4418/; decode any 02A7 descriptor/lsusb by hand
  (especially interface 3: endpoints, HID report descriptor); if none, one Claim row saying so. Manifest.
### Transport options (facts + open questions only; the follow-up task decides): (a) WebUSB with
device-recipient class GET/SET_REPORT to wIndex 3 — untested, pending the owner's probe; (b) native
access (Tauri desktop app via IOKit/libusb) — interface 3 has no driver bound, so it is claimable
[HYPOTHESIS until tested]; (c) WebHID only for LampArray lighting (interface 4) and the inputs on
interfaces 1/5. `02A7 status:` stays [UNVERIFIED] for the interface-3 channel on macOS. Run --write-lock. -->

## M6: protocol.md — actuation, Rapid Trigger, Snap Tap commands [done]
- verify: `bash -c 'S=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad/sources; node tools/check-protocol-doc.mjs --require=sources,framing,status,commands,golden,control --groups=device-info,actuation,rapid-trigger,snap-tap --sources=$S && grep -qE "^\| *snap-tap *\| *0x02 *\| *0xa1 *\|" .ai_context/knowledge/protocol.md'`
- risk: med
- demo: protocol.md documents actuation point, Rapid Trigger (incl. continuous) and Snap Tap commands with sources, including that the RZ03-0498 takes Snap Tap as 02:a1/02:21 where Synapse sends 02:a7/02:27.
<!-- DOC-ONLY: never touch src/ or the Diagnostics reads line. Seeds: zexrox host.py:29-69 EXTRA_READS
(02:99 actuation, 02:9a RT, 02:a0 continuous RT, 02:9f/02:af adjustment mode, 02:a8 bottom dead-zone,
02:a7/02:ac Snap Tap, 02:b1 dual keypress priority; with sizes); translate_request :169-219 (0498:
02:a7/02:27 size 15 → 02:a1/02:21 size 4) ⇒ 02:a1/02:21 confirmed for 0498, 02:a7 not confirmed for
0498. Setters (ID & 0x7f) and arg layouts from the Synapse bundle only ⇒ at most `likely` for 0498.
Features the zexrox README:25 lists as unsupported on 0498 keep their rows with a Notes flag. All
writes Safe=no. Unsourced → `### Gaps` bullet, never invented. Run --write-lock.
2026-10-14 (drift D6): zexrox listing a command (EXTRA_READS/READ_COMMANDS) or forwarding it
(host.py:526-532) shows only that Synapse sends it to a real 02A7 — never that the 0498 firmware
implements it. EXTRA_READS includes 02:af, 02:ac, 02:a8, 02:aa, 00:db (host.py:58/60/65/67/68), whose
features README:25 says the 0498 lacks. Row confidence = class/ID/size agreement; firmware support
goes in Notes: README:25 ⇒ unsupported; capture / 0498-specific rewrite ⇒ supported; else unknown.
2026-10-14 (drift N1): zexrox's lists are NOT independent of Synapse — host.py:18 "identified in the
0.1.4 package", host.py:25 names and sizes copied. A command row's `confirmed` covers class, ID and
direction only (zexrox's bridge sends that request to a real 02A7); name and size stay `likely` unless
a 0498 capture or rewrite backs them; firmware support lives in Notes / the Feature matrix. -->

## M7: protocol.md — lighting commands [done]
- verify: `bash -c 'S=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad/sources; node tools/check-protocol-doc.mjs --require=sources,framing,status,commands,golden,control,lamparray --groups=device-info,actuation,rapid-trigger,snap-tap,lighting --sources=$S && test "$(grep -cE "^\| *lighting *\|" .ai_context/knowledge/protocol.md)" -ge 4'`
- risk: med
- demo: protocol.md lists the Razer lighting commands (LED state, effects, brightness, per-key custom frame), each cited, and a LampArray section describing the keyboard's standard lighting interface (interface 4) report by report.
<!-- DOC-ONLY. Seeds: zexrox host.py:59 (03:80 Get LED State), :355-369 (03:00 Set LED State, LED id 8,
game-mode LED), host.py:22-23 READ_COMMANDS 0f:80/0f:82/0f:84/0f:90 (name them only from Synapse).
Synapse: effect setters, brightness, custom frame, reached from the pid-720 device module 5315.
No golden packets from writes.
LampArray section: decode report ids 1–6 from the owner dump's interface-4 descriptor (probe: citation)
and name each field from the USB-IF HID Usage Tables, Lighting and Illumination page 0x59 (cite
url:https://usb.org/... — fetch the HUT PDF/text into NEW dir $S/sources/hut/ and add to manifest if a
stable URL exists). Include LampArrayAttributes (1), LampAttributesRequest (2) / Response (3),
LampMultiUpdate (4), LampRangeUpdate (5), LampArrayControl/AutonomousMode (6). Run --write-lock.
2026-10-14 (drift N1/AC2): OpenRGB 4418 is 0498-specific lighting evidence (02A7 added to OpenRGB's
existing Razer controller, MR !2627; reporter found lighting working). If the commands that controller
sends to 02A7 can be identified from OpenRGB source (GPL-2.0: facts only, pin a commit, manifest it),
matching lighting rows may get a "supported" verdict; else they stay "unknown".
2026-10-15 (orchestrator, BEFORE M7 starts): separate fix commit on ## Control interface — fold in the
owner's probe run (knowledge/webusb-probe-02a7-macos.txt: 6a/6b/6c refused, 6d ok; if3 descriptor =
0x0C/0x01 + one 90-B feature report; if3 has only an interrupt OUT endpoint; WebHID offers 4 devices),
turning predictions into observations; plus drift-M5 N2 (tag :255), N5 (url-only Chromium history),
N6 (openrgb note-id citations); add the probe file to the manifest/citation scheme if needed. DONE 2026-10-15 in 05bf699.
2026-10-15 (verifier of 05bf699 — FAIL, fix AFTER the M7 commit, separate fix commit, ## Control interface only):
D1 tag the if3 attribution where it is stated as fact (Interfaces table if3 row; Transport (a) "6d returned
interface 3's report descriptor"; add a probe citation to the likely row that says "gives 0x0C/0x01");
D2 "agrees with each point" is false for interface 2 — the mouse was offered with its input listed though
IsAlwaysProtected protects Mouse input; say so and add an open question; D3 cite the closing event
openrgb#4418:01baff8aec64613fdaab9bf31fed650f89d21e70, not 2278000670 (a "mentioned in" note); also
restore the open question "why does macOS bind no driver to interface 3" and bump protocol.md's
"Last updated" line. state.md and an ADR-003 erratum were already fixed. ALL DONE 2026-10-15 (fix commit after 2cae4db).
2026-10-14 (M5): owner dump gives if4 feature sizes id1..6 = 22,2,28,50,9,1 B (max 51); WebHID treats
page 0x59 as unprotected (chromium hid_report_utils.cc:45 @1aeca202, already in manifest) — reuse
those citations rather than re-fetching. 
2026-10-15 (M6 verifier): a Synapse triple's size is only the DECLARED size — sendCommand takes a size
argument that overwrites byte 5 (@435514, @431246); check the callers before stating a size, and grade
name/size per drift N1 (zexrox copies them). -->

## M8: protocol.md — keymap, Hypershift, macro commands [done]
- verify: `bash -c 'S=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad/sources; node tools/check-protocol-doc.mjs --require=sources,framing,status,commands,golden,control --groups=device-info,actuation,rapid-trigger,snap-tap,lighting,keymap,hypershift,macro --sources=$S && grep -qE "^\| *macro *\| *0x06 *\|" .ai_context/knowledge/protocol.md'`
- risk: med
- demo: protocol.md covers key remapping, the Hypershift layer and onboard macros, each cited; anything the sources do not pin down is visibly tagged [HYPOTHESIS] or listed under Gaps.
<!-- DOC-ONLY. Seeds: zexrox EXTRA_READS keymap 02:84, 02:8c-02:8f, 02:92, 02:9b, 02:9e, 02:b2, 02:b5-02:b7;
macros 06:80, 06:88-06:8c, 06:8e. Hypershift: if Synapse encodes it as a layer argument of key
assignment rather than its own command, write a `### Gaps` bullet (`- hypershift: ... — <citation>`)
— never invent a command. Run --write-lock.
2026-10-14 (M6): Synapse declares 02:a8/02:28 twice — size 2 as Bottom Dead-Zone (@1047653) and size 1
beside the "Function Key Swap" names (@1048274, @1048302); they differ only in byte 5. If a keymap
feature uses that pair, say so and cross-reference the actuation rows; never assume one meaning. 
2026-10-15 (M6 verifier): a Synapse triple's size is only the DECLARED size — sendCommand takes a size
argument that overwrites byte 5 (@435514, @431246); check the callers before stating a size, and grade
name/size per drift N1 (zexrox copies them). -->

## M9: protocol.md — profiles, polling rate, feature matrix [done]
- verify: `bash -c 'S=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad/sources; node tools/check-protocol-doc.mjs --require=all --groups=all --sources=$S && grep -q "zexrox:README.md:25@840f03dc" .ai_context/knowledge/protocol.md'`
- risk: med
- demo: protocol.md is complete: onboard profiles and polling-rate commands are documented, and a feature matrix marks every Synapse feature of this keyboard yes / no / unknown for the RZ03-0498 with a source.
<!-- DOC-ONLY. Profiles: host.py:30-34,63 (05:80/81/84/88/8a/8c; host.py:25-28 notes 05:8a size 1 blocked
in 0.1.3). Polling: host.py:64 00:c0 Get USB High Speed Polling Period (size 2) + Synapse setter.
Matrix rows: per-key actuation, Rapid Trigger, continuous RT, Snap Tap, single-key Snap Tap, bottom
dead-zone, analog report / Analog V3, Mod-Tap, dual keypress priority, Game Mode key lock, Tournament
Mode, lighting effects, per-key RGB, brightness, key remap, Hypershift, macros, onboard profiles,
polling rate. "no" rows cite zexrox README:25 (6 features); "yes" needs 0498-specific evidence (zexrox
forward/rewrite); 02D0-only evidence ⇒ unknown. Run --write-lock.
2026-10-14 (M4 verifier): zexrox does NOT forward 00:da, 00:5a or the 03:00 LED-8 set — host.py:506-525
answers them on the host (Windows lock), so they are not 0498 evidence; Game Mode key lock stays "no" per
README:25.
2026-10-14 (drift D6, supersedes the line above's "yes" rule): generic forwarding (host.py:526-532)
is NOT "yes" evidence. "yes" needs command-specific 0498 evidence (a capture such as the snaptap one
behind host.py:169-180, a 0498-specific rewrite, or zexrox README saying the feature works); README:25
⇒ "no"; otherwise "unknown". Polling: also Synapse [1,0,133] Get Device Polling Period (00:85,
@280600 region), not only 00:c0.
2026-10-14 (M6): anchors for the matrix — Synapse's 02D0 device config enables snapTap, bottomDeadZone,
singleKeySnapTap, dualKeypressPriority, analogKeyboardV3, tournamentMode (@235844-235945; read the
window to its end before citing). Correction (M6 repair, 2026-10-15): the class named "rzDevice25"
(@429920) is transport module 17937 (the framing module); per-key actuation/RT callers are module
43086, imported by 17937. @136159 is module 1207 (@34026), a different device module with another
sendCommand signature — which device module product 720 uses is not traced; trace it (module 44025
imports both 17937 and 1207) before citing 1207's Snap Tap code. The M6 rows
already carry per-command 0498 verdicts (supported / unsupported / unknown) — reuse them. 
2026-10-15 (M6 verifier): a Synapse triple's size is only the DECLARED size — sendCommand takes a size
argument that overwrites byte 5 (@435514, @431246); check the callers before stating a size, and grade
name/size per drift N1 (zexrox copies them). 
2026-10-15 (M7): lighting matrix rows stay "unknown" except LED id 8 (zexrox's own 03:00 write) unless
OpenRGB's controller is read. Synapse module 436 also declares 0x0f:0x81, 0x85/0x05 Chroma Calibration,
0x86/0x06 Fn Overlay, 0x07 Set New Chroma Frame, 0x88/0x08, 0x92-0x94/0x12-0x14, 0x17 Trigger Firmware
Effects — no rows yet; list them as matrix "unknown" only if a Synapse feature maps to them. LampArray:
the first hardware step for the follow-up is a read-only Get Feature of report 1 (report 3 needs a
set of report 2 first, so it is not read-only). 
2026-10-15 (M8): zexrox lists class-0x05 reads at host.py:30-34 (05:8a, 80, 81, 88, 8c); 05:88 is exempt
from its size check (host.py:121-124). Module 1207 declares size-0 triples that collide with real IDs
(0x06:0x80 @53594, 0x03:0x80 @52377) — check class 0x05 for the same. Hypershift has no command (a mode
byte in key assignment, see Gaps): a Hypershift matrix row is "unknown". -->

## M10a: Checker pins the Chromium and OpenRGB sources by hash [done]
- verify: `bash -c 'S=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad/sources; node --test tools/ >/dev/null || exit 1; T=$(mktemp -d); cp -r "$S/." "$T/"; printf x >> "$T/chromium/services/device/hid/hid_connection.cc"; node tools/check-protocol-doc.mjs --require=none --sources="$T" >/dev/null 2>&1; test $? -eq 2 || exit 1; U=$(mktemp -d); cp -r "$S/." "$U/"; printf x >> "$U/openrgb-4418/issue.json"; node tools/check-protocol-doc.mjs --require=none --sources="$U" >/dev/null 2>&1; test $? -eq 2 || exit 1; Z=$(mktemp -d); mkdir "$Z/zexrox"; cp -r "$S/zexrox/." "$Z/zexrox/"; node tools/check-protocol-doc.mjs --require=none --sources="$Z" --only=zexrox && node tools/check-protocol-doc.mjs --require=all --groups=all --sources="$S"'`
- risk: med
- demo: altering any saved Chromium or OpenRGB source file now makes the checker reject the sources directory (exit 2), as it already does for zexrox and Synapse; a zexrox-only directory (the CI mode) still passes.
<!-- From drift check after M5 (N4, earlier D5): verifySources (check-protocol-doc.mjs ~L794-823)
hash-checks only zexrox and synapse; a tampered chromium file is not noticed and an openrgb edit fails
only via the lock (exit 1). Add manifest checks: chromium = commit id field + sha256 of every listed
file; openrgb-4418 = sha256 of issue.json and discussions.json. Respect the --only kinds filter so the
CI zexrox-only mode keeps working. One test per source kind in tools/check-protocol-doc-sources.test.mjs
using fake trees (no scratchpad paths, no env). Do not change rule checks or the lock format. -->

## M10: Wire the protocol check into verify and CI [done]
- verify: `bash -c 'S=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad/sources; T=$(mktemp -d) && mkdir $T/zexrox && cp -r $S/zexrox/. $T/zexrox/ && node tools/check-protocol-doc.mjs --sources=$T --only=zexrox && grep -q "\"check:protocol\"" package.json && grep -q "only=zexrox" .github/workflows/pages.yml && grep -q "840f03dca68c7f7a3b8f867475a2c8e9a355a1bc" .github/workflows/pages.yml && npm run verify'`
- risk: med
- demo: `npm run verify` now also checks the whole protocol reference against the citation lock, and CI additionally resolves every zexrox citation against a checkout of zexrox at the pinned commit — a made-up zexrox citation fails CI.
<!-- package.json: "check:protocol": "node tools/check-protocol-doc.mjs && node --test tools/" chained
into verify right after lint (no --sources — CI has no $S; the lock covers Synapse citations).
pages.yml verify job: before npm run verify, clone https://github.com/zexrox/huntsman-synapse-web into
$RUNNER_TEMP/src/zexrox, checkout the pinned full sha (data only — never run anything from it), then
`node tools/check-protocol-doc.mjs --sources=$RUNNER_TEMP/src --only=zexrox`. Pin action versions as
already used in the file. Also add a one-line pointer to protocol.md in protocol-sources.md.
2026-10-14 (M1 verifier): with no flags the checker runs --require=all but NO group checks — make
check:protocol run `--require=all --groups=all` so verify/CI also enforce group coverage and the
device-info firmware/serial rule.
2026-10-14 (drift D5): verifySources (check-protocol-doc.mjs ~L795-823) hash-checks only zexrox and
synapse; chromium @<commit> is parsed but never compared and an openrgb note ID resolves if it
appears anywhere in the folder — moved to M10a. (D8): branch base is 39eb1db but origin/master is
5a65950 (probe page); `git merge origin/master` (no force, merge-tree was clean) before npm run
verify so CI runs the tree verified locally. Merge first, then edit package.json (origin/master
changes one line of it).
2026-10-15: M10 stays [in_progress] through the doc fix pass and the M11 write-back (its verify = full npm run
verify guards both); flip M10 [done] / M11 [in_progress] only in the commit pushed after the owner approves the
push — M11's verify needs the PR, so arming it earlier leaves the gate red with nothing to fix. -->

## M11: State write-back, PR with green CI — owner approves the merge [in_progress]
- verify: `bash -c 'npm run verify && ! git ls-files | grep -qE "(^|/)(host\.py|virtual-hid\.js|main\.[0-9a-f]{8}\.js)$" && grep -q "protocol.md" .ai_context/state.md && test "$(gh pr view task/protocol-reference --json headRefOid -q .headRefOid)" = "$(git rev-parse HEAD)" && timeout 420 gh pr checks task/protocol-reference --watch --fail-fast'`
- risk: med
- checkpoint: human
- demo: a pull request into master shows every CI check green, including the zexrox citation check; the owner reviews protocol.md and the feature matrix, and acking this checkpoint approves the merge.
<!-- Before pushing: audit the .ai_context diff against INDEX H1/L1 (no secrets, internal URLs, real
names, no serial numbers, no unrelated-app names) and confirm no source text entered the repo.
INDEX.md: add a row for knowledge/protocol.md and knowledge/hid-02a7-macos.txt. state.md Now/Next
(≤5 KB, dated): next = follow-up transport task after the WebUSB probe. Push without force;
`gh pr create --base master`; body = AC1–AC6 checklist + attribution line. DO NOT merge.
2026-10-14 (drift D9): state.md Next steps 2 still says "WebHID connect to interface 3 … fake
navigator.hid" — rewrite it from the rescope. CLAUDE.md DoD needs ADRs: append to decisions.md the
rescope (WebHID cannot reach if3 on macOS; ADR-001's WebHID premise is superseded for the control
channel), the request-cycle recommendation, and the diagnostics allowlist.
2026-10-15: ADR-003 (Tauri desktop app, owner-accepted) already records the rescope/transport; still
owed: request-cycle and diagnostics-allowlist ADRs. 
2026-10-15 (drift after M9, BEFORE M11 — orchestrator fix pass + light verify, after the M10 commit):
protocol.md D1 class-0 "confirmed by both sources"/"Confirmed (both sources)" → zexrox forwards it; add to the
top Confidence definition that in Commands rows `confirmed` covers class, ID and direction only; D2 :205 "the
02D0 config was not read" → module 5315 config read for the matrix, sets no usagePage, claimInterface:3
(@235284), which of the three 720 configs loads not traced; D3 matrix: add Profile reset (0x05:0x0b) and N-key
rollover rows (unknown) or state the row-selection rule; Mod-Tap row notes modTap false; D4 add Synapse cites
for 0x02:0xaa (@1047928/@1047971), 0x00:0xdb (@426433), 0x00:0xda (@425913), 0x00:0x5a (@425942); R1 one
[HYPOTHESIS] sentence on what turns unknown into yes/no; R2 add openrgb#4418:2277952715 to lighting matrix rows;
R3 Game Mode key lock = no vs Gaming Mode LED = yes clause; R4 (optional) native control-transfer framing
(class SET/GET_REPORT, wValue 0x0300, wIndex 3, 90-byte data, no report-ID byte; untested). Refresh
protocol-sources.md (zexrox row "not yet read"; add Chromium BSD, HUT, owner dump/probe rows).
M11 write-back: ONE combined INDEX row for knowledge/protocol.md + hid-02a7-macos.txt + webusb-probe-02a7-macos.txt
(INDEX ~3.7 KB of 4 KB); state.md Now/Next (mention protocol.md — the gate greps it; lighting: WebHID in Chrome,
native inside Tauri per ADR-003), Open questions (can a native app claim if3), Pending hardware checks (G1 over
native if3; LampArray report-1 read); ADRs: request-cycle recommendation, diagnostics allowlist incl. serial
handling; brief.md correction (20 unit tests / 3 e2e; zexrox CI step). PR body: the "owner may veto" assumptions,
and that matrix verdicts are not machine-checked. Lesson: scripts/check-context-bulk.sh is a claude-starter
file — a starter sync could revert ADR-004's exception.
2026-10-15 (doc fix pass): the executor's claim that `usagePage` sits near the other two product-720 configs
is FALSE (verifier + orchestrator regex: no "usage" within 600 chars of @1211158 or @2147800-2148600; first
`usagePage` after @235150 is @2672184, default-MU code) — do not put it in state.md. Journal lessons at /wrap: a Synapse command name may not sit next to its triple (0x00:0xdb
name only in getTournamentMode's send ~@514041) — find names via the method that sends the triple; copy.py
diffs whole changed lines, so editing one cell of an old row re-checks the row's old text. -->

## M12: Merge and confirm the master build [pending]
- verify: `bash -c 'test "$(gh pr view task/protocol-reference --json state -q .state)" = MERGED && M=$(gh pr view task/protocol-reference --json mergeCommit -q .mergeCommit.oid) && test "$(gh run list --workflow pages.yml --commit "$M" --json conclusion -q ".[0].conclusion")" = success'`
- risk: low
- demo: the PR is merged and the master workflow (verify incl. the protocol check, then Pages deploy) is green on the merge commit.
<!-- Only after the M11 ack: push the branch (plan statuses), then `gh pr merge task/protocol-reference
--merge` (no force; keep the branch). Watch the run for the merge commit. -->
