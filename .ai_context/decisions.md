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
