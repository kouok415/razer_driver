# Huntsman V3 Pro TKL (RZ03-0498, USB 1532:02A7): control protocol

Last updated: 2026-10-14.

A cited reference for the keyboard's vendor control channel. It is checked by
`tools/check-protocol-doc.mjs`: every fact carries a citation, and every
citation resolves against pinned copies of the sources (see Sources). It does
not depend on how the host reaches the device (WebUSB, WebHID or a native HID
library); access-layer details are called out where they matter.

Synapse targets 02D0 (superset); zexrox runs against a real 0498.

- Synapse Web is Razer's own web configurator. The bundle cited here is the one
  it serves for the Huntsman V3 Pro 8KHz TKL (product 720 in its path; 720 is 0x02D0 in decimal), a
  superset of this keyboard. It is the fullest description of the protocol, but
  nothing in it is proven for 02A7.
- zexrox/huntsman-synapse-web is a bridge that opens a real 1532:02A7 on USB
  interface 3 and shows it to Synapse as 02D0
  (zexrox:native/host.py:457@840f03dc, zexrox:native/host.py:472@840f03dc).
  Where the two sources disagree, zexrox describes this firmware.

Citation formats (a Source cell holds one or more, separated by "; "):

```text
zexrox:<path>:<line>[-<line>]@840f03dc[#<token>]  lines of that zexrox file at commit 840f03dc; the token must occur in them
synapse:<sha256 prefix>@<offset>#<token>           the token starts at that code-point offset of the bundle file with that sha256
chromium:<path>:<line>@1aeca202#<token>            that line of the Chromium file at commit 1aeca202; the token must occur in it
probe:<repo path>#<key>                            the first line of that file in this repo that contains the key
openrgb#4418:<text>                                text that occurs in the saved OpenRGB issue 4418 thread
url:<https URL>                                    background reference only; never resolved
```

Confidence: `confirmed` = seen on a real 02A7 (the owner's macOS dump, or
zexrox running against one) or stated by two independent sources that agree;
`likely` = one source only (Synapse, zexrox's code, Chromium at the pinned
commit, or OpenRGB); `[HYPOTHESIS]` = this document's inference or choice.

## Framing

Every request and every reply is one HID feature report with report ID 0 and
90 data bytes. The host writes the request with SET_REPORT and fetches the
reply with GET_REPORT on the same report; the exchange uses no interrupt
endpoint and no open handshake (Synapse's WebHID connect step only opens
the device: synapse:c1e6a425@431365#connectDevice). zexrox accepts nothing but
report ID 0 (zexrox:native/host.py:502-503@840f03dc).

Access-layer detail: hidapi buffers carry the report ID as a leading byte, so
they are 91 bytes long. zexrox prepends 0x00 when writing
(zexrox:native/host.py:532@840f03dc), asks for 91 bytes when reading and drops
the leading 0x00 (zexrox:native/host.py:410@840f03dc,
zexrox:native/host.py:415-417@840f03dc). WebHID passes the report ID as a
separate argument when sending (synapse:c1e6a425@438784#sendFeatureReport);
when a received report arrives as 91 bytes, Synapse drops its first byte
(synapse:c1e6a425@433224#91). Synapse builds its byte view from the returned
DataView's whole underlying buffer and ignores the view's byte offset
(synapse:c1e6a425@433211#e.buffer). [HYPOTHESIS] A port should respect the
offset.

The checksum and the transaction byte are described in the table and in
Transaction and status. Byte numbers are 0-based within the 90 data bytes.

| Offset | Size | Field | Meaning | Source | Confidence |
|---|---|---|---|---|---|
| 0 | 1 | Status | Request: always 0x00. Reply: the status code (see Status codes). | synapse:c1e6a425@431065#_createDataSend; synapse:c1e6a425@432629#_getUSBTransferInResult; zexrox:native/host.py:112@840f03dc | confirmed |
| 1 | 1 | Transaction ID | Picked by the host for each request (see Transaction ID); the reply carries the same value back. | synapse:c1e6a425@430969#_getTransactionId; synapse:c1e6a425@433425#different; zexrox:native/host.py:426@840f03dc | confirmed |
| 2-3 | 2 | Remaining packets (unused) | 0x00 0x00 in every request either source builds; zexrox refuses a request with anything else here. OpenRazer's notes on older Razer devices name these two bytes remaining packets. | synapse:c1e6a425@431065#_createDataSend; zexrox:native/host.py:112@840f03dc; url:https://github.com/openrazer/openrazer/wiki/Reverse-Engineering-USB-Protocol | confirmed |
| 4 | 1 | Protocol type (unused) | 0x00 in every request either source builds; zexrox refuses other values. OpenRazer's notes name this byte protocol type. | synapse:c1e6a425@431065#_createDataSend; zexrox:native/host.py:112@840f03dc; url:https://github.com/openrazer/openrazer/wiki/Reverse-Engineering-USB-Protocol | confirmed |
| 5 | 1 | Data size | Number of meaningful bytes starting at offset 8. A request may use at most 80 (zexrox refuses more). Synapse copies at most this many argument bytes into a request, and takes a reply's data as this many bytes from offset 8. | synapse:c1e6a425@431065#_createDataSend; synapse:c1e6a425@432629#_getUSBTransferInResult; zexrox:native/host.py:112@840f03dc | confirmed |
| 6 | 1 | Command class | Selects the command group; the reply repeats it. | synapse:c1e6a425@431065#_createDataSend; synapse:c1e6a425@433547#c; zexrox:native/host.py:111@840f03dc; zexrox:native/host.py:426@840f03dc | confirmed |
| 7 | 1 | Command ID | Selects the command inside the class; the reply repeats it. | synapse:c1e6a425@431065#_createDataSend; synapse:c1e6a425@433672#different; zexrox:native/host.py:111@840f03dc; zexrox:native/host.py:426@840f03dc | confirmed |
| 8-87 | 80 | Arguments or data | Request: command arguments, with bytes past the data size left 0x00. Reply: returned data. | synapse:c1e6a425@431065#_createDataSend; zexrox:native/host.py:143-149@840f03dc | confirmed |
| 88 | 1 | Checksum | XOR of bytes 2 through 87; bytes 0, 1 and 89 are not included. Both sources compute it for requests, and zexrox refuses a request whose checksum is wrong. Neither source checks it on replies (see Request cycle). | synapse:c1e6a425@430900#_calculateChecksum; zexrox:native/host.py:129-133@840f03dc#packet_checksum; zexrox:native/host.py:114-118@840f03dc | confirmed |
| 89 | 1 | Reserved | 0x00. Synapse never writes it (its request buffer starts zeroed); zexrox refuses a request where it is not zero. | synapse:c1e6a425@431065#_createDataSend; zexrox:native/host.py:112@840f03dc | confirmed |

## Transaction and status

### Status codes

Byte 0 of a reply. The names are Synapse's status-description table
(synapse:c1e6a425@1996551#RZ_STATUS_DESC), an array indexed by the code
(synapse:c1e6a425@1997872#J). "Synapse" below means the reply reader of its USB
transport (synapse:c1e6a425@432629#_getUSBTransferInResult). zexrox gives names
only to 0x01, 0x02 and 0x05 (zexrox:native/host.py:543@840f03dc).

| Code | Name | Meaning | Source | Confidence |
|---|---|---|---|---|
| 0x00 | New Command | The value byte 0 holds in every request. As a reply status, Synapse marks the exchange failed, stops reading and writes the request again; zexrox treats it like any non-busy status and hands the reply back. The sources disagree on its meaning as a reply. [HYPOTHESIS] This repo treats it as pending while bytes 1, 6 and 7 match the request (see Request cycle). | synapse:c1e6a425@1997876#New; synapse:c1e6a425@433870#ERROR_USB_TRANSFER_IN_NEW_COMMAND; zexrox:native/host.py:436@840f03dc | likely |
| 0x01 | Command Busy | Still working on the command. Synapse reads again up to its read limit and writes the request again if the status never changes; zexrox keeps re-reading the same report and never writes again. | synapse:c1e6a425@1997898#Busy; synapse:c1e6a425@433977#ERROR_USB_TRANSFER_IN_BUSY; zexrox:native/host.py:221@840f03dc#BUSY_STATUS | confirmed |
| 0x02 | Command Successful | Finished. The reply data is byte 5 bytes long, starting at offset 8. Neither source writes again. | synapse:c1e6a425@1997913#Successful; synapse:c1e6a425@434171#STATUS_SUCCESS; zexrox:native/host.py:97@840f03dc#SUCCESS_STATUS; zexrox:native/host.py:543@840f03dc | confirmed |
| 0x03 | Command Failure | The command failed. Synapse writes the request again. | synapse:c1e6a425@1997934#Failure; synapse:c1e6a425@434270#ERROR_USB_TRANSFER_IN_FAILED | likely |
| 0x04 | Command No Response Timeout | Synapse's table spells it with a stray trailing 1. Synapse writes the request again, except for one device-mode command on devices flagged to take that timeout as success. | synapse:c1e6a425@1997964#Timeout1; synapse:c1e6a425@434683#ERROR_USB_TRANSFER_IN_TIMEOUT | likely |
| 0x05 | Command Not Support | The firmware does not implement this class or command. Final: Synapse does not write again; zexrox logs it as not supported. | synapse:c1e6a425@1997983#Not; synapse:c1e6a425@434906#ERROR_USB_TRANSFER_IN_COMMAND_NOT_SUPPORTED; zexrox:native/host.py:543@840f03dc | confirmed |
| 0x06 | Profile Not Support | Named in Synapse's table only. Its USB reader treats every code above 0x05 as an unknown failure and does not write again. | synapse:c1e6a425@1998024#Profile; synapse:c1e6a425@435162#ERROR_USB_TRANSFER_IN_COMMAND_UNKNOWN | likely |
| 0x07 | Target ID Not Support | As 0x06: name only, unknown failure, no rewrite. | synapse:c1e6a425@1998046#Target; synapse:c1e6a425@435162#ERROR_USB_TRANSFER_IN_COMMAND_UNKNOWN | likely |
| 0x08 | Command Grab Control | As 0x06: name only, unknown failure, no rewrite. | synapse:c1e6a425@1998078#Grab; synapse:c1e6a425@435162#ERROR_USB_TRANSFER_IN_COMMAND_UNKNOWN | likely |
| 0x09 | Command Not Support (current device mode) | As 0x06: name only, unknown failure, no rewrite. | synapse:c1e6a425@1998124#Device; synapse:c1e6a425@435162#ERROR_USB_TRANSFER_IN_COMMAND_UNKNOWN | likely |
| 0x0a | Command Broadcast | As 0x06: name only, unknown failure, no rewrite. | synapse:c1e6a425@1998146#Broadcast; synapse:c1e6a425@435162#ERROR_USB_TRANSFER_IN_COMMAND_UNKNOWN | likely |
| 0x0b | Command Unknown | As 0x06: name only, unknown failure, no rewrite. | synapse:c1e6a425@1998166#Unknown; synapse:c1e6a425@435162#ERROR_USB_TRANSFER_IN_COMMAND_UNKNOWN | likely |

### Transaction ID

Byte 1 of a request; the device repeats it in byte 1 of the reply.

- Synapse keeps one counter per device object. Each request takes the
  counter's current value and then increments it; when the counter has
  reached 31 it first drops back to 0. The IDs sent therefore run 0, 1, ...,
  30, 0, 1, ... and 31 is never sent
  (synapse:c1e6a425@430969#_getTransactionId). The counter starts at 0 in the
  shared device base class when the device object is created, so on the
  WebHID path (no handshake) the first two requests carry 0 and 1
  (synapse:c1e6a425@221026#this.transactionId).
- A reply whose byte 1 differs from the request is not the answer to it.
  Synapse then writes the request again
  (synapse:c1e6a425@433425#different); zexrox reads the report again without
  writing (zexrox:native/host.py:426@840f03dc).
- Whether the firmware limits the range is not established: zexrox's own
  LED write uses a separate counter that cycles 1 to 255
  (zexrox:native/host.py:442@840f03dc). [HYPOTHESIS] This repo follows
  Synapse's 0 to 30 sequence, starting at 0 (a repo choice).

### Request cycle

What the sources do:

- Synapse, WebHID path of its USB transport: up to MAX_RETRY_OUT times it
  writes the report (synapse:c1e6a425@438620#maxRetryOut,
  synapse:c1e6a425@438784#sendFeatureReport), waits SLEEP_TIME_BETWEEN_OUT_IN
  (synapse:c1e6a425@438835#sleepTimeBetweenOutIn), then reads up to
  MAX_RETRY_IN times with SLEEP_TIME_BETWEEN_IN between reads
  (synapse:c1e6a425@432629#_getUSBTransferInResult). It stops on success or
  on a failure that does not ask for a rewrite
  (synapse:c1e6a425@438964#resendOutCommand). It writes again on status 0x00,
  0x03 or 0x04, when 0x01 outlasts every read, and when byte 1, 6 or 7 of the
  reply differs from the request (synapse:c1e6a425@433425#different,
  synapse:c1e6a425@433547#c, synapse:c1e6a425@433672#different). The shared
  defaults are 5, 5, 10 and 20 for the out-to-in wait, the between-reads wait,
  the read limit and the write limit (synapse:c1e6a425@1996817#SLEEP_TIME_BETWEEN_OUT_IN,
  synapse:c1e6a425@1996723#SLEEP_TIME_BETWEEN_IN,
  synapse:c1e6a425@1996258#MAX_RETRY_IN,
  synapse:c1e6a425@1996277#MAX_RETRY_OUT, synapse:c1e6a425@1997114#u); the
  transport's constructor takes them as defaults
  (synapse:c1e6a425@426895#SLEEP_TIME_BETWEEN_OUT_IN,
  synapse:c1e6a425@427061#MAX_RETRY_IN, synapse:c1e6a425@427133#MAX_RETRY_OUT).
  The waits go to a delay helper whose unit is not checked here, and whether
  the 02D0 device code overrides these defaults is not checked either.
- zexrox, against a real 02A7: writes the request once
  (zexrox:native/host.py:532@840f03dc), then every 20 ms reads the report
  again (zexrox:native/host.py:420-437@840f03dc#await_feature_reply). A reply
  whose byte 1 or bytes 6 and 7 differ belongs to an earlier exchange still
  sitting in the report, so it re-reads without writing; status 0x01 also
  means re-read; any other status ends the wait. After 0.5 s a mismatched
  reply is an error and a busy reply is returned as it is. Its comment states
  the rule: never write the report again
  (zexrox:native/host.py:216-223@840f03dc#BUSY_POLL_SECONDS).
- Reply checksum: neither source checks it. Synapse's reader compares only
  bytes 0, 1, 6 and 7 (synapse:c1e6a425@432629#_getUSBTransferInResult), and
  zexrox's wait loop the same bytes
  (zexrox:native/host.py:426-436@840f03dc).

Recommendation for this repo, [HYPOTHESIS] as a whole: a repo choice recorded
in the task spec's assumptions and pending the owner's review; the follow-up
transport task implements it. Send once, re-read only, never resend.

1. Build the request (byte 0 = 0x00, next transaction ID, size, class, ID,
   arguments, checksum) and write it once with SET_REPORT, report ID 0.
2. Every 20 ms, re-read with GET_REPORT for at most 0.5 s in total; these two
   numbers come from zexrox, the only source run against a real 02A7
   (zexrox:native/host.py:222-223@840f03dc#BUSY_POLL_INTERVAL). Synapse's
   waits (their unit is not checked) are not used; [HYPOTHESIS] they are
   tuned for a loop that rewrites.
3. If byte 1, 6 or 7 differs from the request, the report still holds an
   older exchange: re-read.
4. If the header matches and the status is 0x00 or 0x01, the command is
   pending: re-read. Treating 0x00 as pending is `[HYPOTHESIS]`: a matching
   header with status 0x00 most likely means the report still holds the
   request itself, but neither source handles it this way (Synapse rewrites,
   zexrox returns it).
5. Any other status with a matching header is final: 0x02 is success, with
   byte 5 giving the data length; every other code is reported to the caller
   as a failure under its name from Status codes.
6. When the budget runs out, report a timeout. Never write the request again.
7. Compute the reply checksum and record a mismatch as a diagnostic; never
   reject a reply on it until hardware evidence says otherwise.

## Control interface

How a host reaches the 90-byte control channel this document describes, what
each of the keyboard's six USB interfaces carries on macOS, and what Chrome
lets a web page open. Confidence tags follow the definition at the top of
this document.

02A7 status: [UNVERIFIED] for the interface-3 control channel on macOS; no transport has reached it yet.

| Claim | Source | Confidence |
|---|---|---|
| On the owner's Mac, USB interface 3 has no driver attached: no HID device and no user client, so it is absent from the system's HID device list. | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3 | confirmed |
| Interfaces 0, 1 and 2 also carry a Razer DriverKit event service on that Mac; interfaces 4 and 5 (5 is the vendor-page interface) have the Apple HID driver only. | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@0; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@1; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@2; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@4; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@5 | confirmed |
| The largest feature report macOS exposes is on interface 4 (LampArray): the dump's MaxFeatureReportSize of 51 is report 4's 50 data bytes (see the table below) plus the report-ID byte. No exposed interface has the 90-byte report-ID-0 control report. | probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-lamparray; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@4; zexrox:native/host.py:446@840f03dc#send_feature_report | confirmed |
| WebHID can only offer collections the OS HID stack exposes, so a page on macOS cannot pick interface 3. | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3; url:https://wicg.github.io/webhid/ | [HYPOTHESIS] |
| zexrox, against a real 02A7 on Windows, keeps only the interface-3 collections of 1532:02A7 (interface number 3, or mi_03 in the path), refuses to open unless exactly one matches, and never looks at its usage page. There it uses report-ID-0 feature reports: it writes the ID byte plus 90 B, and reads by asking for 91 B, taking either 91 B that start with ID 0 (the ID byte is dropped) or a bare 90 B. | zexrox:native/host.py:455-464@840f03dc#mi_03; zexrox:native/host.py:446@840f03dc#send_feature_report; zexrox:native/host.py:408-418@840f03dc#get_feature_report | confirmed |
| zexrox also watches interface 1 for the Fn key. Per its notes the 48-byte interrupt payload on endpoint 0x82 begins with report ID 0x04 (the dump's 47 B input plus the ID byte), and the byte after it is 1 while Fn is held. It opens every mi_01 collection, keeps the one that delivers that report, closes the others, and never opens interface 0; Fn+F10 switches a lock of its own on the Windows side. | zexrox:native/host.py:225-229@840f03dc#0x82; zexrox:native/host.py:319-333@840f03dc#mi_01; zexrox:native/host.py:707-762@840f03dc#_acquire_fn_reader; zexrox:native/host.py:560@840f03dc#F10; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-multi | confirmed |
| Synapse (for 02D0) matches WebHID devices on vendor ID, its product IDs and a usage page. The default usage page is 12 (0x0C, Consumer), a bundle constant exported as MU; the device config may replace it and add a usage, and the 02D0 config was not read. Its feature-report device is an unopened match with exactly one collection, on that usage page, which has the configured usage or, when no usage is configured, at least one feature report. | synapse:c1e6a425@2672184#usagePage; synapse:c1e6a425@545501#MU; synapse:c1e6a425@545646#12; synapse:c1e6a425@2679560#usagePage; synapse:c1e6a425@2677504#isFeatureReportDevice | likely |
| For hardware events Synapse first reuses the feature-report device: it keeps that device unless its first collection's input-report list is empty. zexrox's fake 02D0 lists an input report on its single collection so that this listener attaches there. | synapse:c1e6a425@2676118#connectHardwareEventDevice; zexrox:extension/virtual-hid.js:224-226@840f03dc#inputReports | confirmed |
| Only when that list is empty does Synapse search the devices the page already holds permission for (getDevices) for one that is unopened, has the vendor ID and a known product ID, a non-empty product name, more than one collection and at least one collection with input reports; it then opens that device and listens to its input reports. | synapse:c1e6a425@2676118#connectHardwareEventDevice; synapse:c1e6a425@2676274#getDevices; synapse:c1e6a425@2676390#productName | likely |
| zexrox's fake 02D0 shows Synapse one collection (usage page 12, usage 1) with input report 1 and a 90-byte feature report 0: the shape Synapse looks for, not the real 02A7 layout. On the real keyboard zexrox needs exactly one interface-3 collection and never checks its usage page, so interface 3's usage page is unknown. Of the five interfaces macOS exposes, none is a lone usage-page-12 collection; interface 1 has 0x0C/0x01 as one of seven. | zexrox:extension/virtual-hid.js:224-235@840f03dc#usagePage; zexrox:native/host.py:455-464@840f03dc#mi_03; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-multi; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3 | likely |
| Chrome's WebHID always protects the Keyboard/Keypad usage page, and Generic Desktop Pointer, Mouse, Keyboard and Keypad collections for input and output reports; feature reports of those four are not protected. | chromium:services/device/public/cpp/hid/hid_report_utils.cc:41@1aeca202#kPageKeyboard; chromium:services/device/public/cpp/hid/hid_report_utils.cc:53@1aeca202#kFeature | likely |
| That built-in rule (IsAlwaysProtected) also fully protects two Generic Desktop ranges: System Control, usages 0x80 to 0x8F, and System Dock to System Display Swap, 0xA0 to 0xB6. It protects no other usage page. | chromium:services/device/public/cpp/hid/hid_report_utils.cc:56@1aeca202#kGenericDesktopSystemControl; chromium:services/device/public/cpp/hid/hid_report_utils.cc:61@1aeca202#kGenericDesktopSystemDock; chromium:services/device/public/cpp/hid/hid_report_utils.cc:45@1aeca202#kPageGenericDesktop; chromium:services/device/public/mojom/hid.mojom:86@1aeca202#kGenericDesktopSystemControl; chromium:services/device/public/mojom/hid.mojom:101@1aeca202#kGenericDesktopSystemWarmRestart; chromium:services/device/public/mojom/hid.mojom:108@1aeca202#kGenericDesktopSystemDock; chromium:services/device/public/mojom/hid.mojom:123@1aeca202#kGenericDesktopSystemDisplaySwap | likely |
| Separately, a WebHID connection refuses every report the HID blocklist matches. The blocklist's built-in entries cover the FIDO usage page (0xF1D0) on every device, 45 security-key vendor and product pairs (whole devices), and one vendor-page output report of vendor 0x0B0E; none names Razer's vendor ID 0x1532, so neither rule protects the 02A7's 0x59 lighting page or its 0xFF00 vendor page. A field-trial parameter can add entries; none was read. | chromium:services/device/hid/hid_connection.cc:166@1aeca202#IsReportProtected; chromium:services/device/hid/hid_connection.cc:193@1aeca202#blocklist; chromium:services/device/public/cpp/hid/hid_blocklist.cc:40@1aeca202#kPageFido; chromium:services/device/public/cpp/hid/hid_blocklist.cc:44@1aeca202#VENDOR_PRODUCT_RULE; chromium:services/device/public/mojom/hid.mojom:49@1aeca202#kPageFido; chromium:services/device/public/cpp/hid/hid_blocklist.cc:109@1aeca202#0x0b0e; chromium:services/device/public/cpp/hid/hid_blocklist.cc:236@1aeca202#kWebHidBlocklistAdditions | likely |
| WebHID decides protection per report ID and report type. With recursive filtering, on by default, a report is protected when any application collection that holds it, top-level or nested, matches the built-in rule. | chromium:services/device/public/cpp/hid/hid_report_utils.cc:131@1aeca202#kHIDCollectionTypeApplication; chromium:services/device/public/cpp/hid/hid_report_utils.cc:132@1aeca202#IsAlwaysProtected; chromium:services/device/public/cpp/hid/hid_report_utils.cc:137@1aeca202#HasReportInAlwaysProtectedCollection; chromium:services/device/hid/hid_connection.cc:220@1aeca202#kWebHidRecursiveFiltering; chromium:services/device/public/cpp/device_features.cc:140@1aeca202#kWebHidRecursiveFiltering | likely |
| WebUSB's protected interface classes are audio, HID, mass storage, smart card, video, audio/video and wireless controller; claiming one fails with a SecurityError. | chromium:content/browser/usb/web_usb_service_impl.cc:249@1aeca202#kUsbHidClass; chromium:services/device/usb/mojo/device_impl.cc:512@1aeca202#kProtectedClass; chromium:third_party/blink/renderer/modules/webusb/usb_device.cc:1008@1aeca202#kProtectedInterfaceClassError | likely |
| Chrome changes that class list only for extension origins; an Isolated Web App holding the usb-unrestricted permission (behind a feature flag) has no protected classes. A normal web page is neither. | chromium:chrome/browser/usb/chrome_usb_delegate.cc:183@1aeca202#AdjustProtectedInterfaceClasses; chromium:content/browser/usb/web_usb_service_impl.cc:262@1aeca202#kUsbUnrestricted | likely |
| A WebUSB control transfer with recipient "interface" needs that interface claimed first (checked in Blink); recipient "device" needs no claim. | chromium:third_party/blink/renderer/modules/webusb/usb_device.cc:856@1aeca202#EnsureInterfaceClaimed | likely |
| The device service refuses a class request with recipient "device" when any interface of the active configuration is in a protected class. HID GET_REPORT and SET_REPORT are class requests (HID 1.11, section 7.2), and all six 02A7 interfaces are HID class. The check runs only while the protected-class control-transfer flag is on, its default at the pinned commit. Chromium commit 89b42d2d33 (main position 1601756, 2026-03-19) added that flag and began refusing vendor and class requests with recipient device whose wIndex low byte names a protected interface; before it, device-recipient requests were not checked. Commit b334f9d5a8 (main position 1658378, 2026-07-07) widened the class-request refusal to any wIndex on a device with a protected interface. The probe's 6b names interface 3 in wIndex, so 89b42d2d33 is the cut-off for it: by chromiumdash branch positions M147 branched before that commit and M148 after, so M148 is the first milestone that refuses 6b ([HYPOTHESIS] unless it was merged back to M147). | chromium:services/device/usb/mojo/device_impl.cc:353@1aeca202#HasProtectedInterface; chromium:services/device/usb/mojo/device_impl.cc:238@1aeca202#FindBlockedClass; chromium:services/device/usb/mojo/device_impl.cc:224@1aeca202#kWebUsbProtectedClassControlTransferBlock; chromium:services/device/public/cpp/device_features.cc:56@1aeca202#kWebUsbProtectedClassControlTransferBlock; chromium:services/device/public/cpp/device_features.cc:57@1aeca202#FEATURE_ENABLED_BY_DEFAULT; url:https://www.usb.org/sites/default/files/hid1_11.pdf; url:https://chromium.googlesource.com/chromium/src/+/89b42d2d3326ebad6e0494009d5d92f2dbaf12ef; url:https://chromium.googlesource.com/chromium/src/+/b334f9d5a8d0a54b39b0f17aa2149cdb3fd7feab; url:https://chromiumdash.appspot.com/fetch_milestones; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@0; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@1; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@2; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@4; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@5 | likely |
| In the device service, vendor-type requests with recipient "device" are always allowed. A standard GET_DESCRIPTOR read (device to host) passes for any recipient while the standard-request allowlist flag is on, its default at the pinned commit; with that flag off it passes for recipient device or other, and interface or endpoint recipients go through the protected-class check. Blink's claim check applies before either. | chromium:services/device/usb/mojo/device_impl.cc:392@1aeca202#kAllowed; chromium:services/device/usb/mojo/device_impl.cc:277@1aeca202#kWebUsbEnforceStandardRequestAllowlist; chromium:services/device/usb/mojo/device_impl.cc:285@1aeca202#kUsbRequestGetDescriptor; chromium:services/device/usb/mojo/device_impl.cc:295@1aeca202#DEVICE; chromium:services/device/usb/mojo/device_impl.cc:301@1aeca202#INTERFACE; chromium:services/device/public/cpp/device_features.cc:63@1aeca202#kWebUsbEnforceStandardRequestAllowlist; chromium:services/device/public/cpp/device_features.cc:64@1aeca202#FEATURE_ENABLED_BY_DEFAULT | likely |
| OpenRGB issue 4418 (02A7 lighting support) has no USB or HID descriptor dump: its body gives one Windows HidUsb device path, on interface MI_02, and links six captures taken with Razer's software; no note holds lsusb output or a report descriptor. | openrgb#4418:MI_02 | likely |

### Interfaces on macOS

The owner's Mac lists five HID devices for the keyboard; USB interface 3 is the
missing one. Sizes are as decoded in the dump.

| Interface | Class | Driver | Usage page/usage | Reports | Source |
|---|---|---|---|---|---|
| 0 | 3 (HID) | Apple HID driver + Razer DriverKit event service | 0x01/0x06 boot keyboard | input 8 B, output 1 B, no report IDs | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@0; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-boot |
| 1 | 3 (HID) | Apple HID driver + Razer DriverKit event service | seven top-level collections: 0x01/0x06, 0x0C/0x01, 0x01/0x80, four of 0x01/0x00 | 47 B inputs with IDs 1, 2, 3, 4, 5, 7, 11; output ID 1 (1 B) | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@1; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-multi |
| 2 | 3 (HID) | Apple HID driver + Razer DriverKit event service | 0x01/0x02 mouse | input 8 B | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@2; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-mouse |
| 3 | 3 (HID) | none bound | not exposed | not visible to the HID stack | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3 |
| 4 | 3 (HID) | Apple HID driver | 0x59/0x01 LampArray | feature IDs 1 to 6: 22, 2, 28, 50, 9, 1 B | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@4; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-lamparray |
| 5 | 3 (HID) | Apple HID driver | 0xFF00/0x00 vendor | input and output 64 B, no report IDs | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@5; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-vendor |

Interface 3 is the one zexrox drives on Windows. Why macOS binds nothing to it
is open; [HYPOTHESIS] it lacks the interrupt-IN endpoint the HID driver needs,
or its descriptor is rejected.

### Protected collections

Chrome's WebHID rules from the claims above, applied to what macOS exposes
([HYPOTHESIS] that Chrome sees the same collections the dump lists):

- Interface 0 (boot keyboard): input and output protected, no feature reports,
  so nothing is usable.
- Interface 1: the keyboard collection (0x01/0x06) is protected for input and
  output, the System Control collection (0x01/0x80) entirely. The Consumer
  collection (0x0C/0x01, input 2) and the four 0x01/0x00 collections (inputs
  4, 5, 7 and 11) are unprotected, so a page may read them; zexrox watches
  this interface for the Fn key.
- Interface 2 (mouse): input protected.
- Interface 3: not exposed by macOS, so these rules never come into play.
- Interface 4 (LampArray, usage page 0x59): unprotected; its six feature
  reports are open to WebHID. This is the standard lighting path, documented
  in the LampArray section.
- Interface 5 (vendor page 0xFF00): unprotected 64-byte input and output
  reports of unknown purpose.

WebUSB: every 02A7 interface is HID class, a protected class, so claiming any
of them fails, and without a claim a page cannot send interface-recipient
control transfers to them.

### Transport options

Facts and open points for the follow-up task, which makes the choice.

- (a) WebUSB: class GET_REPORT / SET_REPORT on the default control pipe with
  wIndex 3. The read-only probe page now on master (src/probe/usb.ts) opens
  the device, records every interface's endpoints from the configuration
  descriptor, tries to claim interface 3 and then, whether or not the claim
  succeeded, makes four reads: 6a, class GET_REPORT for feature report 0
  (wValue 0x0300) with recipient interface; 6b, the same with recipient
  device; 6c, standard GET_DESCRIPTOR for the HID report descriptor (wValue
  0x2200) with recipient interface; 6d, the same with recipient device. The
  owner has not run it, so every result is pending. What the pinned Chromium
  code predicts, each point [HYPOTHESIS] (a prediction, not an observation):
  the claim fails with a SecurityError, HID being a protected class; 6a and
  6c are refused in Blink, as interface-recipient transfers to an unclaimed
  interface; 6b reaches the device service and is refused there, a class
  request with recipient device on a device whose interfaces are all
  protected, while the protected-class control-transfer flag is on (its
  default), so it passes only if that flag is off or the owner's Chrome
  predates 89b42d2d33 (M148, by branch positions); 6d passes Chromium whether the standard-request
  allowlist flag is on or off, and whether the firmware answers it is
  unknown. Vendor-type device requests also pass, but HID GET_REPORT and
  SET_REPORT are class requests, and whether the firmware answers anything
  else is unknown.
- (b) Native access, for example a Tauri desktop app using IOKit or libusb.
  Interface 3 has no driver bound on macOS, so a native app should be able to
  claim it without detaching a driver ([HYPOTHESIS] until tested). zexrox
  shows the same channel working natively on Windows through hidapi.
- (c) WebHID for what macOS exposes: LampArray lighting on interface 4, the
  unprotected inputs of interface 1 and the vendor reports of interface 5. It
  cannot reach the control channel.

### Open questions

- Does the owner's Chrome include commit 89b42d2d33 (M148 or later, by the
  branch positions above), and does a field trial override the default of
  either WebUSB flag? Both are on by default at the pinned commit.
- Does WebUSB open() succeed on macOS for a device whose other interfaces have
  HID drivers bound?
- What does interface 3 declare (endpoints, HID report descriptor, usage
  page)? The probe records the endpoints from the configuration descriptor,
  which needs no transfer, and its 6d read is the one report-descriptor
  request the pinned Chromium code lets through; whether the firmware answers
  a device-recipient report-descriptor request is unknown.
- Why does macOS bind no driver to interface 3?
- What do interface 5's vendor reports and interface 1's 0x01/0x00 inputs
  carry?
- OpenRGB 4418's six Windows captures were not downloaded; they may show which
  interface Razer's software uses for lighting. The issue was closed by merge
  request 2627, built by adding the keyboard to OpenRGB's existing Razer
  controller; the reporter tested those builds and, after a few layout fixes,
  reported the lighting working; the reporter thought two small buttons share one zone
  (openrgb#4418:existing, openrgb#4418:charm). Which interface that controller opens for the 02A7 was
  not read.

## Commands

Synapse declares every command as a three-byte triple: data size, command
class, command ID. Its argument checks report the second byte as the class and
the third as the ID, and compare an argument array's length with the first
(synapse:c1e6a425@1093996#commandClass, synapse:c1e6a425@1094070#AQ); its
request builder writes the three to bytes 5, 6 and 7
(synapse:c1e6a425@431065#_createDataSend). In both sources a get has bit 7 of
the ID set and the matching set has it clear: Synapse's Get Serial Number is
0x82 and its Set Serial Number 0x02 (synapse:c1e6a425@280735#130,
synapse:c1e6a425@280759#22), and zexrox names one command pair 0xa7 (GET) and
0x27 (SET) (zexrox:native/host.py:175@840f03dc). Dir below follows that bit.

zexrox does not forward everything. It answers Get and Set Game Mode Selection
(0x00:0xda, 0x00:0x5a) and the Gaming Mode LED set (0x03:0x00, LED 8) on the
host, and rewrites 0x02:0xa7 / 0x02:0x27 into a different firmware command
before sending (zexrox:native/host.py:1-5@840f03dc,
zexrox:native/host.py:170-180@840f03dc,
zexrox:native/host.py:506-525@840f03dc). Its host sends every other
well-formed report, the class-0 reads included, to the real 02A7 as received,
size byte included (zexrox:native/host.py:526-532@840f03dc). It lists the
class-0 reads it had already identified, without their sizes
(zexrox:native/host.py:18-24@840f03dc). So for the class-0 reads below, the class, ID and read direction are confirmed by
both sources, while the name, the size and the reply layout come from Synapse
only and are likely; each row's Notes say so.

Safe is this repo's allowlist, not a source fact: `yes` only on a confirmed
read that a read-only diagnostics probe may send; every write is `no`.
[HYPOTHESIS] Such a read changes no device state; the evidence is that zexrox
passes these reads to the real keyboard whenever Synapse asks.

Class 0x02 rows (groups actuation, rapid-trigger and snap-tap) are graded on
class, ID and direction only. zexrox lists the reads it checks with a name and
a size (zexrox:native/host.py:29-69@840f03dc), but says it copied those names and sizes
from a 0.1.4 package (zexrox:native/host.py:25@840f03dc; see also
zexrox:native/host.py:18@840f03dc); they match Synapse's declarations and
[HYPOTHESIS] derive from Synapse, so they are not counted as a second source.
A read is confirmed because zexrox's bridge sends that class and ID, as a read,
to a real 02A7; its name and size stay likely (Synapse) unless a 0498 capture
or zexrox's 0498 rewrite backs them, and a set that only Synapse declares is
likely. Neither grade says the 0498 firmware implements the command: apart
from 0x02:0xa7 and 0x02:0x27, which it rewrites (see Snap Tap on the 0498),
zexrox passes these reports from the page to a real 02A7 unchanged
(zexrox:native/host.py:526-532@840f03dc), which shows only that Synapse sends them.

The Size column is the size in Synapse's triple, except for 0x02:0x99,
0x02:0x19, 0x02:0x9a and 0x02:0x1a. Synapse's sendCommand takes a size
argument (synapse:c1e6a425@435520#sendCommand) and passes it to the request builder
(synapse:c1e6a425@436674#_createDataSend), which writes it over byte 5 when it
is positive (synapse:c1e6a425@431246#n). For those four commands Synapse passes a
size computed from the number of keys, so the column gives that formula and
the Notes give the declared 80. The callers sit in Synapse module 43086 and
name the four triples through Synapse's command table
(synapse:c1e6a425@1042994#oc3, synapse:c1e6a425@1042817#iPi,
synapse:c1e6a425@1042572#_r0, synapse:c1e6a425@1042432#UmA); the device
module whose class is named rzDevice25 imports that module
(synapse:c1e6a425@401913#43086) and calls it
(synapse:c1e6a425@429920#rzDevice25, synapse:c1e6a425@474834#fr); which
device module Synapse uses for the 02D0 or the 02A7 is not traced. Each class 0x02 row's Notes give a firmware verdict
instead: unsupported where the zexrox README says the 0498 firmware lacks the
feature (zexrox:README.md:25@840f03dc), supported where zexrox has evidence
specific to the 0498, unknown otherwise. [HYPOTHESIS] The README names
features, not commands; this document pairs them by name. For these rows
Synapse declares each set triple right after its get triple and each set name
right after its get name (for example synapse:c1e6a425@1045308#153,
synapse:c1e6a425@1045337#25, synapse:c1e6a425@1045366#Actuation,
synapse:c1e6a425@1045408#Actuation); [HYPOTHESIS] a set's name is paired with
its triple by that order. Every actuation and rapid-trigger row drops the word
Analog from Synapse's name: it follows Multi in the four Multi Key names and
comes right after Get or Set in the others; the cited strings hold the full
names.

Snap Tap on the 0498. Synapse's Get and Set Snap Tap Ctrl are 0x02:0xa7 and
0x02:0x27 with 15 data bytes (synapse:c1e6a425@1047421#15,
synapse:c1e6a425@1047426#167, synapse:c1e6a425@1047456#39). zexrox reads them
as the profile, the number of key pairs, an enabled flag, then two key ids and
a mode byte (zexrox:native/host.py:174-176@840f03dc). Naming a capture file
(snaptap.pcapng) that is not in the zexrox repo, zexrox says the 0498 does
Snap Tap with a 4-byte command instead: 0x02:0xa1 to get and 0x02:0x21 to set, holding the profile, an
enabled flag and two key ids (zexrox:native/host.py:172-174@840f03dc).
Synapse declares the same class, IDs and size as Get and Set Keyboard Kill
Switch Ctrl (synapse:c1e6a425@1046779#4, synapse:c1e6a425@1046783#161,
synapse:c1e6a425@1046813#33, synapse:c1e6a425@1046835#Kill). So zexrox never
sends 0x02:0xa7 or 0x02:0x27 to the keyboard. It builds a new request with
size 4, ID 0xa1 for the get or 0x21 for the set, and the page's transaction
byte and profile; for a set it adds the enabled flag and, when the page sent
at least one pair, that first pair's two key ids. The mode byte and any
further pairs are dropped and the checksum is recomputed
(zexrox:native/host.py:178-194@840f03dc). The reply is rebuilt into the shape
the page expects: the keyboard's status byte; the page's transaction byte and
command bytes; a size of the page's own when 6 to 80, else 15; then profile, a
pair count of 1 when either key id is non-zero (else 0), enabled, the two key
ids, and mode 0, which zexrox notes is the page's last-input priority
(zexrox:native/host.py:196-214@840f03dc). [HYPOTHESIS] A port for the 0498
should send 0x02:0xa1 and 0x02:0x21 itself and offer one key pair with no
priority choice.

| Group | Class | ID | Name | Dir | Size | Safe | Confidence | Source | Notes |
|---|---|---|---|---|---|---|---|---|---|
| device-info | 0x00 | 0x81 | Get Firmware Version | read | 2 | yes | confirmed | synapse:c1e6a425@280681#129; synapse:c1e6a425@280694#Firmware; synapse:c1e6a425@279884#K_; synapse:c1e6a425@1093638#K_; zexrox:native/host.py:22@840f03dc | Confirmed (both sources): class, ID, read. Likely (Synapse only): name, size 2, reply layout (see Reply layouts); zexrox does not check this size. No arguments. |
| device-info | 0x00 | 0x82 | Get Serial Number | read | 22 | yes | confirmed | synapse:c1e6a425@280735#130; synapse:c1e6a425@280775#Serial; synapse:c1e6a425@279893#Kr; synapse:c1e6a425@280580#yf; synapse:c1e6a425@1093877#Kr; zexrox:native/host.py:22@840f03dc | Confirmed (both sources): class, ID, read. Likely (Synapse only): name, size 22, reply layout; zexrox does not check this size. No arguments. [HYPOTHESIS] The reply is the unit's serial, so this repo keeps it out of logs and bug reports. |
| device-info | 0x00 | 0x84 | Get Device Mode | read | 2 | no | confirmed | synapse:c1e6a425@280913#132; synapse:c1e6a425@280952#Device; synapse:c1e6a425@1094890#Ii; zexrox:native/host.py:22@840f03dc | Confirmed (both sources): class, ID, read. Likely (Synapse only): size 2. Likely (Synapse only): the name, paired with the triple where Synapse sends it (synapse:c1e6a425@1094890#Ii). Reply layout not traced. Not on the diagnostics list in this version. |
| device-info | 0x00 | 0x86 | Get Edition Information | read | 3 | no | confirmed | synapse:c1e6a425@281121#134; synapse:c1e6a425@281159#Edition; synapse:c1e6a425@1094540#dx; zexrox:native/host.py:22@840f03dc | Confirmed (both sources): class, ID, read. Likely (Synapse only): size 3. Likely (Synapse only): the name, paired with the triple where Synapse sends it (synapse:c1e6a425@1094540#dx). Reply layout not traced. Not on the diagnostics list in this version. |
| device-info | 0x00 | 0x87 | Get Extended Firmware Version | read | 4 | no | confirmed | synapse:c1e6a425@281203#135; synapse:c1e6a425@281225#Firmware; synapse:c1e6a425@1097158#O3; zexrox:native/host.py:22@840f03dc | Confirmed (both sources): class, ID, read. Likely (Synapse only): size 4. Likely (Synapse only): the name, paired with the triple where Synapse sends it (synapse:c1e6a425@1097158#O3). Reply layout not traced. Not on the diagnostics list in this version. |
| device-info | 0x00 | 0x02 | Set Serial Number | write | 22 | no | likely | synapse:c1e6a425@280759#22; synapse:c1e6a425@280797#Serial; synapse:c1e6a425@279741#AQ; synapse:c1e6a425@279828#I0; synapse:c1e6a425@1094070#AQ | Synapse only; zexrox does not list it. Overwrites the serial: never send. Same class and size as 0x00:0x82; the ID differs only in bit 7 (see below). |
| actuation | 0x02 | 0x99 | Get Multi Key Actuation Point | read | 2+5×keys | no | confirmed | synapse:c1e6a425@1045308#153; synapse:c1e6a425@1045303#80; synapse:c1e6a425@1045366#Actuation; zexrox:native/host.py:46@840f03dc#0x99 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): name. Size: Synapse declares 80 but sends 2+5×keys for up to 15 keys (likely, Synapse only: synapse:c1e6a425@1259668#2); zexrox notes Synapse sends this read at more than one size and exempts it from its size check (zexrox:native/host.py:121-124@840f03dc). Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| actuation | 0x02 | 0x19 | Set Multi Key Actuation Point | write | 2+5×keys | no | likely | synapse:c1e6a425@1045337#25; synapse:c1e6a425@1045332#80; synapse:c1e6a425@1045408#Actuation | Synapse only (likely): set ID; name paired by declaration order [HYPOTHESIS]. Size: Synapse declares 80 but sends 2+5×keys for up to 15 keys (likely, Synapse only: synapse:c1e6a425@1260228#2); zexrox checks sizes only for the reads it lists, so it never checks this set's size (zexrox:native/host.py:119-124@840f03dc). Argument layout not traced. 0498 firmware: unknown. |
| actuation | 0x02 | 0x9f | Get Key Adjustment Mode Ctrl | read | 2 | no | confirmed | synapse:c1e6a425@1045924#159; synapse:c1e6a425@1045920#2; synapse:c1e6a425@1045977#Adjustment; zexrox:native/host.py:50@840f03dc#0x9f | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 2, name. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| actuation | 0x02 | 0x1f | Set Key Adjustment Mode Ctrl | write | 2 | no | likely | synapse:c1e6a425@1045953#31; synapse:c1e6a425@1045949#2; synapse:c1e6a425@1046018#Adjustment | Synapse only (likely): set ID, size 2; name paired by declaration order [HYPOTHESIS]. Argument layout not traced. 0498 firmware: unknown. |
| actuation | 0x02 | 0xaf | Get V3 Key Adjustment Mode Ctrl | read | 1 | no | confirmed | synapse:c1e6a425@1046063#175; synapse:c1e6a425@1046059#1; synapse:c1e6a425@1046091#Adjustment; zexrox:native/host.py:58@840f03dc#0xaf; zexrox:README.md:25@840f03dc#V3 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 1, name. Synapse declares no matching set. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unsupported (the zexrox README says it lacks Analog V3; feature-to-command pairing by name is [HYPOTHESIS]). |
| actuation | 0x02 | 0xa8 | Get Key Bottom Dead-Zone Value | read | 2 | no | confirmed | synapse:c1e6a425@1047657#168; synapse:c1e6a425@1047653#2; synapse:c1e6a425@1047710#Bottom; zexrox:native/host.py:65@840f03dc#0xa8; zexrox:README.md:25@840f03dc#deadzone; synapse:c1e6a425@1048306#168; synapse:c1e6a425@1048302#1; synapse:c1e6a425@1048347#Function | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 2, name. Synapse also declares 0x02:0xa8 with size 1 next to the Function Key Swap names; the two triples differ only in the size byte, and which one the 0498 answers is unknown. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unsupported (the zexrox README says it lacks bottom deadzone; pairing by name is [HYPOTHESIS]). |
| actuation | 0x02 | 0x28 | Set Key Bottom Dead-Zone Value | write | 2 | no | likely | synapse:c1e6a425@1047686#40; synapse:c1e6a425@1047682#2; synapse:c1e6a425@1047753#Bottom; zexrox:README.md:25@840f03dc#deadzone; synapse:c1e6a425@1048278#40; synapse:c1e6a425@1048274#1; synapse:c1e6a425@1048320#Function | Synapse only (likely): set ID, size 2; name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Synapse also declares 0x02:0x28 with size 1 next to the Function Key Swap names. 0498 firmware: unsupported (README: bottom deadzone; pairing by name is [HYPOTHESIS]). |
| rapid-trigger | 0x02 | 0x9a | Get Multi Key Rapid Trigger | read | 2+6×keys | no | confirmed | synapse:c1e6a425@1045449#154; synapse:c1e6a425@1045444#80; synapse:c1e6a425@1045509#Rapid; zexrox:native/host.py:47@840f03dc#0x9a | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): name. Size: Synapse declares 80 but sends 2+6×keys for up to 13 keys (likely, Synapse only: synapse:c1e6a425@1261032#2); zexrox notes Synapse sends this read at more than one size and exempts it from its size check (zexrox:native/host.py:121-124@840f03dc). Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| rapid-trigger | 0x02 | 0x1a | Set Multi Key Rapid Trigger | write | 2+6×keys | no | likely | synapse:c1e6a425@1045479#26; synapse:c1e6a425@1045474#80; synapse:c1e6a425@1045549#Rapid | Synapse only (likely): set ID; name paired by declaration order [HYPOTHESIS]. Size: Synapse declares 80 but sends 2+6×keys for up to 13 keys (likely, Synapse only: synapse:c1e6a425@1261575#2); zexrox checks sizes only for the reads it lists, so it never checks this set's size (zexrox:native/host.py:119-124@840f03dc). Argument layout not traced. 0498 firmware: unknown. |
| rapid-trigger | 0x02 | 0xa0 | Get Key Continuous Rapid Trigger | read | 2 | no | confirmed | synapse:c1e6a425@1046136#160; synapse:c1e6a425@1046132#2; synapse:c1e6a425@1046189#Continuous; zexrox:native/host.py:66@840f03dc#0xa0 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 2, name. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| rapid-trigger | 0x02 | 0x20 | Set Key Continuous Rapid Trigger | write | 2 | no | likely | synapse:c1e6a425@1046165#32; synapse:c1e6a425@1046161#2; synapse:c1e6a425@1046234#Continuous | Synapse only (likely): set ID, size 2; name paired by declaration order [HYPOTHESIS]. Argument layout not traced. 0498 firmware: unknown. |
| snap-tap | 0x02 | 0xa7 | Get Snap Tap Ctrl | read | 15 | no | likely | synapse:c1e6a425@1047426#167; synapse:c1e6a425@1047421#15; synapse:c1e6a425@1047469#Snap; zexrox:native/host.py:61@840f03dc#0xa7; zexrox:native/host.py:174-176@840f03dc; zexrox:native/host.py:178-185@840f03dc#0xa1 | Likely (Synapse; zexrox matches it in the page's traffic but never sends it to a 02A7): class, ID, read, size 15, name; this is what Synapse sends. Reply layout not traced in Synapse. 0498 firmware: unknown; zexrox never sends it to the keyboard and rewrites it to 0x02:0xa1 (see Snap Tap on the 0498). Not on the diagnostics list in this version. |
| snap-tap | 0x02 | 0x27 | Set Snap Tap Ctrl | write | 15 | no | likely | synapse:c1e6a425@1047456#39; synapse:c1e6a425@1047451#15; synapse:c1e6a425@1047492#Snap; zexrox:native/host.py:174-176@840f03dc; zexrox:native/host.py:178-185@840f03dc#0x27 | Likely (Synapse; zexrox names 0x27 as the page's set but never sends it to a 02A7): class, ID, set, size 15, name; zexrox's size 15 describes the page's command, not the 0498 (zexrox:native/host.py:175@840f03dc). Likely (zexrox only): argument layout (see Reply layouts). 0498 firmware: unknown; zexrox rewrites it to 0x02:0x21. |
| snap-tap | 0x02 | 0xa1 | Get Keyboard Kill Switch Ctrl | read | 4 | no | confirmed | synapse:c1e6a425@1046783#161; synapse:c1e6a425@1046779#4; synapse:c1e6a425@1046835#Kill; zexrox:native/host.py:172-173@840f03dc; zexrox:native/host.py:183-185@840f03dc#0xa1 | Confirmed: class, ID, read, size 4 (Synapse's triple and zexrox's 0498 rewrite). Likely (Synapse): the name Keyboard Kill Switch Ctrl; zexrox calls it a kill-switch command. Likely (zexrox only): reply layout (see Reply layouts). 0498 firmware: supported; zexrox sends it to a real 02A7 in place of 0x02:0xa7 and names a capture file (snaptap.pcapng) that is not in the zexrox repo. Not on the diagnostics list in this version. |
| snap-tap | 0x02 | 0x21 | Set Keyboard Kill Switch Ctrl | write | 4 | no | confirmed | synapse:c1e6a425@1046813#33; synapse:c1e6a425@1046809#4; synapse:c1e6a425@1046870#Kill; zexrox:native/host.py:172-173@840f03dc; zexrox:native/host.py:185@840f03dc#0x21 | Confirmed: class, ID, set, size 4 (Synapse's triple and zexrox's 0498 rewrite). Likely (Synapse): name. Likely (zexrox only): argument layout (see Reply layouts). 0498 firmware: supported (zexrox's Snap Tap set on a real 02A7; it names a capture file, snaptap.pcapng, that is not in the zexrox repo). |
| snap-tap | 0x02 | 0xac | Get Single-key Snap Tap Ctrl | read | 11 | no | confirmed | synapse:c1e6a425@1047531#172; synapse:c1e6a425@1047526#11; synapse:c1e6a425@1047574#Single; zexrox:native/host.py:60@840f03dc#0xac; zexrox:README.md:25@840f03dc#Snap | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 11, name. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unsupported (the zexrox README says it lacks single-key Snap Tap; pairing by name is [HYPOTHESIS]). |
| snap-tap | 0x02 | 0x2c | Set Single-key Snap Tap Ctrl | write | 11 | no | likely | synapse:c1e6a425@1047561#44; synapse:c1e6a425@1047556#11; synapse:c1e6a425@1047608#Single; zexrox:README.md:25@840f03dc#Snap | Synapse only (likely): set ID, size 11; name paired by declaration order [HYPOTHESIS]. Argument layout not traced. 0498 firmware: unsupported (README: single-key Snap Tap; pairing by name is [HYPOTHESIS]). |
| snap-tap | 0x02 | 0xb1 | Get Dual Keypress Priority | read | 7 | no | confirmed | synapse:c1e6a425@1048389#177; synapse:c1e6a425@1048385#7; synapse:c1e6a425@1048431#Dual; zexrox:native/host.py:62@840f03dc#0xb1 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 7, name. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). [HYPOTHESIS] Grouped with Snap Tap by this document. |
| snap-tap | 0x02 | 0x31 | Set Dual Keypress Priority | write | 7 | no | likely | synapse:c1e6a425@1048418#49; synapse:c1e6a425@1048414#7; synapse:c1e6a425@1048463#Dual | Synapse only (likely): set ID, size 7; name paired by declaration order [HYPOTHESIS]. Argument layout not traced. 0498 firmware: unknown. [HYPOTHESIS] Grouped with Snap Tap by this document. |

Set Serial Number (0x00:0x02) and Get Serial Number (0x00:0x82) share class
and size and differ in one bit of byte 7, so one flipped bit turns the safe
read into a write of the serial. [HYPOTHESIS] The follow-up transport task
should compare the whole (class, ID) pair against the diagnostics list before
sending, and refuse anything else, instead of trusting a direction flag.

The line below lists the commands a read-only diagnostics probe may send;
each must be a Safe=yes row above.

Diagnostics reads: 0x00:0x81, 0x00:0x82

### Reply layouts

Reply data starts at byte 8 and is byte 5 bytes long (see Framing); data[n]
below is byte 8 + n of the reply.

| Command | Bytes | Meaning | Source |
|---|---|---|---|
| 0x00:0x81 Get Firmware Version | data[0] | Major version number. | synapse:c1e6a425@1093666#major; synapse:c1e6a425@1093638#K_ |
| 0x00:0x81 Get Firmware Version | data[1] | Minor version number. Synapse reads nothing past data[1] and does not look at the status before decoding. | synapse:c1e6a425@1093666#major |
| 0x00:0x82 Get Serial Number | data[0] up to the reply's byte 5 | Serial number bytes. Synapse keeps every byte and also derives a text form from only the bytes in 0x20 to 0x7e, skipping the rest (so 0x00 padding drops out). | synapse:c1e6a425@1093813#serialNumberAscii; synapse:c1e6a425@1093742#32; synapse:c1e6a425@1093877#Kr |
| 0x00:0x02 Set Serial Number | request data[0] to data[21] | The new serial, exactly 22 bytes; Synapse refuses any other length before sending. It decodes the reply like 0x00:0x82. | synapse:c1e6a425@1094070#AQ; synapse:c1e6a425@1094147#commandClass |
| 0x02:0xa1 Get Keyboard Kill Switch Ctrl | data[0] to data[3] | Profile, enabled flag, first key id, second key id, as zexrox reads the keyboard's reply. One source (zexrox): likely. | zexrox:native/host.py:205@840f03dc#firmware |
| 0x02:0x21 Set Keyboard Kill Switch Ctrl | request data[0] to data[3] | Profile, enabled flag (0 and 1 in zexrox's capture), first key id, second key id. One source (zexrox): likely. | zexrox:native/host.py:172-174@840f03dc; zexrox:native/host.py:186-192@840f03dc |
| 0x02:0x27 Set Snap Tap Ctrl | request data[0] to data[5] | Profile, number of pairs, enabled flag, key id, key id, mode. [HYPOTHESIS] The last three repeat for each further pair. One source (zexrox): likely. | zexrox:native/host.py:174-176@840f03dc; zexrox:native/host.py:188-192@840f03dc |

## Golden packets

Byte-exact packets for the two diagnostics reads: the 90 data bytes (report ID
0 not included), 16 per line. The checker recomputes byte 88 of each. The
requests follow Framing: byte 0 = 0x00, transaction IDs 0 and 1 (the first two
IDs Synapse sends, see Transaction ID), bytes 2 to 4 = 0x00, then size, class
and ID, no arguments, the checksum at byte 88 and 0x00 at byte 89.

### G1: request Get Firmware Version

- Source: synapse:c1e6a425@280681#129; synapse:c1e6a425@431065#_createDataSend; synapse:c1e6a425@430969#_getTransactionId; zexrox:native/host.py:22@840f03dc

```hex
00 00 00 00 00 02 00 81 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 83 00
```

Transaction ID 0x00, size 0x02, class 0x00, ID 0x81. Checksum: 0x02 XOR 0x81 =
0x83.

### G2: request Get Serial Number

- Source: synapse:c1e6a425@280735#130; synapse:c1e6a425@431065#_createDataSend; synapse:c1e6a425@430969#_getTransactionId; zexrox:native/host.py:22@840f03dc

```hex
00 01 00 00 00 16 00 82 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 94 00
```

Transaction ID 0x01, size 0x16 (22), class 0x00, ID 0x82. Checksum: 0x16 XOR
0x82 = 0x94.

### G3: response Get Firmware Version (illustrative values)

- Source: synapse:c1e6a425@1093666#major; synapse:c1e6a425@432629#_getUSBTransferInResult

```hex
02 00 00 00 00 02 00 81 01 02 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 80 00
```

Illustrative: version 1.2 is made up, not read from a device. It shows the
shape of a successful answer to G1: status 0x02, transaction ID 0x00 repeated,
size 0x02, class and ID repeated, data[0] = 0x01 (major), data[1] = 0x02
(minor). Byte 88 follows the request rule (0x02 XOR 0x81 XOR 0x01 XOR 0x02 =
0x80) although neither source checks a reply's checksum; what a real 02A7
puts in bytes 2 to 4 and 88 of a reply is not established. No real 02A7
reply has been captured, so this response is synthetic.

## Sources

Where each source comes from, what it is good for, and its license:
[protocol-sources.md](protocol-sources.md).

Pinned versions: zexrox at commit 840f03dca68c7f7a3b8f867475a2c8e9a355a1bc;
the Synapse Web bundle `products/720/static/js/main.2f427e06.js`, sha256 prefix
c1e6a425. Full hashes of every source file are in `tools/sources.manifest.json`.
`tools/citations.lock.json` stores a hash of the text around each citation, so
the checker can detect a changed citation without downloading the sources.
Facts are written in this document's own words; no source code is copied
(Synapse is proprietary, zexrox is MIT).

Chromium (BSD license; read for facts only) is pinned at commit
1aeca202fed13742d05b130fcb49e418f98fc4ca, fetched file by file from its GitHub
mirror; the cited files and their sha256 are in the manifest. The OpenRGB issue
4418 thread was saved on 2026-10-14 from GitLab: the issue through its API, the
notes through the public discussions endpoint, because the notes API needs a
login. The owner's macOS dump is part of this repo:
`.ai_context/knowledge/hid-02a7-macos.txt`.
