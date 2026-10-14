# razer_driver

An unofficial, browser-based configurator ("web driver") for the **Razer
Huntsman V3 Pro Tenkeyless, RZ03-0498 (USB 1532:02A7)**, built because Razer
Synapse does not support it on macOS and Razer's own Synapse Web only lists
the 8KHz model (RZ03-0552). It is a static web app that talks to the
keyboard over WebHID (Chromium browsers only). Success = the owner can
configure, from a Mac, everything Synapse can configure on this keyboard
and its firmware actually implements: actuation / Rapid Trigger / Snap Tap,
RGB lighting, key remapping / Hypershift / macros, and onboard profiles,
polling rate and the rest. UI is bilingual (繁體中文 + English).

## Stack & layout

- **Language:** TypeScript (strict-ish: `noUnused*`, `erasableSyntaxOnly`)
- **Framework:** React 19 + Vite 8; WebHID types from `@types/w3c-web-hid`
- **Source layout:** `src/` app code (`src/hid/` = device transport and
  protocol), unit tests colocated as `src/**/*.test.ts`, browser E2E in
  `e2e/`. `tests/` belongs to the claude-starter harness — not app tests.
- **Package manager:** npm

## Commands

- **Install:** `npm install && npx playwright install chromium`
- **Dev:** `npm run dev` → http://localhost:5173 (localhost counts as a
  secure context, which WebHID requires)
- **Test:** `npm test` (Vitest)
- **Lint:** `npm run lint` (oxlint)
- **Build:** `npm run build` (`tsc -b` + Vite)
- **Deploy:** merge to `master` → `.github/workflows/pages.yml` runs
  verify, then publishes `dist/` to https://kouok415.github.io/razer_driver/
  (PRs run verify only). The repo is public: nothing private gets committed.
- **Verify:** `npm run verify` — lint → unit tests → production build →
  Playwright E2E against the built app in headless Chromium. Once the
  simulated keyboard exists, E2E drives each feature through a fake
  `navigator.hid` and asserts on the exact bytes sent.

This machine has no Razer keyboard attached. **Hardware verification is
manual, by the owner, on macOS** — see Definition of done.

## Definition of done

- `npm run verify` passes — run it and state the result.
- Every protocol encoder/decoder has unit tests against golden packets, and
  each golden packet cites its source (see Project rules).
- A UI feature has an E2E test that exercises it against the simulated
  keyboard, and every new UI string exists in both `zh-Hant` and `en`.
- A change that sends new bytes to the device is reported as **"unverified
  on hardware"** until the owner confirms it on the real keyboard; record
  pending hardware checks in `.ai_context/state.md`.
- `.ai_context/state.md` updated if project state changed; ADR appended to
  `.ai_context/decisions.md` if a design decision was made.

"Should work" is not done. Unverified work is reported as unverified.

## Project rules

- **No invented protocol.** Every command class/ID, report layout and value
  encoding must cite where it came from (source file + location, bundle +
  function, or a capture). Unconfirmed fields are tagged `[HYPOTHESIS]` in
  code comments and `knowledge/`.
- **Hardware safety.** Never send firmware-update / bootloader / DFU
  commands, and never expose them in the UI. The first contact with any new
  command is a read; writes come only after the read round-trips. Keep a
  path back to factory defaults.
- **Clean-room sourcing.** Razer's Synapse Web bundle (proprietary) and
  OpenRazer (GPL-2.0) are read for protocol *facts* only — never copy their
  code. MIT-licensed sources may be adapted with attribution.
- **RZ03-0498 firmware limits are real.** Features its firmware lacks (e.g.
  Snap Tap single-key, Tournament Mode, analog report — per
  zexrox/huntsman-synapse-web) are not faked; the UI says they are
  unsupported.

## Memory & mechanisms

- `.ai_context/` is this project's persistent memory; `INDEX.md` is the
  authority for what lives where and when to read it.
- Run `/wrap` at the end of a session to write memory back.
- `.claude/hooks/lint.sh` runs oxlint on every edited `.ts`/`.tsx` file.

## Long-horizon tasks

- Any task expected to exceed ~30 minutes of autonomous work goes through
  `/task <description>` — the skill carries the full protocol.
- Task work happens on a `task/<slug>` branch; every passed gate is a commit.
- Profile is auto-detected and frozen per task. To pin it for this project,
  uncomment one:
  <!-- Task profile: opus-tier -->
  <!-- Task profile: fable-tier -->
  <!-- Task profile: mixed  (apply with: bash scripts/task-profile.sh mixed) -->
  <!-- Task profile: mixed-judge  (apply with: bash scripts/task-profile.sh mixed-judge) -->
