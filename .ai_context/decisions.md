<!--
purpose: Append-only log of design decisions (Architecture Decision Records).
mutability: append-only. Never edit or delete existing entries.
            If a decision is reversed, write a NEW entry that supersedes it.
format: each entry uses the template below. Most recent at the bottom.
do-not: don't put tentative ideas here (use state.md). don't paste implementation
        details (those live in code or knowledge/). keep entries to the
        decision and its rationale, not the work that followed.
teams:  if concurrent writers cause merge conflicts, switch to
        decisions/NNN-<slug>.md (one file per ADR) and note it in INDEX.md.
-->

# Architecture Decision Records

Each entry records a decision that shapes the project. New entries go at the
bottom. Existing entries are immutable; to change a past decision, write a
new entry that references and supersedes the old one.

---

## Template

```markdown
## ADR-NNN: <short title>

- **Date:** YYYY-MM-DD
- **Status:** Accepted | Superseded by ADR-NNN | Deprecated
- **Context:** What forced this decision? What was the situation?
- **Decision:** What did we decide?
- **Rationale:** Why this option over alternatives?
- **Alternatives considered:** What else was on the table, and why rejected.
- **Consequences:** What does this make easier? Harder? What are we
  committing to?
```

---

<!-- Add new ADRs below this line. Numbering starts at ADR-001. -->

## ADR-001: Static WebHID web app in TypeScript + React + Vite

- **Date:** 2026-10-14
- **Status:** Accepted
- **Context:** Owner's Razer Huntsman V3 Pro TKL (RZ03-0498, 1532:02A7)
  has no working configurator on macOS: Synapse does not run there, and
  Razer's Synapse Web lists only the 8KHz model (RZ03-0552). Owner asked
  for a "web driver" with Synapse-like features.
- **Decision:** A static, client-only web app using WebHID, written in
  TypeScript + React 19 + Vite, tested with Vitest (units) and Playwright
  (E2E in headless Chromium). Owner picked the stack from three options.
- **Rationale:** WebHID needs no kernel extension, installer or native
  helper on macOS; a static site can run from localhost or any HTTPS host.
  React was chosen over Svelte / plain TS for its ecosystem for complex
  editors (per-key keyboard layout, macro editor).
- **Alternatives considered:** Svelte + Vite (smaller bundles, smaller
  ecosystem); plain TS (state management too costly for this UI); native
  macOS app via IOKit or Electron + node-hid (rejected: owner asked for
  web, and install friction); porting zexrox's Chrome-extension + Python
  bridge that spoofs the device into Synapse Web (rejected: depends on
  Razer's site not changing, and needs Python + native messaging).
- **Consequences:** Chromium-only (no Firefox/Safari). Anything Synapse
  does in host software rather than firmware — animated Chroma effects,
  host-executed macros — only runs while the tab is open; onboard
  (firmware-stored) settings are the durable path.

## ADR-002: MIT license, public repo, GitHub Pages hosting

- **Date:** 2026-10-14
- **Status:** Accepted
- **Context:** Owner wants to open the configurator by URL rather than run
  it locally. The repo was private; GitHub Pages on the owner's plan
  requires a public repo (API returned 422 for the private one).
- **Decision:** Owner chose MIT, making the repo public, and GitHub Pages
  deployed by `.github/workflows/pages.yml` (verify → build → deploy on
  push to `master`; verify only on PRs). Vite `base: './'` so one build
  serves both localhost and the `/razer_driver/` project path. History was
  rewritten to replace a personal email with the GitHub noreply address
  before going public (owner-approved force-push).
- **Rationale:** MIT matches the main MIT protocol source
  (zexrox/huntsman-synapse-web). Public repo is the zero-cost way to get
  Pages; the code is meant to be open anyway.
- **Alternatives considered:** separate public repo holding only the build
  (needs a deploy token secret); GitHub Pro (paid); non-GitHub hosts
  (owner asked for GitHub).
- **Consequences:** Everything committed, including `.ai_context/`, is
  public — the H1/L1 rules and the gitleaks pre-commit hook carry real
  weight. Any client-side routing must be hash-based or relative.

## ADR-003: Native desktop app (Tauri) for the keyboard's control channel

- **Date:** 2026-10-15
- **Status:** Accepted (owner, 2026-10-15). Supersedes ADR-001's premise
  that a static WebHID page can reach the control channel; ADR-001's
  TypeScript + React + Vite UI stack stands.
- **Context:** Every setting beyond lighting (actuation, Rapid Trigger,
  Snap Tap, keymap, Hypershift, macros, profiles, polling, onboard effects)
  goes over 90-byte feature reports on USB interface 3. On macOS no HID
  driver binds to it (`knowledge/hid-02a7-macos.txt`; its only endpoint is
  interrupt OUT), so WebHID never lists it. The owner's read-only probe
  (Edge 153, `knowledge/webusb-probe-02a7-macos.txt`) showed WebUSB
  refusing the claim and every class GET_REPORT, as pinned Chromium code
  predicts (`knowledge/protocol.md` § Control interface).
- **Decision:** The follow-up task builds a Tauri desktop app for macOS
  that opens interface 3 natively (IOKit or libusb; claiming the
  driverless interface is [HYPOTHESIS] until tested). This was the owner's
  stated fallback, chosen before the probe ran.
- **Rationale:** No browser path reaches interface 3. Only LampArray
  lighting (interface 4) is reachable from WebHID.
- **Alternatives considered:** WebUSB (refused by Chromium); WebHID
  (interface 3 not enumerated); a web UI plus a local native helper, as
  zexrox does on Windows (still a native install, with two parts to ship
  and keep in sync).
- **Consequences:** Tauri's macOS webview has no WebHID, so the app drives
  lighting natively too. Distribution needs signing and notarization or a
  Gatekeeper override. CLAUDE.md's project description, Verify and DoD
  must be rewritten for a desktop app in the follow-up task, and the E2E
  simulator moves behind the native transport boundary. Whether the
  GitHub Pages build stays (e.g. probe page, lighting-only tool) is decided
  when that task is planned.
