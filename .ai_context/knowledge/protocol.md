# Huntsman V3 Pro TKL (RZ03-0498, USB 1532:02A7): control protocol

Last updated: 2026-10-14.

A cited reference for the keyboard's vendor control channel. It is checked by
`tools/check-protocol-doc.mjs`: every fact carries a citation, and every
citation resolves against pinned copies of the sources (see Sources). It does
not depend on how the host reaches the device (WebUSB, WebHID or a native HID
library); access-layer details are called out where they matter.

Synapse targets 02D0 (superset); zexrox runs against a real 0498.

- Synapse Web is Razer's own web configurator. The bundle cited here is the one
  it serves for the Huntsman V3 Pro 8KHz TKL (product 720 = PID 0x02D0), a
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
url:<https URL>                                    background reference only; never resolved
```

Confidence: `confirmed` = both sources agree, or zexrox observed it on a real
02A7; `likely` = Synapse only; `[HYPOTHESIS]` = this document's inference.

## Framing

Every request and every reply is one HID feature report with report ID 0 and
90 data bytes. The host writes the request with SET_REPORT and fetches the
reply with GET_REPORT on the same report; there is no interrupt endpoint and
no open handshake in this exchange (Synapse's WebHID connect step only opens
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
(synapse:c1e6a425@433211#e.buffer); a port should respect the offset.

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
  (zexrox:native/host.py:442@840f03dc). This repo follows Synapse's 0 to 30
  sequence, starting at 0.

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

Decision for this repo (the follow-up transport task implements it): send
once, re-read only, never resend.

1. Build the request (byte 0 = 0x00, next transaction ID, size, class, ID,
   arguments, checksum) and write it once with SET_REPORT, report ID 0.
2. Every 20 ms, re-read with GET_REPORT for at most 0.5 s in total; these two
   numbers come from zexrox, the only source run against a real 02A7
   (zexrox:native/host.py:222-223@840f03dc#BUSY_POLL_INTERVAL). Synapse's
   shorter waits are not used: they are tuned for a loop that rewrites.
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

| Group | Class | ID | Name | Dir | Size | Safe | Confidence | Source | Notes |
|---|---|---|---|---|---|---|---|---|---|
| device-info | 0x00 | 0x81 | Get Firmware Version | read | 2 | yes | confirmed | synapse:c1e6a425@280681#129; synapse:c1e6a425@280694#Firmware; synapse:c1e6a425@279884#K_; synapse:c1e6a425@1093638#K_; zexrox:native/host.py:22@840f03dc | Confirmed (both sources): class, ID, read. Likely (Synapse only): name, size 2, reply layout (see Reply layouts); zexrox does not check this size. No arguments. |
| device-info | 0x00 | 0x82 | Get Serial Number | read | 22 | yes | confirmed | synapse:c1e6a425@280735#130; synapse:c1e6a425@280775#Serial; synapse:c1e6a425@279893#Kr; synapse:c1e6a425@280580#yf; synapse:c1e6a425@1093877#Kr; zexrox:native/host.py:22@840f03dc | Confirmed (both sources): class, ID, read. Likely (Synapse only): name, size 22, reply layout; zexrox does not check this size. No arguments. [HYPOTHESIS] The reply is the unit's serial, so this repo keeps it out of logs and bug reports. |
| device-info | 0x00 | 0x84 | Get Device Mode | read | 2 | no | confirmed | synapse:c1e6a425@280913#132; synapse:c1e6a425@280952#Device; zexrox:native/host.py:22@840f03dc | Confirmed (both sources): class, ID, read. Likely (Synapse only): size 2. [HYPOTHESIS] The name is paired with the triple by its position in Synapse's command list. Reply layout not traced. Not on the diagnostics list in this version. |
| device-info | 0x00 | 0x86 | Get Edition Information | read | 3 | no | confirmed | synapse:c1e6a425@281121#134; synapse:c1e6a425@281159#Edition; zexrox:native/host.py:22@840f03dc | Confirmed (both sources): class, ID, read. Likely (Synapse only): size 3. [HYPOTHESIS] The name is paired with the triple by its position in Synapse's command list. Reply layout not traced. Not on the diagnostics list in this version. |
| device-info | 0x00 | 0x87 | Get Extended Firmware Version | read | 4 | no | confirmed | synapse:c1e6a425@281203#135; synapse:c1e6a425@281225#Firmware; zexrox:native/host.py:22@840f03dc | Confirmed (both sources): class, ID, read. Likely (Synapse only): size 4. [HYPOTHESIS] The name is paired with the triple by its position in Synapse's command list. Reply layout not traced. Not on the diagnostics list in this version. |
| device-info | 0x00 | 0x02 | Set Serial Number | write | 22 | no | likely | synapse:c1e6a425@280759#22; synapse:c1e6a425@280797#Serial; synapse:c1e6a425@279741#AQ; synapse:c1e6a425@279828#I0; synapse:c1e6a425@1094070#AQ | Synapse only; zexrox does not list it. Overwrites the serial: never send. Same class and size as 0x00:0x82; the ID differs only in bit 7 (see below). |

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
puts in bytes 2 to 4 and 88 of a reply is not established.

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
