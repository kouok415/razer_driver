<!-- Snapshot of NOW, overwrite-friendly — writing rules: INDEX.md §Writing protocol. -->

# Project State

_Last updated: 2026-10-15_

## Now

Task `protocol-reference` (branch `task/protocol-reference`): M1–M10 work
committed; M11 (PR for the owner) next. `knowledge/protocol.md` is the cited protocol
reference: framing, request cycle, control interface on macOS, LampArray,
the command set, golden packets G1–G3, a 24-row feature matrix (Snap Tap and
the Gaming Mode LED yes, six README features no, the rest unknown). `npm run
verify` checks it against `tools/citations.lock.json`; CI also resolves the
zexrox citations at the pinned commit. Nothing has been sent to the keyboard.

Transport (ADR-003): the owner's probe showed no browser path reaches the
interface-3 control channel, so the follow-up is a Tauri desktop app.
Lighting: Chrome's WebHID offers the LampArray interface (nothing sent to it
yet); inside Tauri it goes native.

## Next steps

1. **Finish `protocol-reference`**: PR into master with green CI; the
   owner reviews protocol.md, the feature matrix and ADR-005/006, then
   approves the merge.
2. **Follow-up task: Tauri desktop app** (ADR-003): native access to USB
   interface 3, read-only diagnostics first (ADR-006: 0x00:0x81, 0x00:0x82),
   the request cycle of ADR-005, LampArray natively, a simulated keyboard
   behind the native transport for tests. Rewrite CLAUDE.md (description,
   Verify, DoD) for a desktop app; decide whether GitHub Pages stays.
3. **Features, owner's priority order**: actuation / Rapid Trigger / Snap
   Tap → RGB lighting → remap / Hypershift / macros → profiles, polling
   rate, etc. Bilingual UI (zh-Hant + en) from the first feature screen.

## Constraints

- Owner wants Synapse feature parity where the RZ03-0498 firmware allows.
- Stack fixed by owner: TypeScript + React + Vite; UI zh-Hant + en.
- No hardware attached to the dev machine; owner verifies on macOS.
- Repo is public, MIT; Pages from `master` (ADR-002).
- Commit as the GitHub noreply address, never a personal email.
- `scripts/check-context-bulk.sh` holds ADR-004's protocol.md cap; it is a
  claude-starter file, so a starter sync could revert it.

## Open questions

- Can a native macOS app claim interface 3 (no driver bound, its only
  endpoint is interrupt OUT)? [HYPOTHESIS] yes; untested.
- Which of Synapse's three product-720 configs the page loads (protocol.md
  § Control interface).

## Pending hardware checks

- G1 (Get Firmware Version) over native interface 3, with ADR-005's cycle.
- LampArray: read-only Get Feature of report 1 (attributes) over WebHID.
