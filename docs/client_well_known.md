# Client Well-Known

| Status | Last updated |
|--|--|
| Draft | October 2, 2024 |

<hr />


## Matrix VoIP Configuration

Matrix (1:1) VoIP configuration is keyed by `io.element.voip`. The following options are supported:

| Key | Type | 🤖 | 🍎 | 🕸️ | Description |
| - | - | - | - | - | - |
| `disable_fallback_ice` | `Bool` | ✅ | ✅ | ✅ | Disable fallback ICE server, e.g. matrix.org, will require functioning TURN/STUN server to be configured. |

## Jitsi Configuration

Jitsi configuration is keyed by `io.element.jitsi`. The following options are supported:

| Key | Type | 🤖 | 🍎 | 🕸️ | Description |
| - | - | - | - | - | - |
| `preferredDomain` | `String` | ✅ | ✅ | ✅ | Use the specified server for Jitsi calls. |
| `useFor1To1Calls` | `Bool` | ❌ | ✅ | ✅ | Use Jitsi for 1:1 calls (by default we use native Matrix calls). |

## Encryption Configuration

Encryption configuration is keyed by `io.element.e2ee`. The following options are supported:

| Key | Type | 🤖 | 🍎 | 🕸️ | Description |
| - | - | - | - | - | - |
| `default` | `Bool` | ✅ | ✅ | ✅ | Indicate if E2EE is enabled by default. |
| `force_disable` | `Bool` | ❌ | ❌ | ✅ | Overrides `default` when true, removing the option to enable encryption throughout the UI (existing encrypted rooms are unaffected). |
| `secure_backup_required` | `Bool` | ✅ | ✅ | ✅ | Indicate if secure backup (SSSS) is mandatory. |
| `secure_backup_setup_methods` | `BackupSetupMethod` | ✅ | ✅ | ✅ | Methods to use to setup secure backup (SSSS). |
| `outbound_keys_pre_sharing_mode` | `KeyPreSharingStrategy` | ✅ | ✅ | ❌ | Outbound keys pre sharing strategy. |

### Encryption Configuration Types

```
enum BackupSetupMethod: Int {
    case passphrase = 0
    case key = 1
}
```

```
enum KeyPreSharingStrategy: Int {
    case none = 0,
    case whenEnteringRoom = 1,
    case whenTyping = 2
}
```
