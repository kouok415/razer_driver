# Fixture: minimal protocol doc

Checker test data only; the bytes below are not protocol claims.

## Commands

| Group | Class | ID | Name | Dir | Size | Safe | Confidence | Source | Notes |
|---|---|---|---|---|---|---|---|---|---|
| device-info | 0x00 | 0x81 | Firmware version | read | 2 | yes | confirmed | zexrox:native/host.py:22@840f03dc | fixture |
| device-info | 0x00 | 0x82 | Serial number | read | 22 | yes | confirmed | zexrox:native/host.py:22@840f03dc | fixture |

Diagnostics reads: 0x00:0x81, 0x00:0x82

| Group name | Class | Command | Name | Dir | Size | Safe | Confidence | Source | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Lighting | 0x0F | 0x02 | Bogus | read | 9 | yes | [HYPOTHESIS] | url:https://example.com/x | |

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
