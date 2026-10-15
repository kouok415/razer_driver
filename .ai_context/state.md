<!-- Snapshot of NOW, overwrite-friendly — writing rules: INDEX.md §Writing protocol. -->

# Project State

_Last updated: 2026-10-15_

## Now

Task `protocol-reference` (branch `task/protocol-reference`): M1–M5 done, M6 under
verification. Owner ran the read-only probe 2026-10-15 (Edge 153, macOS;
`knowledge/webusb-probe-02a7-macos.txt`): WebUSB cannot reach the interface-3 control
channel (claim refused, class GET_REPORT refused for interface and device recipients);
only a device-recipient GET_DESCRIPTOR got through; it returned a report descriptor
taken to be interface 3's ([HYPOTHESIS]) (Consumer 0x0C collection, one 90-byte feature report; its only endpoint is
interrupt OUT). WebHID offers LampArray (if4), if1 inputs, mouse and vendor FF00 — not
if3. Per the owner's earlier choice, the follow-up uses a desktop app (Tauri) for the
control channel; LampArray lighting can stay on WebHID.

## Next steps

1. **Finish `protocol-reference`** (M7–M12): lighting + LampArray, keymap /
   Hypershift / macros, profiles + polling + feature matrix, checker source
   hashing, CI wiring, PR for the owner to approve.
2. **Follow-up task: Tauri desktop app** (ADR-003): native access to USB
   interface 3 (claiming it is untested), read-only diagnostics first
   (firmware version), lighting via the LampArray interface natively, a
   simulated keyboard behind the native transport boundary for tests. Rewrite
   CLAUDE.md (description, Verify, DoD) for a desktop app; decide whether the
   GitHub Pages build stays.
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
