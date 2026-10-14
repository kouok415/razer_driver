# Protocol sources — Huntsman V3 Pro TKL (RZ03-0498)

Where protocol facts may come from, with reliability and license.
Last updated: 2026-10-14.

| Source | What it gives | Reliability | License / use |
|---|---|---|---|
| github.com/zexrox/huntsman-synapse-web | Working bridge for 1532:02A7 via interface 3; README lists features the 0498 firmware lacks (Game Mode key lock, single-key Snap Tap, Tournament Mode, analog report, bottom deadzone, Analog V3) | High for what it states; protocol bytes live in its source, not README (not yet read) | MIT — may adapt with attribution |
| synapse.razer.com (Synapse Web, beta since 2026-01) | Razer's own WebHID implementation for the Huntsman V3 Pro family (incl. 8KHz TKL, PID 02D0) — the most complete protocol reference | High for 02D0; transfer to 02A7 is `[HYPOTHESIS]`, partly supported by zexrox's bridge working | Proprietary — facts only, no code copying |
| OpenRazer wiki "Reverse Engineering USB Protocol" + driver source | Classic Razer 90-byte feature-report framing for older devices | Medium — whether V3 Pro uses the same framing is `[HYPOTHESIS]` | GPL-2.0 — facts only |
| OpenRGB issue #4418 | Confirms USB ID 1532:02A7 for the V3 Pro TKL (White) | High for the ID | n/a |
| Razer support a_id 20604 | Official Synapse Web device list | High | n/a |
