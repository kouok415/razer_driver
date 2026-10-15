<!-- Snapshot of NOW, overwrite-friendly — writing rules: INDEX.md §Writing protocol. -->

# Project State

_Last updated: 2026-10-14_

## Now

Task `protocol-reference` (branch `task/protocol-reference`): M1–M5 done — checker,
citation lock, and `knowledge/protocol.md` framing / status / device-info commands /
golden packets / control interface; M6 (actuation, Rapid Trigger, Snap Tap) next. Pinned
Chromium predicts WebUSB cannot reach interface 3 (Chrome M148+). Read-only probe page is live
(`probe.html`); WebHID cannot reach USB interface 3 on macOS
(`knowledge/hid-02a7-macos.txt`). Waiting on the owner's WebUSB probe report.

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
