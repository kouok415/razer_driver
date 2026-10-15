# Huntsman V3 Pro TKL (RZ03-0498, USB 1532:02A7): control protocol

Last updated: 2026-10-15.

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
openrgb#4418:<note id or token>                    a note ID, or a distinctive body token, of the saved OpenRGB issue 4418 thread
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

02A7 status: [UNVERIFIED] for the interface-3 control channel on macOS; no transport has reached it yet. The owner's read-only probe (2026-10-15) reached only the device's default control pipe, with one standard descriptor read.

| Claim | Source | Confidence |
|---|---|---|
| On the owner's Mac, USB interface 3 has no driver attached: no HID device and no user client, so it is absent from the system's HID device list. | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3 | confirmed |
| Interfaces 0, 1 and 2 also carry a Razer DriverKit event service on that Mac; interfaces 4 and 5 (5 is the vendor-page interface) have the Apple HID driver only. | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@0; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@1; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@2; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@4; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@5 | confirmed |
| The largest feature report macOS exposes is on interface 4 (LampArray): the dump's MaxFeatureReportSize of 51 is report 4's 50 data bytes (see the table below) plus the report-ID byte. No exposed interface has the 90-byte report-ID-0 control report. | probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-lamparray; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@4; zexrox:native/host.py:446@840f03dc#send_feature_report | confirmed |
| On the owner's 02A7, interface 3 has a single endpoint, interrupt OUT (endpoint 3, 8 B), and no IN endpoint; interfaces 0, 1, 2 and 4 each have one interrupt IN endpoint, and interface 5 an interrupt IN and OUT pair of 64 B. | probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if3.endpoints; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if0.endpoints; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if1.endpoints; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if2.endpoints; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if4.endpoints; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if5.endpoints | confirmed |
| A standard GET_DESCRIPTOR for the HID report descriptor (wValue 0x2200), sent to the device with wIndex 3, returned 22 bytes: one application collection, usage page 0x0C usage 0x01, holding a single 90-byte feature report with no report ID (vendor usage 0xFF00/0x02). | probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#6d.getReportDescriptor.device; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if3.reportDescriptor | confirmed |
| That descriptor is interface 3's: it was asked for with wIndex 3, it matches none of the five descriptors macOS exposes, and it has the report-ID-0, 90-byte feature report zexrox exchanges on interface 3. It has the usage page, usage and 90-byte feature report of zexrox's fake 02D0, which adds an input report. | probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if3.reportDescriptor; probe:.ai_context/knowledge/hid-02a7-macos.txt#ReportDescriptor; zexrox:native/host.py:446@840f03dc#send_feature_report; zexrox:extension/virtual-hid.js:224-235@840f03dc#usagePage | [HYPOTHESIS] |
| WebHID can only offer collections the OS HID stack exposes, which would explain why the probe was offered no interface-3 device on macOS. | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.notOffered; url:https://wicg.github.io/webhid/ | [HYPOTHESIS] |
| zexrox, against a real 02A7 on Windows, keeps only the interface-3 collections of 1532:02A7 (interface number 3, or mi_03 in the path), refuses to open unless exactly one matches, and never looks at its usage page. There it uses report-ID-0 feature reports: it writes the ID byte plus 90 B, and reads by asking for 91 B, taking either 91 B that start with ID 0 (the ID byte is dropped) or a bare 90 B. | zexrox:native/host.py:455-464@840f03dc#mi_03; zexrox:native/host.py:446@840f03dc#send_feature_report; zexrox:native/host.py:408-418@840f03dc#get_feature_report | confirmed |
| zexrox also watches interface 1 for the Fn key. Per its notes the 48-byte interrupt payload on endpoint 0x82 begins with report ID 0x04 (the dump's 47 B input plus the ID byte), and the byte after it is 1 while Fn is held. It opens every mi_01 collection, keeps the one that delivers that report, closes the others, and never opens interface 0; Fn+F10 switches a lock of its own on the Windows side. | zexrox:native/host.py:225-229@840f03dc#0x82; zexrox:native/host.py:319-333@840f03dc#mi_01; zexrox:native/host.py:707-762@840f03dc#_acquire_fn_reader; zexrox:native/host.py:560@840f03dc#F10; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-multi | confirmed |
| Synapse (for 02D0) matches WebHID devices on vendor ID, its product IDs and a usage page. The default usage page is 12 (0x0C, Consumer), a bundle constant exported as MU; the device config may replace it and add a usage, and the 02D0 config was not read. Its feature-report device is an unopened match with exactly one collection, on that usage page, which has the configured usage or, when no usage is configured, at least one feature report. | synapse:c1e6a425@2672184#usagePage; synapse:c1e6a425@545501#MU; synapse:c1e6a425@545646#12; synapse:c1e6a425@2679560#usagePage; synapse:c1e6a425@2677504#isFeatureReportDevice | likely |
| For hardware events Synapse first reuses the feature-report device: it keeps that device unless its first collection's input-report list is empty. zexrox's fake 02D0 lists an input report on its single collection so that this listener attaches there. | synapse:c1e6a425@2676118#connectHardwareEventDevice; zexrox:extension/virtual-hid.js:224-226@840f03dc#inputReports | confirmed |
| Only when that list is empty does Synapse search the devices the page already holds permission for (getDevices) for one that is unopened, has the vendor ID and a known product ID, a non-empty product name, more than one collection and at least one collection with input reports; it then opens that device and listens to its input reports. | synapse:c1e6a425@2676118#connectHardwareEventDevice; synapse:c1e6a425@2676274#getDevices; synapse:c1e6a425@2676390#productName | likely |
| zexrox's fake 02D0 shows Synapse one collection (usage page 12, usage 1) with input report 1 and a 90-byte feature report 0: the shape Synapse looks for, not the real 02A7 layout. On the real keyboard zexrox needs exactly one interface-3 collection and never checks its usage page; the probe's descriptor read (rows above) gives 0x0C/0x01, [HYPOTHESIS] for interface 3. Of the five interfaces macOS exposes, none is a lone usage-page-12 collection; interface 1 has 0x0C/0x01 as one of seven. | zexrox:extension/virtual-hid.js:224-235@840f03dc#usagePage; zexrox:native/host.py:455-464@840f03dc#mi_03; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-multi; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if3.reportDescriptor | likely |
| Chrome's WebHID always protects the Keyboard/Keypad usage page, and Generic Desktop Pointer, Mouse, Keyboard and Keypad collections for input and output reports; feature reports of those four are not protected. | chromium:services/device/public/cpp/hid/hid_report_utils.cc:41@1aeca202#kPageKeyboard; chromium:services/device/public/cpp/hid/hid_report_utils.cc:53@1aeca202#kFeature | likely |
| That built-in rule (IsAlwaysProtected) also fully protects two Generic Desktop ranges: System Control, usages 0x80 to 0x8F, and System Dock to System Display Swap, 0xA0 to 0xB6. It protects no other usage page. | chromium:services/device/public/cpp/hid/hid_report_utils.cc:56@1aeca202#kGenericDesktopSystemControl; chromium:services/device/public/cpp/hid/hid_report_utils.cc:61@1aeca202#kGenericDesktopSystemDock; chromium:services/device/public/cpp/hid/hid_report_utils.cc:45@1aeca202#kPageGenericDesktop; chromium:services/device/public/mojom/hid.mojom:86@1aeca202#kGenericDesktopSystemControl; chromium:services/device/public/mojom/hid.mojom:101@1aeca202#kGenericDesktopSystemWarmRestart; chromium:services/device/public/mojom/hid.mojom:108@1aeca202#kGenericDesktopSystemDock; chromium:services/device/public/mojom/hid.mojom:123@1aeca202#kGenericDesktopSystemDisplaySwap | likely |
| Separately, a WebHID connection refuses every report the HID blocklist matches. The blocklist's built-in entries cover the FIDO usage page (0xF1D0) on every device, 45 security-key vendor and product pairs (whole devices), and one vendor-page output report of vendor 0x0B0E; none names Razer's vendor ID 0x1532, so neither rule protects the 02A7's 0x59 lighting page or its 0xFF00 vendor page. A field-trial parameter can add entries; none was read. | chromium:services/device/hid/hid_connection.cc:166@1aeca202#IsReportProtected; chromium:services/device/hid/hid_connection.cc:193@1aeca202#blocklist; chromium:services/device/public/cpp/hid/hid_blocklist.cc:40@1aeca202#kPageFido; chromium:services/device/public/cpp/hid/hid_blocklist.cc:44@1aeca202#VENDOR_PRODUCT_RULE; chromium:services/device/public/mojom/hid.mojom:49@1aeca202#kPageFido; chromium:services/device/public/cpp/hid/hid_blocklist.cc:109@1aeca202#0x0b0e; chromium:services/device/public/cpp/hid/hid_blocklist.cc:236@1aeca202#kWebHidBlocklistAdditions | likely |
| WebHID decides protection per report ID and report type. With recursive filtering, on by default, a report is protected when any application collection that holds it, top-level or nested, matches the built-in rule. | chromium:services/device/public/cpp/hid/hid_report_utils.cc:131@1aeca202#kHIDCollectionTypeApplication; chromium:services/device/public/cpp/hid/hid_report_utils.cc:132@1aeca202#IsAlwaysProtected; chromium:services/device/public/cpp/hid/hid_report_utils.cc:137@1aeca202#HasReportInAlwaysProtectedCollection; chromium:services/device/hid/hid_connection.cc:220@1aeca202#kWebHidRecursiveFiltering; chromium:services/device/public/cpp/device_features.cc:140@1aeca202#kWebHidRecursiveFiltering | likely |
| WebUSB's protected interface classes are audio, HID, mass storage, smart card, video, audio/video and wireless controller; claiming one fails with a SecurityError. | chromium:content/browser/usb/web_usb_service_impl.cc:249@1aeca202#kUsbHidClass; chromium:services/device/usb/mojo/device_impl.cc:512@1aeca202#kProtectedClass; chromium:third_party/blink/renderer/modules/webusb/usb_device.cc:1008@1aeca202#kProtectedInterfaceClassError | likely |
| Chrome changes that class list only for extension origins; an Isolated Web App holding the usb-unrestricted permission (behind a feature flag) has no protected classes. A normal web page is neither. | chromium:chrome/browser/usb/chrome_usb_delegate.cc:183@1aeca202#AdjustProtectedInterfaceClasses; chromium:content/browser/usb/web_usb_service_impl.cc:262@1aeca202#kUsbUnrestricted | likely |
| A WebUSB control transfer with recipient "interface" needs that interface claimed first (checked in Blink); recipient "device" needs no claim. | chromium:third_party/blink/renderer/modules/webusb/usb_device.cc:856@1aeca202#EnsureInterfaceClaimed | likely |
| The device service refuses a class request with recipient "device" when any interface of the active configuration is in a protected class. HID GET_REPORT and SET_REPORT are class requests (HID 1.11, section 7.2), and all six 02A7 interfaces are HID class. The check runs only while the protected-class control-transfer flag is on, its default at the pinned commit. History, from the linked commits rather than the pinned tree: commit 89b42d2d33 (main position 1601756, 2026-03-19) added that flag and began refusing vendor and class requests with recipient device whose wIndex low byte names a protected interface, which had not been checked before; commit b334f9d5a8 (main position 1658378, 2026-07-07) widened the class-request refusal to any wIndex on a device with a protected interface. [HYPOTHESIS] By chromiumdash branch positions M148 is the first milestone with 89b42d2d33, the cut-off for the probe's 6b (wIndex 3); merge-back to M147 was not checked. The owner's Edge 153 refused 6b. | chromium:services/device/usb/mojo/device_impl.cc:353@1aeca202#HasProtectedInterface; chromium:services/device/usb/mojo/device_impl.cc:238@1aeca202#FindBlockedClass; chromium:services/device/usb/mojo/device_impl.cc:224@1aeca202#kWebUsbProtectedClassControlTransferBlock; chromium:services/device/public/cpp/device_features.cc:56@1aeca202#kWebUsbProtectedClassControlTransferBlock; chromium:services/device/public/cpp/device_features.cc:57@1aeca202#FEATURE_ENABLED_BY_DEFAULT; url:https://www.usb.org/sites/default/files/hid1_11.pdf; url:https://chromium.googlesource.com/chromium/src/+/89b42d2d3326ebad6e0494009d5d92f2dbaf12ef; url:https://chromium.googlesource.com/chromium/src/+/b334f9d5a8d0a54b39b0f17aa2149cdb3fd7feab; url:https://chromiumdash.appspot.com/fetch_milestones; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#6b.getFeatureReport.device; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@0; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@1; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@2; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@4; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@5 | likely |
| In the device service, vendor-type requests with recipient "device" are always allowed. A standard GET_DESCRIPTOR read (device to host) passes for any recipient while the standard-request allowlist flag is on, its default at the pinned commit; with that flag off it passes for recipient device or other, and interface or endpoint recipients go through the protected-class check. Blink's claim check applies before either. | chromium:services/device/usb/mojo/device_impl.cc:392@1aeca202#kAllowed; chromium:services/device/usb/mojo/device_impl.cc:277@1aeca202#kWebUsbEnforceStandardRequestAllowlist; chromium:services/device/usb/mojo/device_impl.cc:285@1aeca202#kUsbRequestGetDescriptor; chromium:services/device/usb/mojo/device_impl.cc:295@1aeca202#DEVICE; chromium:services/device/usb/mojo/device_impl.cc:301@1aeca202#INTERFACE; chromium:services/device/public/cpp/device_features.cc:63@1aeca202#kWebUsbEnforceStandardRequestAllowlist; chromium:services/device/public/cpp/device_features.cc:64@1aeca202#FEATURE_ENABLED_BY_DEFAULT | likely |
| On the owner's Mac in Edge 153 (Chromium 153), WebUSB opened the device, refused to claim interface 3 (SecurityError, protected class), refused 6a and 6c because interface 3 was not claimed, refused 6b (SecurityError, transfer not allowed) and let 6d through. | probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#4.open; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#5.claimInterface; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#6a.getFeatureReport.interface; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#6b.getFeatureReport.device; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#6c.getReportDescriptor.interface; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#6d.getReportDescriptor.device | confirmed |
| In the same browser WebHID offered four of the keyboard's HID devices: LampArray with all six feature reports, the interface-1 collections other than 0x01/0x06 and 0x01/0x80, the mouse, and the 0xFF00 vendor interface. It offered neither the boot keyboard (interface 0) nor interface 3. | probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.lamparray; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.multi; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.mouse; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.vendor; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.notOffered | confirmed |
| OpenRGB issue 4418 (02A7 lighting support) has no USB or HID descriptor dump: its body gives one Windows HidUsb device path, on interface MI_02, and links six captures taken with Razer's software; no note holds lsusb output or a report descriptor. | openrgb#4418:MI_02 | likely |

### Interfaces on macOS

The owner's Mac lists five HID devices for the keyboard; USB interface 3 is the
missing one. Sizes are as decoded in the dump; interface 3's row comes from the
WebUSB probe.

| Interface | Class | Driver | Usage page/usage | Reports | Source |
|---|---|---|---|---|---|
| 0 | 3 (HID) | Apple HID driver + Razer DriverKit event service | 0x01/0x06 boot keyboard | input 8 B, output 1 B, no report IDs | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@0; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-boot |
| 1 | 3 (HID) | Apple HID driver + Razer DriverKit event service | seven top-level collections: 0x01/0x06, 0x0C/0x01, 0x01/0x80, four of 0x01/0x00 | 47 B inputs with IDs 1, 2, 3, 4, 5, 7, 11; output ID 1 (1 B) | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@1; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-multi |
| 2 | 3 (HID) | Apple HID driver + Razer DriverKit event service | 0x01/0x02 mouse | input 8 B | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@2; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-mouse |
| 3 | 3 (HID) | none bound | not exposed to the HID stack; the report descriptor read over WebUSB with wIndex 3 is 0x0C/0x01 ([HYPOTHESIS] that it is interface 3's; see the claims above) | one 90 B feature report, no report ID; only endpoint is interrupt OUT | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if3.reportDescriptor; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if3.endpoints |
| 4 | 3 (HID) | Apple HID driver | 0x59/0x01 LampArray | feature IDs 1 to 6: 22, 2, 28, 50, 9, 1 B | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@4; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-lamparray |
| 5 | 3 (HID) | Apple HID driver | 0xFF00/0x00 vendor | input and output 64 B, no report IDs | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@5; probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-vendor |

Interface 3 is the one zexrox drives on Windows. Its only endpoint is
interrupt OUT (probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#if3.endpoints). [HYPOTHESIS] That is
why macOS binds no HID driver to it: HID 1.11 requires an interrupt IN
endpoint (url:https://www.usb.org/sites/default/files/hid1_11.pdf), yet
Windows still lets hidapi open it (zexrox:native/host.py:455-464@840f03dc#mi_03).

### Protected collections

Chrome's WebHID rules from the claims above, applied to what macOS exposes;
the probe's WebHID list (claims above) agrees with each point except
interface 2:

- Interface 0 (boot keyboard): input and output protected, no feature reports,
  so nothing is usable; the probe was not offered it.
- Interface 1: the keyboard collection (0x01/0x06) is protected for input and
  output, the System Control collection (0x01/0x80) entirely. The Consumer
  collection (0x0C/0x01, input 2) and the four 0x01/0x00 collections (inputs
  4, 5, 7 and 11) are unprotected, so a page may read them; these are the
  collections the probe was offered. zexrox watches this interface for the Fn
  key.
- Interface 2 (mouse): input protected, yet the probe was offered it with its
  8-byte input listed, while the fully protected keyboard and System Control
  collections were left out. Why is open.
- Interface 3: not exposed by macOS, so these rules never come into play.
- Interface 4 (LampArray, usage page 0x59): unprotected; its six feature
  reports are open to WebHID. This is the standard lighting path, documented
  in the LampArray section.
- Interface 5 (vendor page 0xFF00): unprotected 64-byte input and output
  reports of unknown purpose.

WebUSB, observed on the owner's Mac: every 02A7 interface is HID class, a
protected class; claiming interface 3 failed, and the class reads to it were
refused for both recipients (see Transport options).

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
  owner ran it on 2026-10-15 in Edge 153: the claim, 6a, 6b and 6c were
  refused and 6d returned a report descriptor ([HYPOTHESIS] interface 3's),
  each as the pinned
  Chromium code predicts (claims above). So WebUSB cannot carry the control
  channel in that browser, nor, by the pinned code, in any Chromium with the
  protected-class control-transfer flag on. [HYPOTHESIS] 6b might pass in a
  browser before M148 or with that flag off; this project does not rely on it.
- (b) Native access, for example a Tauri desktop app using IOKit or libusb.
  Interface 3 has no driver bound on macOS, so a native app should be able to
  claim it without detaching a driver ([HYPOTHESIS] until tested). zexrox
  shows the same channel working natively on Windows through hidapi. The
  owner chose this option on 2026-10-15 (ADR-003 in decisions.md).
- (c) WebHID for what macOS exposes: LampArray lighting on interface 4, the
  unprotected inputs of interface 1 and the vendor reports of interface 5, all
  of which the probe was offered. It cannot reach the control channel.

### Open questions

- Can a native macOS app claim interface 3, which has no driver bound, and
  exchange the 90-byte feature reports with class SET_REPORT and GET_REPORT
  on the default control pipe (wIndex 3)? Option (b) depends on it; untested.
- Why does macOS bind no driver to interface 3? The missing interrupt-IN
  endpoint is the [HYPOTHESIS] above; nothing tested it.
- Why did WebHID offer the mouse collection, whose only report is a protected
  input, while it left out the protected keyboard and System Control
  collections?
- What do interface 5's vendor reports and interface 1's 0x01/0x00 inputs
  carry?
- OpenRGB 4418's six Windows captures were not downloaded; they may show which
  interface Razer's software uses for lighting. The issue was closed by merge
  request 2627, built by adding the keyboard to OpenRGB's existing Razer
  controller (openrgb#4418:2268400656); the reporter tested those builds and,
  after a few layout fixes, reported the lighting working
  (openrgb#4418:2277952715), and thought two small buttons share one zone
  (openrgb#4418:2269115708); the merge request closed the issue
  (openrgb#4418:01baff8aec64613fdaab9bf31fed650f89d21e70). Which interface that controller opens for the 02A7 was
  not read.

## LampArray (standard HID lighting)

USB interface 4 is a standard HID LampArray: usage page 0x59 (Lighting and
Illumination), usage 0x01, with six feature reports of 22, 2, 28, 50, 9 and
1 data bytes (probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-lamparray;
probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@4). Chrome's
WebHID offered the same collection with the same six reports and sizes on the
owner's Mac (probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.lamparray), and Chromium's protected-collection rule does not cover
page 0x59
(chromium:services/device/public/cpp/hid/hid_report_utils.cc:45@1aeca202#kPageGenericDesktop;
see Protected collections).

The table decodes, item by item, the 327-byte report descriptor on the line
after the kbd-lamparray key of the owner's dump; each Source names a byte run
that opens that report's collection. Field names are the usage names of the
USB-IF HID Usage Tables 1.5, chapter 26 (url:https://usb.org/sites/default/files/hut1_5.pdf). Size counts data bytes; each
report is one byte longer on the wire for its report ID. All six are Feature
reports, and the descriptor does not say which side reads or writes them:
Direction gives the role the HUT usage descriptions assign; HUT 26.6 sends
report 6 with a SetReport. Sizes are seen twice
(descriptor and Chrome); field names and roles rest on HUT alone, so every row
is tagged likely.

| Report | ID | Direction | Size | Fields | Source | Confidence |
|---|---|---|---|---|---|---|
| LampArrayAttributesReport | 1 | feature, get | 22 | `LampCount` (0x03), 16-bit; `BoundingBoxWidthInMicrometers`, `BoundingBoxHeightInMicrometers`, `BoundingBoxDepthInMicrometers`, `LampArrayKind`, `MinUpdateIntervalInMicroseconds` (0x04 to 0x08), 32-bit each, logical 0 to 0x7FFFFFFF. The main item's flags are 0x03 (Constant, Variable, Absolute); HUT types these usages as static values, which a set cannot change (HUT 3.4.2.2, 26.2). | probe:.ai_context/knowledge/hid-02a7-macos.txt#05590901a10185010902a102; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.lamparray; url:https://usb.org/sites/default/files/hut1_5.pdf | likely |
| LampAttributesRequestReport | 2 | feature, set | 2 | `LampId` (0x21), 16-bit, logical 0 to 65535: the lamp whose attributes report 3 returns next (HUT 26.3). | probe:.ai_context/knowledge/hid-02a7-macos.txt#c085020920a102; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.lamparray; url:https://usb.org/sites/default/files/hut1_5.pdf | likely |
| LampAttributesResponseReport | 3 | feature, get | 28 | `LampId`, 16-bit; `PositionXInMicrometers`, `PositionYInMicrometers`, `PositionZInMicrometers`, `UpdateLatencyInMicroseconds`, `LampPurposes`, 32-bit each, in that order (usages 0x23, 0x24, 0x25, 0x27, 0x26); `RedLevelCount`, `GreenLevelCount`, `BlueLevelCount`, `IntensityLevelCount`, `IsProgrammable`, `InputBinding` (0x28 to 0x2D), 8-bit each, logical 0 to 255 (HUT 26.3). | probe:.ai_context/knowledge/hid-02a7-macos.txt#c085030922a102; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.lamparray; url:https://usb.org/sites/default/files/hut1_5.pdf | likely |
| LampMultiUpdateReport | 4 | feature, set | 50 | `LampCount` (0x03) and `LampUpdateFlags` (0x55), 8-bit each, logical 0 to 8; eight `LampId` fields, 16-bit each; then 32 bytes: `RedUpdateChannel`, `GreenUpdateChannel`, `BlueUpdateChannel`, `IntensityUpdateChannel` (0x51 to 0x54) for each of up to 8 lamps, logical 0 to 255 (HUT 26.4). | probe:.ai_context/knowledge/hid-02a7-macos.txt#c085040950a102; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.lamparray; url:https://usb.org/sites/default/files/hut1_5.pdf | likely |
| LampRangeUpdateReport | 5 | feature, set | 9 | `LampUpdateFlags`, 8-bit, logical 0 to 8; `LampIdStart` (0x61) and `LampIdEnd` (0x62), 16-bit each; one red, green, blue and intensity update channel, 8-bit each (HUT 26.4). | probe:.ai_context/knowledge/hid-02a7-macos.txt#c085050960a102; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.lamparray; url:https://usb.org/sites/default/files/hut1_5.pdf | likely |
| LampArrayControlReport | 6 | feature, set | 1 | `AutonomousMode` (0x71), 8-bit, logical 0 to 1 (HUT 26.5). | probe:.ai_context/knowledge/hid-02a7-macos.txt#c085060970a102; probe:.ai_context/knowledge/webusb-probe-02a7-macos.txt#webhid.lamparray; url:https://usb.org/sites/default/files/hut1_5.pdf | likely |

Nothing has been sent to interface 4 yet. The table says what the descriptor
declares, not what the firmware does: the lamp count and the `LampArrayKind`
value (HUT lists 0x01 as keyboard) are unknown until a read-only test gets
feature report 1. Lamp positions and key bindings come from report 3, which
answers for the lamp named by a set of report 2, so reading them is not a
read-only step (HUT 26.3). Whether autonomous mode is on at power-up is
unknown; HUT 26.5 gives enabled as the default.

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
0x02:0x19, 0x02:0x9a, 0x02:0x1a, 0x02:0x9e and 0x02:0x1e. Synapse's sendCommand takes a size
argument (synapse:c1e6a425@435520#sendCommand) and passes it to the request builder
(synapse:c1e6a425@436674#_createDataSend), which writes it over byte 5 when it
is positive (synapse:c1e6a425@431246#n). For those six commands Synapse passes a
size computed from the number of keys, so the column gives that formula and
the Notes give the declared 80. The callers sit in Synapse module 43086; the
actuation and Rapid Trigger callers name their four triples through Synapse's
command table
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
| lighting | 0x03 | 0x80 | Get LED State | read | 3 | no | confirmed | synapse:c1e6a425@2026854#128; synapse:c1e6a425@2026850#3; synapse:c1e6a425@2026897#State; zexrox:native/host.py:59@840f03dc#0x80 | Confirmed: class, ID, read. Likely (Synapse; zexrox copies its names and sizes, zexrox:native/host.py:25@840f03dc): size 3, name paired by declaration order [HYPOTHESIS]; zexrox checks the size of the reads it lists (zexrox:native/host.py:119-124@840f03dc). Synapse declares it in module 69541, which 17937 does not import directly; how product 720 reaches it is not traced. Synapse module 1207 also declares a size-0 0x03:0x80 triple next to its profile command names (synapse:c1e6a425@52377#128); which one the 0498 answers is unknown. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| lighting | 0x03 | 0x00 | Set LED State | write | 3 | no | confirmed | synapse:c1e6a425@2026882#0; synapse:c1e6a425@2026878#3; synapse:c1e6a425@2026915#State; zexrox:native/host.py:355-369@840f03dc; zexrox:native/host.py:439-453@840f03dc; zexrox:native/host.py:506-525@840f03dc | Confirmed: class, ID, write, size 3. zexrox's own host builds this set for the real 02A7 (size 3; arguments 0x00, LED id 0x08 for the game-mode LED, then 0x01 on or 0x00 off) and sends it under its device lock (zexrox:native/host.py:355-369@840f03dc; zexrox:native/host.py:439-453@840f03dc; zexrox:native/host.py:455-457@840f03dc); Synapse declares size 3 as well. Likely (Synapse; zexrox uses the same name): name. zexrox answers Synapse's own LED-8 sets on the host and forwards other LED ids (zexrox:native/host.py:506-525@840f03dc). The meaning of argument byte 0 and LED ids other than 8 are not traced. Synapse declares it in module 69541, not imported by 17937. 0498 firmware: supported for LED id 8 (zexrox sends it to the 02A7 with a payload it attributes to captures, zexrox:native/host.py:356-358@840f03dc; it does not check the reply status); other LED ids unknown. |
| lighting | 0x0f | 0x80 | Get Chroma Region ID List | read | 80 | no | confirmed | synapse:c1e6a425@10190#128; synapse:c1e6a425@10184#80; synapse:c1e6a425@10210#Region; zexrox:native/host.py:23@840f03dc#0x80 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): name, declared right after the triple; size 80 as declared, the size Synapse sends is not traced. Synapse declares every class-0x0F triple below in module 436, which the transport module 17937 imports (synapse:c1e6a425@404219#436); the code that sends this one for product 720 is not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| lighting | 0x0f | 0x82 | Get Chroma Effect | read | 80 | no | confirmed | synapse:c1e6a425@10280#130; synapse:c1e6a425@10274#80; synapse:c1e6a425@11260#Effect; zexrox:native/host.py:23@840f03dc#0x82 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): name, paired by declaration order in module 436 [HYPOTHESIS]. Size: declared 80; a Synapse module outside 17937 sends exports named ms and KM (in module 436, this triple and this name) at size 5 with arguments profile, region, 13, 0 and one more byte (synapse:c1e6a425@156412#KM; synapse:c1e6a425@156417#5); that module's import of 436 and the size product 720 sends are not traced [HYPOTHESIS]. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| lighting | 0x0f | 0x02 | Set Chroma Effect | write | 6+3×colours | no | likely | synapse:c1e6a425@10310#2; synapse:c1e6a425@10304#80; synapse:c1e6a425@11282#Effect; synapse:c1e6a425@429571#aA; synapse:c1e6a425@429698#6 | Synapse only (likely). Module 17937 builds this set from the module-436 triple: byte 0 profile, 1 region, 2 effect ID, 3 flags, 4 rate, 5 colour count, then RGB triples from byte 6, and passes 6 plus the colour bytes as the size instead of the declared 80 (synapse:c1e6a425@429571#aA; synapse:c1e6a425@429698#6). Name paired by declaration order [HYPOTHESIS]; the builder's field names fit it. Effect ID values not traced. zexrox does not list it; its host forwards unlisted well-formed writes, lighting included (zexrox:native/host.py:19-21@840f03dc). 0498 firmware: unknown. |
| lighting | 0x0f | 0x03 | Set Chroma Frame | write | 5+colour bytes | no | likely | synapse:c1e6a425@10338#3; synapse:c1e6a425@10332#80; synapse:c1e6a425@11304#Frame; synapse:c1e6a425@481515#Qe; synapse:c1e6a425@427390#sk; synapse:c1e6a425@427506#5 | Synapse only (likely). Module 17937 pairs this triple with the name Set Chroma Frame in its lighting-engine frame setter, which sends one request per key row (synapse:c1e6a425@481515#Qe). Its frame builder fills byte 0 profile, 1 region, 2 row, 3 start, 4 end, then the colours from byte 5, and reports 5 plus the colour bytes as the set size (synapse:c1e6a425@427390#sk; synapse:c1e6a425@427506#5); the caller that sends it was not read, so the sent size is [HYPOTHESIS] (declared 80). This is the per-key custom frame; colour byte order not traced. zexrox forwards it as an unlisted write (zexrox:native/host.py:19-21@840f03dc). 0498 firmware: unknown. |
| lighting | 0x0f | 0x84 | Get Chroma Brightness | read | 3 | no | confirmed | synapse:c1e6a425@10392#132; synapse:c1e6a425@10387#3; synapse:c1e6a425@11325#Brightness; zexrox:native/host.py:23@840f03dc#0x84 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 3 as declared, name paired by declaration order in module 436 [HYPOTHESIS]. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| lighting | 0x0f | 0x04 | Set Chroma Brightness | write | 3 | no | likely | synapse:c1e6a425@10422#4; synapse:c1e6a425@10417#3; synapse:c1e6a425@11351#Brightness | Synapse only (likely): set ID, size 3 as declared (sent size not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. zexrox forwards it as an unlisted write (zexrox:native/host.py:19-21@840f03dc). 0498 firmware: unknown. |
| lighting | 0x0f | 0x90 | Get Force Chroma Ctrl | read | 1 | no | confirmed | synapse:c1e6a425@10711#144; synapse:c1e6a425@10706#1; synapse:c1e6a425@10752#Force; zexrox:native/host.py:23@840f03dc#0x90 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 1, name paired by declaration order [HYPOTHESIS]. What it controls is not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| lighting | 0x0f | 0x10 | Set Force Chroma Ctrl | write | 1 | no | likely | synapse:c1e6a425@10740#16; synapse:c1e6a425@10735#1; synapse:c1e6a425@10778#Force | Synapse only (likely): set ID, size 1 as declared; name paired by declaration order [HYPOTHESIS]. Argument layout not traced. 0498 firmware: unknown. |
| keymap | 0x02 | 0x84 | Get Button ID List | read | 80 | no | confirmed | synapse:c1e6a425@1043740#132; synapse:c1e6a425@1043735#80; synapse:c1e6a425@1043754#Button; zexrox:native/host.py:40@840f03dc#0x84 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name. Synapse ends the name in lower-case list and declares no matching set. Synapse declares every class-0x02 keymap triple below in module 36675; module 43086 imports it (synapse:c1e6a425@1247391#36675) and the transport module 17937 imports 43086 (synapse:c1e6a425@401913#43086); the code that sends this read is not traced. zexrox rejects a read it lists at any other size, except four exempt reads (zexrox:native/host.py:119-126@840f03dc). Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x8c | Get Single Button Assignment | read | 80 | no | confirmed | synapse:c1e6a425@1044123#140; synapse:c1e6a425@1044118#80; synapse:c1e6a425@1044172#Button; zexrox:native/host.py:41@840f03dc#0x8c | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name. Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x0c | Set Single Button Assignment | write | 80 | no | likely | synapse:c1e6a425@1044153#12; synapse:c1e6a425@1044148#80; synapse:c1e6a425@1044205#Button | Synapse only (likely): set ID, size 80 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| keymap | 0x02 | 0x8d | Get Single Key Assignment | read | 80 | no | confirmed | synapse:c1e6a425@1044247#141; synapse:c1e6a425@1044242#80; synapse:c1e6a425@1044299#Assignment; zexrox:native/host.py:42@840f03dc#0x8d; synapse:c1e6a425@1252770#sendCommand; synapse:c1e6a425@1252278#mode | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name. Synapse's callee in module 43086 fills argument bytes 0-2 from its three inputs and passes its optional size argument, default -1 (synapse:c1e6a425@1252770#sendCommand); the transport builder keeps the declared size when that argument is -1 (synapse:c1e6a425@431236#isNaN). Reply, as Synapse's parser reads it (likely, Synapse only): byte 0 a value it calls classId, 1 key id, 2 mode (the Hypershift layer, see Gaps), 3 function id, 4 data size, 5-9 data (synapse:c1e6a425@1252278#mode). [HYPOTHESIS] the three inputs are classId, key id and mode, mirroring the reply. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x0d | Set Single Key Assignment | write | 80 | no | likely | synapse:c1e6a425@1044276#13; synapse:c1e6a425@1044271#80; synapse:c1e6a425@1044329#Assignment; synapse:c1e6a425@1253348#concat | Synapse only (likely): set ID, size 80; name paired by declaration order [HYPOTHESIS]. Synapse's callee writes five input bytes, then a data array, and zero-pads to the declared size (synapse:c1e6a425@1253348#concat); it passes its optional size argument, default -1, which keeps the declared size (synapse:c1e6a425@431236#isNaN); callers not traced. [HYPOTHESIS] the five bytes follow the 0x8d reply order (classId, key id, mode, function id, data size). Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| keymap | 0x02 | 0x8e | Get Button Assignment List | read | 80 | no | confirmed | synapse:c1e6a425@1044364#142; synapse:c1e6a425@1044359#80; synapse:c1e6a425@1044395#List; zexrox:native/host.py:43@840f03dc#0x8e | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name. Synapse declares no matching set. Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x8f | Get Key Assignment List | read | 80 | no | confirmed | synapse:c1e6a425@1044424#143; synapse:c1e6a425@1044419#80; synapse:c1e6a425@1044479#List; zexrox:native/host.py:44@840f03dc#0x8f | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name. Synapse also declares a size-80 0x02:0x0f triple beside it that no name binds (synapse:c1e6a425@1044454#15). Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x92 | Get Single Key Assignment (analog) | read | 80 | no | confirmed | synapse:c1e6a425@1044561#146; synapse:c1e6a425@1044556#80; synapse:c1e6a425@1044610#Analog; zexrox:native/host.py:45@840f03dc#0x92 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name. Name: Synapse's has Analog after Single; this doc moves it to a suffix, so that this doc does not repeat Synapse's 32-character name verbatim (this repo's copy rule) and to tell it from 0x8d. Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x12 | Set Single Key Assignment (analog) | write | 80 | no | likely | synapse:c1e6a425@1044591#18; synapse:c1e6a425@1044586#80; synapse:c1e6a425@1044647#Analog | Synapse only (likely): set ID, size 80 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Name: Synapse's has Analog after Single; this doc moves it to a suffix, so that this doc does not repeat Synapse's 32-character name verbatim (this repo's copy rule) and to tell it from 0x0d. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| keymap | 0x02 | 0x9b | Get Multi Mod-Tap Key Assignment | read | 80 | no | confirmed | synapse:c1e6a425@1045588#155; synapse:c1e6a425@1045583#80; synapse:c1e6a425@1045641#Tap; zexrox:native/host.py:48@840f03dc#0x9b | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name. Name: Synapse writes Mod Tap without the hyphen; this doc adds it so that this doc does not repeat Synapse's 32-character name verbatim (this repo's copy rule). Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x1b | Set Multi Mod-Tap Key Assignment | write | 80 | no | likely | synapse:c1e6a425@1045618#27; synapse:c1e6a425@1045613#80; synapse:c1e6a425@1045679#Tap | Synapse only (likely): set ID, size 80 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Name: Synapse writes Mod Tap without the hyphen; this doc adds it so that this doc does not repeat Synapse's 32-character name verbatim (this repo's copy rule). Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| keymap | 0x02 | 0x9e | Get Multi Key Assignment | read | 1+9×keys | no | confirmed | synapse:c1e6a425@1045788#158; synapse:c1e6a425@1045783#80; synapse:c1e6a425@1045831#Multi; zexrox:native/host.py:49@840f03dc#0x9e; synapse:c1e6a425@1263682#9; synapse:c1e6a425@1263444#8; synapse:c1e6a425@1263649#keyId; synapse:c1e6a425@1263070#keyId | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): name. Size: Synapse declares 80 but its callee in module 43086 sends 1+9×keys for up to 8 keys (likely, Synapse only: synapse:c1e6a425@1263682#9; synapse:c1e6a425@1263444#8); zexrox notes Synapse sends this read at more than one size and exempts it from its size check (zexrox:native/host.py:121-124@840f03dc). Arguments (likely, Synapse only): byte 0 one input ([HYPOTHESIS] classId, as in the reply), then per key a 9-byte slot whose first two bytes are key id and mode (synapse:c1e6a425@1263649#keyId). Reply, as Synapse's parser reads it (likely): byte 0 classId, then 9-byte entries of key id, mode, function id, data size and 5 data bytes (synapse:c1e6a425@1263070#keyId). Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x1e | Set Multi Key Assignment | write | 1+9×keys | no | likely | synapse:c1e6a425@1045818#30; synapse:c1e6a425@1045813#80; synapse:c1e6a425@1045861#Multi; synapse:c1e6a425@1264284#9; synapse:c1e6a425@1263877#8; synapse:c1e6a425@1264117#functionId | Synapse only (likely): set ID; name paired by declaration order [HYPOTHESIS]. Size: Synapse declares 80 but its callee in module 43086 sends 1+9×keys for up to 8 keys (synapse:c1e6a425@1264284#9; synapse:c1e6a425@1263877#8); zexrox checks sizes only for the reads it lists, so it never checks this set's size (zexrox:native/host.py:119-124@840f03dc). Arguments: byte 0 classId (named only by Synapse's log label, synapse:c1e6a425@1263807#classId), then per key 9 bytes of key id, mode, function id, data size and 5 data bytes (synapse:c1e6a425@1264117#functionId). Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| keymap | 0x02 | 0xb2 | Get Number of Keymaps | read | 1 | no | confirmed | synapse:c1e6a425@1048510#178; synapse:c1e6a425@1048506#1; synapse:c1e6a425@1048524#Number; zexrox:native/host.py:51@840f03dc#0xb2 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 1, name. Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x33 | Set Add Keymap | write | 2 | no | likely | synapse:c1e6a425@1048566#51; synapse:c1e6a425@1048562#2; synapse:c1e6a425@1048579#Add | Synapse only (likely): ID, write, size 2 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| keymap | 0x02 | 0x34 | Set Remove Keymap | write | 2 | no | likely | synapse:c1e6a425@1048614#52; synapse:c1e6a425@1048610#2; synapse:c1e6a425@1048627#Remove | Synapse only (likely): ID, write, size 2 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| keymap | 0x02 | 0xb5 | Get Keymap Name With Offset | read | 80 | no | confirmed | synapse:c1e6a425@1048666#181; synapse:c1e6a425@1048661#80; synapse:c1e6a425@1048716#Name; zexrox:native/host.py:52@840f03dc#0xb5 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name. Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x35 | Set Keymap Name With Offset | write | 80 | no | likely | synapse:c1e6a425@1048696#53; synapse:c1e6a425@1048691#80; synapse:c1e6a425@1048749#Name | Synapse only (likely): set ID, size 80 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| keymap | 0x02 | 0xb6 | Get Active Keymap | read | 2 | no | confirmed | synapse:c1e6a425@1048790#182; synapse:c1e6a425@1048786#2; synapse:c1e6a425@1048832#Active; zexrox:native/host.py:53@840f03dc#0xb6 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 2, name. Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x36 | Set Active Keymap | write | 2 | no | likely | synapse:c1e6a425@1048819#54; synapse:c1e6a425@1048815#2; synapse:c1e6a425@1048855#Active | Synapse only (likely): set ID, size 2 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| keymap | 0x02 | 0xb7 | Get OBM Keymap | read | 1 | no | confirmed | synapse:c1e6a425@1048893#183; synapse:c1e6a425@1048889#1; synapse:c1e6a425@1048935#OBM; zexrox:native/host.py:54@840f03dc#0xb7 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 1, name. Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| keymap | 0x02 | 0x37 | Set OBM Keymap | write | 1 | no | likely | synapse:c1e6a425@1048922#55; synapse:c1e6a425@1048918#1; synapse:c1e6a425@1048955#OBM | Synapse only (likely): set ID, size 1 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| macro | 0x06 | 0x80 | Get Number of Macros | read | 2 | no | confirmed | synapse:c1e6a425@2574711#128; synapse:c1e6a425@2574707#2; synapse:c1e6a425@2574734#Macros; zexrox:native/host.py:55@840f03dc#0x80 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 2, name. Synapse declares every class-0x06 macro triple below in module 92412, which the transport module 17937 imports (synapse:c1e6a425@401924#92412); the code that sends them is not traced. Synapse module 1207 also declares a size-0 0x06:0x80 triple next to LED names (synapse:c1e6a425@53594#128); which one the 0498 answers is unknown. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| macro | 0x06 | 0x02 | Create New Macro | write | 2 | no | likely | synapse:c1e6a425@2574792#2; synapse:c1e6a425@2574788#2; synapse:c1e6a425@2574800#Create | Synapse only (likely): ID, write, size 2 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| macro | 0x06 | 0x03 | Delete Macro | write | 2 | no | likely | synapse:c1e6a425@2574840#3; synapse:c1e6a425@2574836#2; synapse:c1e6a425@2574847#Delete | Synapse only (likely): ID, write, size 2 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| macro | 0x06 | 0x85 | Get Macro Data | read | 80 | no | likely | synapse:c1e6a425@2574937#133; synapse:c1e6a425@2574932#80; synapse:c1e6a425@2574983#Data | Synapse only (likely): ID, read, size 80 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]; zexrox does not list it. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown. |
| macro | 0x06 | 0x88 | Get Macro Data Size | read | 6 | no | confirmed | synapse:c1e6a425@2575115#136; synapse:c1e6a425@2575111#6; synapse:c1e6a425@2575166#Size; zexrox:native/host.py:35@840f03dc#0x88 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 6, name. Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| macro | 0x06 | 0x08 | Allocate Macro Data Size | write | 6 | no | likely | synapse:c1e6a425@2575144#8; synapse:c1e6a425@2575140#6; synapse:c1e6a425@2575175#Allocate | Synapse only (likely): set ID, size 6 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| macro | 0x06 | 0x89 | Get Macro Memory Data | read | 80 | no | confirmed | synapse:c1e6a425@2575224#137; synapse:c1e6a425@2575219#80; synapse:c1e6a425@2575270#Memory; zexrox:native/host.py:36@840f03dc#0x89 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name. Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| macro | 0x06 | 0x09 | Set Macro Memory Data | write | 80 | no | likely | synapse:c1e6a425@2575253#9; synapse:c1e6a425@2575248#80; synapse:c1e6a425@2575296#Memory | Synapse only (likely): set ID, size 80 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| macro | 0x06 | 0x8a | Get Macro Memory Management | read | 6 | no | confirmed | synapse:c1e6a425@2575331#138; synapse:c1e6a425@2575327#6; synapse:c1e6a425@2575384#Management; zexrox:native/host.py:37@840f03dc#0x8a | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 6, name. Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| macro | 0x06 | 0x0a | Set Macro Memory Management | write | 6 | no | likely | synapse:c1e6a425@2575359#10; synapse:c1e6a425@2575355#6; synapse:c1e6a425@2575416#Management | Synapse only (likely): set ID, size 6 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| macro | 0x06 | 0x8b | Get Macro ID List With Offset | read | 80 | no | confirmed | synapse:c1e6a425@2575451#139; synapse:c1e6a425@2575446#80; synapse:c1e6a425@2575500#List; zexrox:native/host.py:38@840f03dc#0x8b | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name. Synapse also declares a size-80 0x06:0x0b triple beside it that no name binds (synapse:c1e6a425@2575481#11). Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| macro | 0x06 | 0x8c | Get Macro Name With Offset | read | 80 | no | confirmed | synapse:c1e6a425@2575542#140; synapse:c1e6a425@2575537#80; synapse:c1e6a425@2575589#Name; zexrox:native/host.py:39@840f03dc#0x8c | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name. Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| macro | 0x06 | 0x0c | Set Macro Name With Offset | write | 80 | no | likely | synapse:c1e6a425@2575571#12; synapse:c1e6a425@2575566#80; synapse:c1e6a425@2575620#Name | Synapse only (likely): set ID, size 80 as declared (the size Synapse sends is not traced); name paired by declaration order [HYPOTHESIS]. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| macro | 0x06 | 0x8e | Get Macro Storage Info | read | 14 | no | confirmed | synapse:c1e6a425@2575715#142; synapse:c1e6a425@2575710#14; synapse:c1e6a425@2575762#Storage; zexrox:native/host.py:57@840f03dc#0x8e | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 14, name. Synapse also declares a size-14 0x06:0x0e triple beside it that no name binds (synapse:c1e6a425@2575746#14). Callers not traced. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| profile | 0x05 | 0x80 | Get Number of Profiles | read | 1 | no | confirmed | synapse:c1e6a425@2096805#128; synapse:c1e6a425@2096801#1; synapse:c1e6a425@2096818#Number; synapse:c1e6a425@469817#sendCommand; zexrox:native/host.py:31@840f03dc#0x80 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 1, name; Synapse passes no size argument, so it sends the declared size. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| profile | 0x05 | 0x81 | Get Profiles ID List | read | 80 | no | confirmed | synapse:c1e6a425@2096861#129; synapse:c1e6a425@2096856#80; synapse:c1e6a425@2096874#Profiles; synapse:c1e6a425@470035#sendCommand; zexrox:native/host.py:32@840f03dc#0x81 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 80, name; sent at the declared size (no size argument). Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| profile | 0x05 | 0x02 | Create New Profile | write | 1 | no | likely | synapse:c1e6a425@2096914#2; synapse:c1e6a425@2096910#1; synapse:c1e6a425@2096921#Create; synapse:c1e6a425@471242#sendCommand | Synapse only (likely): ID, write, size 1, name; sent at the declared size (no size argument). Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| profile | 0x05 | 0x03 | Set Delete Profile | write | 1 | no | likely | synapse:c1e6a425@2096963#3; synapse:c1e6a425@2096959#1; synapse:c1e6a425@2096974#Delete; synapse:c1e6a425@471500#sendCommand | Synapse only (likely): ID, write, size 1, name; sent at the declared size (no size argument). Argument layout not traced. Removes a profile from onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| profile | 0x05 | 0x84 | Get Active Profile ID | read | 1 | no | confirmed | synapse:c1e6a425@2097012#132; synapse:c1e6a425@2097008#1; synapse:c1e6a425@2097051#Active; synapse:c1e6a425@471621#sendCommand; zexrox:native/host.py:63@840f03dc#0x84 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 1, name; sent at the declared size (no size argument). Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| profile | 0x05 | 0x04 | Set Active Profile ID | write | 1 | no | likely | synapse:c1e6a425@2097040#4; synapse:c1e6a425@2097036#1; synapse:c1e6a425@2097077#Active; synapse:c1e6a425@471903#sendCommand | Synapse only (likely): set ID, size 1, name; sent at the declared size (no size argument). Argument layout not traced. Switches the active onboard profile; whether the choice is kept in onboard memory is not traced ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| profile | 0x05 | 0x88 | Get Profile Name With Offset | read | 80 | no | confirmed | synapse:c1e6a425@2097222#136; synapse:c1e6a425@2097217#80; synapse:c1e6a425@2097271#Name; synapse:c1e6a425@404689#mp; synapse:c1e6a425@404699#s; synapse:c1e6a425@470248#M; zexrox:native/host.py:33@840f03dc#0x88; zexrox:native/host.py:121-124@840f03dc | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): name. Size: Synapse declares 80; its callee hands its fifth argument to sendCommand as the size (synapse:c1e6a425@404699#s), and the method getProfileName passes its own optional fourth argument there, -1 (keep the declared 80) when it is left out (synapse:c1e6a425@470248#M). The callers of getProfileName were not traced, so the other sizes Synapse sends are unknown; zexrox skips its size check for this read because Synapse uses more than one size for it (zexrox:native/host.py:121-124@840f03dc). Arguments (likely, Synapse only): data[0] is getProfileName's first argument and data[1] to data[4] hold two 2-byte values built by helpers not traced; the reply decoder that follows names reply data[0] profileId and data[1] to data[2] offset (synapse:c1e6a425@404689#mp). Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| profile | 0x05 | 0x08 | Set Profile Name With Offset | write | 80 | no | likely | synapse:c1e6a425@2097252#8; synapse:c1e6a425@2097247#80; synapse:c1e6a425@2097304#Name; synapse:c1e6a425@470900#sendCommand | Synapse only (likely): set ID, size 80 as declared; setProfileName passes its optional fifth argument as the size, -1 (which keeps the declared 80) when omitted, and its callers are not traced (synapse:c1e6a425@470940#l); name paired with the triple where Synapse sends it. Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| profile | 0x05 | 0x8a | Get Max Profiles Supported | read | 1 | no | confirmed | synapse:c1e6a425@2097395#138; synapse:c1e6a425@2097391#1; synapse:c1e6a425@2097409#Max; synapse:c1e6a425@469589#sendCommand; zexrox:native/host.py:30@840f03dc#0x8a; zexrox:native/host.py:25-28@840f03dc | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 1, name; sent at the declared size (no size argument). zexrox notes that Synapse's profile setup sends this read before asking for the profile count and list, and that its 0.1.3 build stopped the size-1 request before the keyboard could reply; this version lists size 1 and forwards it (zexrox:native/host.py:25-28@840f03dc). No 0498 reply is recorded. Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown. |
| profile | 0x05 | 0x0b | Set Profile Reset | write | 1 | no | likely | synapse:c1e6a425@2097455#11; synapse:c1e6a425@2097451#1; synapse:c1e6a425@2097475#Reset; synapse:c1e6a425@405198#sendCommand | Synapse only (likely): ID, write, size 1, name; sent at the declared size (no size argument). Its ID is not Get Max Profiles Supported's with bit 7 cleared: Synapse's profile module declares no 0x05:0x0a. Argument layout not traced. Resets onboard profile data ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| profile | 0x05 | 0x8c | Get Profile Color | read | 4 | no | confirmed | synapse:c1e6a425@2097504#140; synapse:c1e6a425@2097500#4; synapse:c1e6a425@2097552#Color; synapse:c1e6a425@472256#sendCommand; zexrox:native/host.py:34@840f03dc#0x8c | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 4, name; sent at the declared size (no size argument). Reply layout not traced. Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| profile | 0x05 | 0x0c | Set Profile Color | write | 4 | no | likely | synapse:c1e6a425@2097532#12; synapse:c1e6a425@2097528#4; synapse:c1e6a425@2097574#Color; synapse:c1e6a425@472663#sendCommand | Synapse only (likely): set ID, size 4, name; sent at the declared size (no size argument). Argument layout not traced. Changes onboard memory ([HYPOTHESIS], from the name). 0498 firmware: unknown. |
| polling | 0x00 | 0x85 | Get Device Polling Period | read | 1 | no | likely | synapse:c1e6a425@281007#133; synapse:c1e6a425@281003#1; synapse:c1e6a425@281053#Polling; synapse:c1e6a425@1096496#YT; synapse:c1e6a425@1096197#RATE_1000Hz | Synapse only (likely): class, ID, read, size 1, name; zexrox does not list it. Synapse sends it with no data and no size argument (synapse:c1e6a425@1096496#YT) and maps reply data[0] through a rate enum to 1000, 500, 333, 250, 200, 125 or 100 Hz, 100 for any other value (synapse:c1e6a425@1096197#RATE_1000Hz); the enum's byte values are not traced (see Gaps). Not on the diagnostics list in this version. 0498 firmware: unknown. |
| polling | 0x00 | 0x05 | Set Device Polling Period | write | 1 | no | likely | synapse:c1e6a425@281035#5; synapse:c1e6a425@281031#1; synapse:c1e6a425@281083#Polling; synapse:c1e6a425@1097090#uu; synapse:c1e6a425@1096716#RATE_1000Hz | Synapse only (likely): ID, write, size 1, name; sent at the declared size (no size argument). data[0] is the rate-enum value for 1000, 500, 333, 250, 200, 125 or 100 Hz; Synapse refuses any other rate before sending (synapse:c1e6a425@1096716#RATE_1000Hz, synapse:c1e6a425@1097090#uu). Whether the rate is kept in onboard memory is not traced ([HYPOTHESIS] that it is). 0498 firmware: unknown. |
| polling | 0x00 | 0xc0 | Get USB High-Speed Polling Period | read | 2 | no | confirmed | synapse:c1e6a425@283131#192; synapse:c1e6a425@283127#2; synapse:c1e6a425@283182#Speed; synapse:c1e6a425@1100312#VE; synapse:c1e6a425@1099936#RATE_8000Hz; zexrox:native/host.py:64@840f03dc#0xc0 | Confirmed: class, ID, read. Likely (Synapse; zexrox's list copies it): size 2, name. Name: Synapse writes High Speed without the hyphen; this doc adds it so that it does not repeat a source string of 32 or more characters. Synapse writes its one argument to data[0] and sends the declared size (synapse:c1e6a425@1100312#VE); its decoder names reply data[0] profileId and maps data[1] through a second rate enum to 8000, 4000, 2000, 1000, 500, 250 or 125 Hz, 8000 for any other value (synapse:c1e6a425@1099936#RATE_8000Hz). Not on the diagnostics list in this version. 0498 firmware: unknown (zexrox only lists and forwards it). |
| polling | 0x00 | 0x40 | Set USB High-Speed Polling Period | write | 2 | no | likely | synapse:c1e6a425@283160#64; synapse:c1e6a425@283156#2; synapse:c1e6a425@283221#Speed; synapse:c1e6a425@1100920#tg; synapse:c1e6a425@1100536#RATE_8000Hz; synapse:c1e6a425@1100883#s | Synapse only (likely): ID, write, size 2, name (hyphen added as for 0x00:0xc0); sent at the declared size (no size argument). data[0] is Synapse's first argument and data[1] the rate-enum value for 8000, 4000, 2000, 1000, 500, 250 or 125 Hz; Synapse refuses any other rate (synapse:c1e6a425@1100536#RATE_8000Hz, synapse:c1e6a425@1100883#s, synapse:c1e6a425@1100920#tg). [HYPOTHESIS] data[0] is a profile id, as the get's decoder names it, so the rate is kept per onboard profile. 0498 firmware: unknown. |

Profile and polling rows. Synapse declares the class 0x05 triples and names in
module 74465, which exports each under a short alias
(synapse:c1e6a425@2096559#AG). The module that imports it
(synapse:c1e6a425@404238#74465) sends every profile command by passing a
triple alias and a name alias together, and that call pairs each class 0x05
name in the rows with its triple (for example
synapse:c1e6a425@469817#sendCommand). The four polling triples and names are
in module 11880 (synapse:c1e6a425@279837#IL,
synapse:c1e6a425@279902#LF), and a module that imports it
(synapse:c1e6a425@1093540#11880) sends them the same way. Get and Set Profile
Name With Offset pass a size argument (see their rows); the other calls send
the declared size. The class 0x05 reads zexrox lists are confirmed on the same
terms as the class 0x02 reads (zexrox:native/host.py:29-34@840f03dc), and so
is 0x00:0xc0 (zexrox:native/host.py:64@840f03dc#0xc0). Get Device Polling
Period and all eight sets in these groups appear only in Synapse.

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

### Gaps

- lighting: OpenRGB's Razer controller, which issue 4418 reports drives the 02A7's lighting, was not read for these rows, so their 0498 verdicts stay unknown apart from LED id 8 — openrgb#4418:2268400656; openrgb#4418:2277608481; openrgb#4418:2277952715
- keymap: Synapse also declares 0x02:0xa8 and 0x02:0x28 at size 1 beside its Function Key Swap names; the same IDs at size 2 are the Bottom Dead-Zone rows under actuation, no keymap caller of the size-1 pair was traced, and which meaning the 0498 answers is unknown — synapse:c1e6a425@1048306#168; synapse:c1e6a425@1048302#1; synapse:c1e6a425@1048278#40; synapse:c1e6a425@1048274#1; synapse:c1e6a425@1048320#Function
- keymap: function ids and the 5 data bytes of a key assignment are not decoded here; Synapse's parser names function ids through a module 82407 table and keeps the data bytes raw — synapse:c1e6a425@1252344#functionIdEnum; synapse:c1e6a425@1247402#82407
- hypershift: Synapse declares no Hypershift command; its key-assignment calls carry the layer as a mode byte (byte 2 of the 0x02:0x8d reply, the second byte of each 9-byte slot of 0x02:0x9e and 0x02:0x1e), which its parser looks up in a module 82407 table that maps NormalMode to 0 and HypershiftMode to 1; whether the 0498 keeps a Hypershift layer is not captured — synapse:c1e6a425@1252278#mode; synapse:c1e6a425@1264117#functionId; synapse:c1e6a425@1247402#82407; synapse:c1e6a425@2283139#zN; synapse:c1e6a425@2285490#HypershiftMode
- macro: the macro data format (what 0x06:0x09 carries) and how a key assignment selects a macro are not traced — synapse:c1e6a425@2575253#9; synapse:c1e6a425@401924#92412
- profile: Synapse's battery module 18994 declares size-0 class 0x05 triples at the profile IDs 0x80, 0x81, 0x84, 0x88, 0x8a and 0x8c, the first named Get Battery List, while a search finds no class 0x05 triple in module 1207; this document reads class 0x05 through module 74465, the one the transport code imports, and which device module the product 720 page uses for a keyboard is not traced — synapse:c1e6a425@525086#128; synapse:c1e6a425@525098#Battery; synapse:c1e6a425@525119#129; synapse:c1e6a425@525237#132; synapse:c1e6a425@525484#136; synapse:c1e6a425@525584#138; synapse:c1e6a425@525787#140; synapse:c1e6a425@404238#74465
- profile: module 74465 also declares 0x05:0x85 with 0x05:0x05 (size 80), 0x05:0x87 with 0x05:0x07 (size 1) and 0x05:0x89 with 0x05:0x09 (size 2) without binding a name to them, so they have no rows — synapse:c1e6a425@2097120#133; synapse:c1e6a425@2097171#135; synapse:c1e6a425@2097345#137
- polling: the byte values behind Synapse's two rate enums are not traced, so neither polling read's reply nor either set's argument can be encoded from this document yet — synapse:c1e6a425@1096197#RATE_1000Hz; synapse:c1e6a425@1099936#RATE_8000Hz

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

## Feature matrix

One row per feature that Synapse's keyboard pages configure, with this
document's verdict for the RZ03-0498 firmware. yes needs evidence specific to
the 0498: a zexrox capture or rewrite, or a packet that zexrox's own host
builds and sends to a real 02A7. no means the zexrox README says the 0498
firmware lacks the feature (zexrox:README.md:25@840f03dc#firmware). Everything
else is unknown. Forwarding is not evidence: zexrox passes most of Synapse's
reports to the keyboard unchanged (zexrox:native/host.py:526-532@840f03dc),
which shows that Synapse sends them, not that the 0498 implements them, and
evidence about the 02D0 alone gives unknown. The verdicts repeat the 0498
firmware notes of the Commands rows.

Synapse UI area names the Commands group and commands behind each feature
and, where there is one, the flag that enables it in the product-720 (02D0)
configuration in Synapse module 5315 (synapse:c1e6a425@235199#720,
synapse:c1e6a425@235774#brightness). It is not
the title of a Synapse screen; the screens were not traced. That configuration
lists what Synapse offers on the 02D0, not what the 0498 supports. Modules
41782 and 78193 hold two more product-720 configurations with shorter feature
lists (synapse:c1e6a425@1211158#720, synapse:c1e6a425@2150414#720); which one
the page uses, and which device module it loads, is not traced. Confidence is likely
on every row: each verdict rests on one source (zexrox for yes and no; for
unknown, the cited rows, where neither source holds a 0498 reply).

| Feature | Synapse UI area | RZ03-0498 | Confidence | Source |
|---|---|---|---|---|
| Per-key actuation | actuation: 0x02:0x99, 0x02:0x19 | unknown | likely | zexrox:native/host.py:46@840f03dc#0x99; zexrox:native/host.py:526-532@840f03dc |
| Rapid Trigger | rapid-trigger: 0x02:0x9a, 0x02:0x1a | unknown | likely | zexrox:native/host.py:47@840f03dc#0x9a; zexrox:native/host.py:526-532@840f03dc |
| Continuous Rapid Trigger | rapid-trigger: 0x02:0xa0, 0x02:0x20 | unknown | likely | zexrox:native/host.py:66@840f03dc#0xa0 |
| Snap Tap, one key pair | snap-tap: Synapse sends 0x02:0xa7, 0x02:0x27 and zexrox sends 0x02:0xa1, 0x02:0x21 in their place (see Snap Tap on the 0498); 02D0 flag `snapTap` | yes | likely | zexrox:native/host.py:172-174@840f03dc; zexrox:native/host.py:178-194@840f03dc; synapse:c1e6a425@235844#snapTap |
| Single-key Snap Tap | snap-tap: 0x02:0xac, 0x02:0x2c; 02D0 flag `singleKeySnapTap` | no | likely | zexrox:README.md:25@840f03dc#single; synapse:c1e6a425@235945#SnapTap |
| Bottom dead-zone | actuation: 0x02:0xa8, 0x02:0x28; 02D0 flag `bottomDeadZone` | no | likely | zexrox:README.md:25@840f03dc#deadzone; synapse:c1e6a425@235897#bottomDeadZone |
| Analog report | Synapse's Get Analog Report Mode, 0x02:0xaa, which zexrox lists (no row here) | no | likely | zexrox:README.md:25@840f03dc#report; zexrox:native/host.py:67@840f03dc#0xaa |
| Analog V3 | actuation: 0x02:0xaf; 02D0 flag `analogKeyboardV3` | no | likely | zexrox:README.md:25@840f03dc#V3; synapse:c1e6a425@235812#V3 |
| Mod-Tap | keymap: 0x02:0x9b, 0x02:0x1b; the 02D0 configuration sets `modTap` false | unknown | likely | zexrox:native/host.py:48@840f03dc#0x9b; synapse:c1e6a425@235818#modTap |
| Dual keypress priority | snap-tap: 0x02:0xb1, 0x02:0x31; 02D0 flag `dualKeypressPriority` | unknown | likely | zexrox:native/host.py:62@840f03dc#0xb1; synapse:c1e6a425@235968#Priority |
| Game Mode key lock | Game Mode Selection, 0x00:0xda and 0x00:0x5a, which zexrox answers on the host (no row here); 02D0 flag `gameModeSelection` | no | likely | zexrox:README.md:25@840f03dc#Game; zexrox:README.md:26@840f03dc#Windows; zexrox:native/host.py:506-525@840f03dc; synapse:c1e6a425@235915#gameModeSelection |
| Tournament Mode | Synapse's Get Tournament Mode, 0x00:0xdb, which zexrox lists (no row here); 02D0 flag `tournamentMode` | no | likely | zexrox:README.md:25@840f03dc#Tournament; zexrox:native/host.py:68@840f03dc#0xdb; synapse:c1e6a425@235980#tournamentMode |
| Gaming Mode LED (LED id 8) | lighting: 0x03:0x00 | yes | likely | zexrox:native/host.py:355-369@840f03dc; zexrox:native/host.py:356-358@840f03dc; zexrox:native/host.py:439-453@840f03dc |
| Lighting effects | lighting: 0x0f:0x82, 0x0f:0x02 | unknown | likely | zexrox:native/host.py:23@840f03dc#0x82; zexrox:native/host.py:19-21@840f03dc |
| Per-key RGB (Razer custom frame) | lighting: 0x0f:0x03 | unknown | likely | synapse:c1e6a425@11304#Frame; zexrox:native/host.py:19-21@840f03dc |
| LampArray (standard lighting) | none: a standard HID interface, not a Synapse feature or command, listed because it is the other lighting path (see LampArray); nothing has been sent to it | unknown | likely | probe:.ai_context/knowledge/hid-02a7-macos.txt#kbd-lamparray |
| Brightness | lighting: 0x0f:0x84, 0x0f:0x04; 02D0 flag `brightness` | unknown | likely | zexrox:native/host.py:23@840f03dc#0x84; synapse:c1e6a425@235774#brightness |
| Key remap | keymap: 0x02:0x8d, 0x02:0x0d, 0x02:0x9e, 0x02:0x1e | unknown | likely | zexrox:native/host.py:42@840f03dc#0x8d; zexrox:native/host.py:49@840f03dc#0x9e |
| Hypershift | hypershift: no command; a mode byte in key assignment (see Gaps); 02D0 mapping group `hyperShiftGroup` | unknown | likely | synapse:c1e6a425@2285490#HypershiftMode; synapse:c1e6a425@236034#hyperShiftGroup |
| Macros | macro: class 0x06; 02D0 flag `macros` | unknown | likely | zexrox:native/host.py:55@840f03dc#0x80; synapse:c1e6a425@235788#macros |
| Onboard profiles | profile: class 0x05; the 02D0 configuration gives 5 onboard slots (`OBMSlots`) | unknown | likely | zexrox:native/host.py:30-34@840f03dc; synapse:c1e6a425@235560#OBMSlots |
| Polling rate | polling: 0x00:0x85, 0x00:0x05, 0x00:0xc0, 0x00:0x40; 02D0 flag `highSpeedPollingRate` | unknown | likely | zexrox:native/host.py:64@840f03dc#0xc0; synapse:c1e6a425@235873#highSpeedPollingRate |

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
login. The owner's macOS dump and the owner's read-only probe run are part of
this repo: `.ai_context/knowledge/hid-02a7-macos.txt` and
`.ai_context/knowledge/webusb-probe-02a7-macos.txt`.

The USB-IF HID Usage Tables 1.5 were fetched on 2026-10-14 as `hut1_5.pdf`
from `https://usb.org/sites/default/files/hut1_5.pdf`; its sha256 is in the
manifest. The LampArray section takes its field names from chapter 26 of that
document; those citations are checked for grammar only.
