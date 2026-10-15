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
