Task `protocol-reference` finished: the cited RZ03-0498 protocol reference merged to master (PR #3, merge 29c6afb) with green CI and a passing 3-lens final panel.

## Scoreboard numbers (from files)

- profile opus-tier, size L, 13 milestones (M1–M12 + M10a).
- gate_failures 1 (`gatelog` FAIL rows: M7, 2026-10-14). INTEGRITY 7:
  six while CURRENT still named `webhid-foundation` before its plan existed
  (mid-intake pause, before the rescope), one when `--sweep` ran on a
  non-task branch at close-out (2026-10-15). UNARMED 0.
- highest rung 3 (M1: three parallel worktree executors; winner r3-3
  strict canonical-form linter + r3-1's raw-HTML ban; `lessons.md`).
- interventions 4 (owner): the macOS HID dumps that forced the rescope
  from `webhid-foundation` (2026-10-14); running the WebUSB probe; choosing
  the desktop app (ADR-003); the protocol.md size-cap exception (ADR-004).
  The M11 ack was a planned checkpoint, not counted.
- duration 326 min: first task commit 894e9f1 to last 8fa77b9.
- `--sweep` exit 0 on `task/protocol-reference` (2026-10-15).

## Final panel (all PASS) — minor findings carried forward

- `tools/check-protocol-doc.mjs` ~:976-978: a malformed citation in plain
  prose is not reported (`findProseCitations(...).errors` is dropped); a
  well-formed fake one is still caught by the lock.
- Lock hashes of synapse / chromium / openrgb / probe citations are
  re-checked only with a local `--sources`; `probe:` files are in the repo,
  so verify could re-check those without downloads.
- `pages.yml`: deploys now depend on github.com/zexrox/huntsman-synapse-web
  staying reachable at the pinned commit; no ADR records that trade-off.
- `plan.md`, `brief.md` and `gatelog` contain machine-local scratchpad
  paths (noise, not secrets).
- PR #3 has no GitHub review record; owner approval is the `ack-M11` file
  plus the owner's instruction in session.

## Lessons that did not fit `lessons.md` (4 KB cap)

- A Synapse command name may not sit next to its triple (0x00:0xdb's name
  appears only in `getTournamentMode`'s send, ~@514041): find names through
  the method that sends the triple.
- `copy.py` diffs whole changed lines: editing one cell of an old table row
  re-checks the row's old text, so old verbatim runs surface as new hits.
- A subagent's claim about source text is unverified until a regex
  confirms it: the doc-fix executor's "usagePage near the other product-720
  configs" was false (verifier and orchestrator found none).
- An executor's prose about a probe step must match the capture: "6a sent
  GET_REPORT" was wrong — the browser refused it before transfer.
- Citation tokens containing key/token/secret next to a sha256 in
  `tools/citations.lock.json` trip gitleaks' generic-api-key rule; pick
  another word from the same identifier.
- The stop gate defers an in-progress verify once per executor spawn; a
  second stop while the executor runs is red — wait in-turn instead.
- Keep the final milestone's plan flip and the close-out on
  `task/<slug>`: `--sweep` refuses other branches, so close-out changes need
  a follow-up PR after the merge.
- `scripts/check-context-bulk.sh` is a claude-starter file; a starter sync
  could revert ADR-004's protocol.md exception.
