<!-- Snapshot of NOW, overwrite-friendly — writing rules: INDEX.md §Writing protocol. -->

# Project State

_Last updated: 2026-10-14_

## Now

Project bootstrapped (React + TS + Vite skeleton, Vitest, Playwright,
oxlint). The app only detects WebHID support; nothing talks to the keyboard
yet. Target device: RZ03-0498, USB 1532:02A7 (confirmed by owner).

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

## Open questions

- Project license (MIT assumed compatible with zexrox source; owner to
  confirm).
- Hosting: localhost only, or also GitHub Pages?

## Pending hardware checks

- _(none yet)_
