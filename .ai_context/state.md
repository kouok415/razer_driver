<!-- Snapshot of NOW, overwrite-friendly — writing rules: INDEX.md §Writing protocol. -->

# Project State

_Last updated: 2026-10-14_

## Now

Task `protocol-reference` (branch `task/protocol-reference`): M1–M5 done, M6 under
verification. Owner ran the read-only probe 2026-10-15 (Edge 153, macOS;
`knowledge/webusb-probe-02a7-macos.txt`): WebUSB cannot reach the interface-3 control
channel (claim refused, class GET_REPORT refused for interface and device recipients);
only a device-recipient GET_DESCRIPTOR got through and returned interface 3's report
descriptor (Consumer 0x0C collection, one 90-byte feature report; its only endpoint is
interrupt OUT). WebHID offers LampArray (if4), if1 inputs, mouse and vendor FF00 — not
if3. Per the owner's earlier choice, the follow-up uses a desktop app (Tauri) for the
control channel; LampArray lighting can stay on WebHID.

## Next steps

1. **Protocol research** → `knowledge/protocol.md`: extract the Huntsman V3
   Pro command set from zexrox/huntsman-synapse-web (MIT) and Razer's
   Synapse Web bundle (facts only), with golden packets and a feature
   matrix of what RZ03-0498 firmware supports. Sources:
   `knowledge/protocol-sources.md`.
2. **Transport + diagnostics**: WebHID connect to interface 3, packet
   framing, read-only queries (firmware version, serial) shown on a
   diagnostics page; a simulated keyboard behind a fake `navigator.hid` for
   E2E. Owner runs the first read-only hardware test on macOS.
3. **Features, owner's priority order**: actuation / Rapid Trigger / Snap
   Tap → RGB lighting → remap / Hypershift / macros → profiles, polling
   rate, etc. Bilingual UI (zh-Hant + en) from the first feature screen.

## Constraints

- Owner wants Synapse feature parity where the RZ03-0498 firmware allows.
- Stack fixed by owner: TypeScript + React + Vite; UI zh-Hant + en.
- No hardware attached to the dev machine; owner verifies on macOS.
- Hosted on GitHub Pages from `master` (ADR-002); repo is public, MIT.
- Commit as the GitHub noreply address, never a personal email.

## Open questions

- _(none)_

## Pending hardware checks

- _(none yet)_
