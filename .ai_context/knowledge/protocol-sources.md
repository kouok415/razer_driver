# Protocol sources — Huntsman V3 Pro TKL (RZ03-0498)

Where protocol facts may come from, with reliability and license.
Last updated: 2026-10-15.
The protocol reference built from these sources, with a citation for every fact, is `protocol.md` (checked by `npm run check:protocol`).

| Source | What it gives | Reliability | License / use |
|---|---|---|---|
| github.com/zexrox/huntsman-synapse-web | Working bridge for 1532:02A7 via interface 3; README lists features the 0498 firmware lacks (Analog V3, Tournament Mode, single-key Snap Tap, analog report, bottom dead-zone, Game Mode key lock) | High for what it states; protocol bytes live in its source, not README; source read, pinned at commit 840f03dca68c7f7a3b8f867475a2c8e9a355a1bc | MIT — may adapt with attribution |
| synapse.razer.com (Synapse Web, beta since 2026-01) | Razer's own WebHID implementation for the Huntsman V3 Pro family (incl. 8KHz TKL, PID 02D0) — the most complete protocol reference | High for 02D0; transfer to 02A7 is `[HYPOTHESIS]`, partly supported by zexrox's bridge working | Proprietary — facts only, no code copying |
| OpenRazer wiki "Reverse Engineering USB Protocol" + driver source | Classic Razer 90-byte feature-report framing for older devices | Medium — whether V3 Pro uses the same framing is `[HYPOTHESIS]` | GPL-2.0 — facts only |
| OpenRGB issue #4418 | Confirms USB ID 1532:02A7 for the V3 Pro TKL (White) | High for the ID | n/a |
| Chromium source (chromium.googlesource.com/chromium/src) | What WebHID and WebUSB let a page reach: the HID blocklist, protected USB classes and their control-transfer rules | Exact for the pinned commit 1aeca202fed13742d05b130fcb49e418f98fc4ca; the owner's Chrome build and field trials may differ | BSD-3-Clause — facts only |
| HID Usage Tables 1.5 (USB-IF PDF, usb.org/sites/default/files/hut1_5.pdf) | LampArray usage page 0x59: field names and roles | High for the standard; cited by URL only, not hash-checked | USB-IF publication — cited by URL only |
| Owner's macOS HID dump (.ai_context/knowledge/hid-02a7-macos.txt) | The real 02A7's USB interfaces and the HID collections macOS exposes | High: a real 02A7 | In repo (owner's capture) |
| Owner's WebUSB probe run (.ai_context/knowledge/webusb-probe-02a7-macos.txt) | 2026-10-15, Edge 153 on macOS: interface-3 claim and reads refused; a report descriptor read with recipient device ([HYPOTHESIS] interface 3's) | High: a real 02A7 | In repo (owner's capture) |
| Razer support a_id 20604 | Official Synapse Web device list | High | n/a |
