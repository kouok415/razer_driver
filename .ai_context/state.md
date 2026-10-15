<!-- Snapshot of NOW, overwrite-friendly — writing rules: INDEX.md §Writing protocol. -->

# Project State

_Last updated: 2026-10-15_

## Now

No task is active. `protocol-reference` is merged (PR #3, 2026-10-15):
`knowledge/protocol.md` is the cited protocol reference — framing, request
cycle, control interface on macOS, LampArray, the command set, golden
packets G1–G3, a 24-row feature matrix (Snap Tap and the Gaming Mode LED
yes, six README features no, the rest unknown). `npm run verify` checks it
against `tools/citations.lock.json`; CI also resolves the zexrox citations
at the pinned commit. Nothing has been sent to the keyboard. ADR-005/006
accepted by the owner (ADR-007).

Transport (ADR-003): no browser path reaches the interface-3 control
channel, so the follow-up is a Tauri desktop app. Lighting: Chrome's WebHID
offers the LampArray interface (nothing sent to it yet); inside Tauri it
goes native.

## Next steps

1. **Follow-up task: Tauri desktop app** (ADR-003), via `/task`: native
   access to USB interface 3, read-only diagnostics first (ADR-006:
   0x00:0x81, 0x00:0x82), the request cycle of ADR-005, LampArray natively,
   a simulated keyboard behind the native transport for tests. Rewrite
   CLAUDE.md (description, Verify, DoD) for a desktop app; decide whether
   GitHub Pages stays.
2. **Checker follow-ups** (final panel, minor; journal
   `2026-10-15-protocol-reference-close.md`): report malformed prose
   citations; re-check in-repo `probe:` lock hashes in verify; record the
   CI dependency on the zexrox upstream.
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
