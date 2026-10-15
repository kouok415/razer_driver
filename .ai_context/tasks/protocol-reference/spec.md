# Spec: Cited protocol reference for the Huntsman V3 Pro TKL (RZ03-0498)

Goal: Afterwards the repo holds `.ai_context/knowledge/protocol.md`, a cited,
machine-checked reference for the Razer Huntsman V3 Pro TKL (RZ03-0498, USB
1532:02A7): packet framing, transaction and status semantics, how the control
channel is reached (including the macOS finding that USB interface 3 has no
HID driver), the standard LampArray lighting interface, and the command set
for device info, actuation / Rapid Trigger / Snap Tap, lighting, keymap /
Hypershift / macros, onboard profiles and polling rate, plus a feature matrix
of what this firmware supports. A checker enforces that every fact cites a
source, and CI re-verifies citations. The reference is transport-independent:
the follow-up task (WebUSB web app, or a Tauri desktop app if WebUSB cannot
reach interface 3) builds on it.

(Rescoped 2026-10-14 from "webhid-foundation": the owner's macOS dumps —
`.ai_context/knowledge/hid-02a7-macos.txt` — show WebHID cannot reach USB
interface 3, so transport, UI and simulator move to a follow-up task planned
after the owner runs a read-only WebUSB probe.)

## Acceptance criteria

- [ ] AC1: protocol.md documents framing (report ID, size, field layout,
  checksum), transaction-ID and status semantics, and a command table
  covering device-info reads, actuation / Rapid Trigger / Snap Tap,
  lighting, keymap / Hypershift / macros, profiles and polling rate. Every
  command row has a non-empty Source cell (zexrox `path:line@sha` or Synapse
  bundle `sha8@offset#token`) and a confidence tag. Check:
  `node tools/check-protocol-doc.mjs --require=all --groups=all --sources=$S`
  exits 0, and the checker's own tests prove it fails on an empty Source, an
  unresolvable citation, and a missing section.
- [ ] AC2: protocol.md has a feature matrix (≥ 10 rows): each Synapse feature
  for this keyboard → supported on RZ03-0498 yes / no / unknown, with source.
- [ ] AC3: protocol.md has golden packets (≥ 2 requests, ≥ 1 response) whose
  checksums the checker recomputes, for the device-info reads.
- [ ] AC4: protocol.md's control-interface section records the per-interface
  layout seen on macOS (cited to the owner's dump), why WebHID cannot reach
  interface 3, Chrome's protected-collection and WebUSB protected-class
  rules (cited), and the LampArray interface as a standard lighting path.
- [ ] AC5: `npm run verify` runs the checker (citation lock, no sources
  needed), and CI also resolves every zexrox citation against zexrox at the
  pinned commit.
- [ ] AC6: a PR into master with green CI, merged after the owner approves.

## Constraints

- Research only: nothing in this task talks to a device.
- No invented protocol: every byte layout / command ID cites a source;
  anything unconfirmed is tagged `[HYPOTHESIS]` and kept out of golden
  packets. (Owner: uncited protocol facts = reject.)
- Clean-room: no code copied from the Synapse Web bundle (proprietary) or
  OpenRazer (GPL-2.0); adaptations of zexrox (MIT) carry attribution.
- Downloaded sources stay in the session scratchpad, are never executed, and
  never enter the repo — only short identifiers needed for citations.
- The repo is public: no serial numbers, no names of unrelated software on
  the owner's machine.

## Out of scope

- Transport code (WebHID / WebUSB / native), UI, i18n, simulator, E2E —
  follow-up task after the WebUSB probe.
- The WebUSB probe page itself (separate small PR outside this task).
- Firmware update / bootloader / DFU.

## Assumptions

- [ASSUMED: checker tests live in tools/*.test.mjs (node:test); the
  `src/**/*.test.ts` colocation rule covers app code only.]
- [ASSUMED: the request-cycle recommendation recorded in protocol.md is
  "send once, re-read only, never resend; status 0x00/0x01 with matching
  header = pending" (zexrox runs against a real 0498; Synapse's resend
  policy is tuned for 02D0). The follow-up task implements it.]
- [ASSUMED: reply checksum is documented as "not validated by either
  source" — record it, do not enforce it.]
- [ASSUMED: (M4) a class-0 read row is `confirmed` when zexrox lists its
  class/ID as a read and its host forwards it unchanged to a real 02A7; the
  name, size and reply layout stay likely (Synapse only), stated in Notes.]
- [ASSUMED: (drift) zexrox listing or forwarding a command shows only that
  Synapse sends it to a real 02A7, not that the 0498 firmware implements
  it; a feature-matrix "yes" needs command-specific 0498 evidence, else
  "unknown".]
- [ASSUMED: (drift) AC3's response golden (G3) is synthetic: its layout
  follows the cited framing rules, its payload values are illustrative,
  no real 02A7 reply has been captured, and its byte 88 follows the
  request checksum rule so the checker can recompute it.]
- [ASSUMED: (drift) 0x00:0x82 Get Serial Number stays on the diagnostics
  allowlist (Synapse shows the serial); the follow-up must keep the reply
  out of logs, reports and the public repo — owner may veto.]
- [ASSUMED: (M5) facts resting only on Chromium code at the pinned commit
  are `likely` (one source; the owner's Chrome build and field trials are
  unknown); "WebHID only sees collections the OS HID stack exposes" and the
  first-milestone inferences from chromiumdash branch positions are
  [HYPOTHESIS].]
- [ASSUMED: (drift N1) zexrox's command lists derive from Synapse
  (host.py:18, :25), so they are not an independent source for names or
  sizes. In command rows `confirmed` covers class, ID and direction only,
  on the ground that zexrox's bridge sends that request to a real 02A7;
  name and size stay `likely` unless a 0498 capture or rewrite backs them;
  firmware support is stated in Notes and the Feature matrix — owner may
  prefer `likely` for all such rows.]
- [ASSUMED: (M6) the Size column of 0x02:0x99/0x19/0x9a/0x1a gives the
  size Synapse sends (2+5×keys, 2+6×keys), with the declared 80 in Notes;
  Synapse names with "Analog" are shortened by dropping that word (rule
  stated in the doc); the placement of 0x02:0xb1/0x31 under snap-tap and
  of 0x9f/0xaf/0xa8/0x28 under actuation is this doc's choice.]
- [ASSUMED: (M7) Set LED State 0x03:0x00 counts as 0498-supported for
  LED id 8 only, because zexrox's own host sends that packet (built from
  its captures) to a real 02A7, though it never checks the reply status;
  the six LampArray rows are `likely` (field names and roles rest on HUT
  alone); lighting sets that zexrox only forwards stay `likely`.]
- [ASSUMED: (M8) Hypershift is a Gaps bullet, not a command: Synapse
  carries the layer as a mode byte in key assignment (NormalMode 0,
  HypershiftMode 1). 0x02:0x9e/0x1e's Size column gives the sent 1+9×keys.
  32-character Synapse names are altered by a rule stated in each row's
  Notes (copy rule). Synapse-only keymap/macro management writes and
  0x06:0x85 got rows (likely); triples bound to no name got none.]
