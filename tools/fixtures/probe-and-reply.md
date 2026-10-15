# Fixture: minimal protocol doc

Checker test data only; the bytes below are not protocol claims.

## Control interface

| Claim | Source | Confidence |
|---|---|---|
| claim 1 | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3 | confirmed |
| claim 2 | zexrox:native/host.py:22@840f03dc; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3 | confirmed |
| claim 3 | zexrox:native/host.py:22@840f03dc; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3 | confirmed |
| claim 4 | zexrox:native/host.py:22@840f03dc; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3 | confirmed |
| claim 5 | zexrox:native/host.py:22@840f03dc; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3 | confirmed |

02A7 status: [UNVERIFIED]

### Interfaces on macOS

| Interface | Class | Driver | Usage page/usage | Reports | Source |
|---|---|---|---|---|---|
| 0 | 3 | d | 1/6 | in | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@0 |
| 1 | 3 | d | 1/6 | in | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@1 |
| 2 | 3 | d | 1/6 | in | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@2 |
| 3 | 3 | d | 1/6 | in | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3 |
| 4 | 3 | d | 1/6 | in | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@4 |
| 5 | 3 | d | 1/6 | in | probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@5 |

### Protected collections

Interface 3 has no driver (probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3); see also probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@4.

### Transport options

Interface 3 is unclaimed per probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3.

### Open questions

- Is interface 3 reachable? Seen as `probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3`.

## Commands

| Group | Class | ID | Name | Dir | Size | Safe | Confidence | Source | Notes |
|---|---|---|---|---|---|---|---|---|---|
| device-info | 0x00 | 0x81 | Firmware version | read | 2 | yes | confirmed | zexrox:native/host.py:22@840f03dc | fixture |
| device-info | 0x00 | 0x82 | Serial number | read | 22 | yes | confirmed | zexrox:native/host.py:22@840f03dc | fixture |

Diagnostics reads: 0x00:0x81, 0x00:0x82

### Reply layouts

| Command | Bytes | Meaning | Source |
|---|---|---|---|
| 0x00:0x81 | 8-9 | major, minor | synapse:c1e6a425@1093595#major |
| 0x00:0x82 | 8-29 | printable ASCII serial | zexrox:native/host.py:22@840f03dc; probe:.ai_context/knowledge/hid-02a7-macos.txt#IOUSBHostInterface@3 |

### Gaps

- actuation: not covered by this fixture — zexrox:native/host.py:22@840f03dc
- rapid-trigger: not covered by this fixture — zexrox:native/host.py:22@840f03dc
- snap-tap: not covered by this fixture — zexrox:native/host.py:22@840f03dc
- lighting: not covered by this fixture — zexrox:native/host.py:22@840f03dc
- keymap: not covered by this fixture — zexrox:native/host.py:22@840f03dc
- hypershift: not covered by this fixture — zexrox:native/host.py:22@840f03dc
- macro: not covered by this fixture — zexrox:native/host.py:22@840f03dc
- profile: not covered by this fixture — zexrox:native/host.py:22@840f03dc
- polling: not covered by this fixture — zexrox:native/host.py:22@840f03dc

## Golden packets

### G1: request firmware
- Source: zexrox:native/host.py:22@840f03dc

```hex
00 1f 00 00 00 02 00 81 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 83 00
```

### G2: request serial
- Source: zexrox:native/host.py:22@840f03dc

```hex
00 1f 00 00 00 16 00 82 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 94 00
```

### G3: response firmware
- Source: zexrox:native/host.py:22@840f03dc

```hex
02 1f 00 00 00 02 00 81 01 02 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 80 00
```
