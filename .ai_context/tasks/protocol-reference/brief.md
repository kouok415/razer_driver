# Brief: protocol-reference (surveyed as webhid-foundation)
Surveyed 2026-10-14. `$S`=/tmp/claude-1000/-code-razer-driver/9f95b686-1bf0-4dae-a24a-b65ac47b4fc6/scratchpad (sources/ = untrusted data; read via `python3 -I`).

## Map
- src/hid/device.ts: VID/PID consts, DEVICE_FILTERS, detectWebHidSupport()
- src/App.tsx: single page, bilingual SUPPORT_TEXT, data-testid/data-status
- e2e/smoke.spec.ts: heading + data-status=supported
- playwright.config.ts: chromium vs `vite preview` :4173 (built dist)
- .github/workflows/pages.yml: Node 24, npm ci, zexrox citation check (pinned clone), verify, deploy dist on master
- tests/: claude-starter harness, NOT app tests
- $S/sources/zexrox @840f03dc (MIT): native/host.py = protocol (validate_packet, packet_checksum, EXTRA_READS names+sizes, translate_request/reply, BUSY poll); extension/virtual-hid.js = fake 02d0 navigator.hid + Synapse bundle patcher
- $S/sources/synapse-web/products720/main.2f427e06.js: 3056217 B, sha256 c1e6a425… (full: tools/sources.manifest.json), from synapse.razer.com/products/720/static/js/. Char offsets: device module 5315 @235199 (pid 720, claimInterface 3); transport module 17937 @400046: _calculateChecksum @430900, _getTransactionId @430969, _createDataSend @431065, connectDevice @431359, receiveFeatureReport @433158; reply/RZ_STATUS_DESC @520808; navigator.hid @2676260
- $S/sources/synapse-web/{raw,dashboard}: shell, AvailableDevices.json, AddDeviceTile chunk (requestDevice)

## Interfaces
- Per zexrox: feature report id 0, 90 B (hidapi 91 incl. id); fake collection usagePage 12 usage 1 [UNVERIFIED on real 02a7 via WebHID]
- Synapse filter: vendorId 5426, pid from AvailableDevices.json, usagePage in {12,1}; product UI in iframe /products/720/ allow="hid"

## Commands (run 2026-10-14; Node 24.16, Playwright 1.64.1)
- `npm run verify` (lint+check:protocol+test+build+e2e): PASS 2026-10-15, vitest 20/20, e2e 3/3
- `npm test` / `npm run e2e` / `npm run typecheck` / `npm run lint`
- .claude/hooks/lint.sh runs oxlint per edited .ts/.tsx

## Conventions
- 2-space, single quotes, no semicolons; named exports; comments cite protocol sources
- UI text `'中文 / English'` in const maps; no i18n lib yet
- tsconfig.app: erasableSyntaxOnly (no enum/namespace/param props), verbatimModuleSyntax (`import type`), noUnused*
- vitest picks only src/**/*.test.ts (not .tsx)

## Gotchas
- zexrox is NOT a WebHID client: Windows bridge (Chrome ext + Python hidapi) showing 02a7 to Synapse as 02d0. Its packets come from Synapse; host.py only validates/rewrites.
- Sources disagree: 0498 firmware lacks features (README list); host.py rewrites Snap Tap 02:a7/02:27 to 02:a1/02:21. Synapse = 02d0 superset; zexrox = 0498 truth.
- [SUPERSEDED 2026-10-14] macOS binds no driver to USB interface 3, so WebHID cannot see it: knowledge/hid-02a7-macos.txt.
- Synapse bundle: minified, not obfuscated. Offsets valid only for that sha256 (filename hash changes per deploy). Read the WebHID branch, not isElectron/native (`hid.sendFeatureReportInBatch`). Facts only.
- 02a7 (679) absent from AvailableDevices.json; only 720.
- Shell `grep` is ugrep: `.{0,200}` fails on the 3 MB bundle; use `python3 -I $S/tools/ctx.py W N REGEX FILE` / `count.py FILE REGEX...`.
- E2E fake navigator.hid must go in page.addInitScript; e2e serves built dist.
- OpenRazer framing: https://github.com/openrazer/openrazer/wiki/Reverse-Engineering-USB-Protocol

## Corrections
- 2026-10-14 (plan-critic): @520808 RZ_STATUS_DESC is module 18715 = BLE variant (var-length, other checksum) — do NOT cite for USB. USB: 17937 _getUSBTransferInResult @432623; status names module 64085 @1996551 (0 New Cmd,1 Busy,2 OK,3 Fail,4 Timeout,5 NotSupp); txId init module 5076 @221026. Product filter = usagePage 12 only (@2672178); isFeatureReportDevice @2677504. zexrox full sha 840f03dca68c7f7a3b8f867475a2c8e9a355a1bc. Details: plan.md milestone comments.
- 2026-10-14 (M2): `node --test tools/` needs tools/index.js (Node 24 runs a dir arg as a module). Manifest tools/sources.manifest.json, lock tools/citations.lock.json (cwd-relative).
