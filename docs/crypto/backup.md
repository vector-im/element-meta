# Key backup and recovery in EX/EW

| Status | Last updated |
|--|--|
| Draft | Oct 02, 2023 |

This document aims to describe product requirements for key backup and recovery and its user-facing components in EX/EW.

- **Key backup** refers to the server-side encryption key backup. Devices can upload encrypted copies of their megolm keys (room history decryption keys) to the server. This is not exposed individually to users.
- **Recovery** refers to secret storage (4S) that allows the user to securely store a remote encrypted backup of their devices' local secrets to their homeserver. The recovery restores the key backup secret as well as the cross-signing secrets.
- **Chat backup** refers to key backup and recovery (4S) in a combined fashion. This is exposed to users in a way that they can backup their message history to the server (secret storage / 4S is implicit). Users can opt-out of it.

**Table of contents**

- [General guidelines, context, use cases](#general-guidelines-context-use-cases)
- [Concept](#concept)
  * [General requirements](#general-requirements)
  * [Recovery setup](#recovery-setup)
    + [Recovery setup steps](#recovery-setup-steps)
  * [Recovery settings](#recovery-settings)
  * [Preventing loss of message history](#preventing-loss-of-message-history)
  * [Corner cases and unhappy paths](#corner-cases-and-unhappy-paths)
  * [Recovery](#recovery)

**Figma designs**

https://www.figma.com/file/0MMNu7cTOzLOlWb7ctTkv3/Element-X?type=design&node-id=12124-116601&mode=design&t=RLlU4wtjLjUt2xrO-0

## General guidelines, context, use cases

1. As a user I want to have message history across all my devices for that I can continue communication and use the history independent of the device.
2. As a user/organization I want to have key backup enabled automatically if my server has it enabled for that I cannot accidentally lose history.
3. As a user I want that key backup is enabled right away and independent of the recovery for that all keys are being backed-up and I can set up recovery at a later point in time when it suits me.
4. As a user I want to opt-out from key backup for that I have control over my data and what the server is allowed to store.
5. As a user I will use classic clients and new clients. The key backup mechanism needs to compatible between them.
6. As a user I want to be able to change my recovery when I still have signed-in devices for that I can use it in case of a loss.

## Concept

### General requirements

- The user can retrieve their encrypted message history (if the device has been verified).
- Message keys will be stored in the backup (if the device has been verified).
- Key backup will always be enabled by default. On a new device, key backup will be enabled even if the recovery isn't yet set up.
- If the user attempts to sign out their last device there should be a warning asking them whether they have a recovery key available. This should be independent of whether recovery was set up and guide the user to the secure backup settings. (see [Preventing loss of message history](#preventing-loss-of-message-history))
- Key backup on EX/EW must be compatible with backup implementations on classic / 3rd party client implementation such that users have a seamless experience when they use both in parallel.
- Key backup must only contain safe keys such that the server cannot inject keys and the client can verify the keys' authenticity.
- Key backup should only be used to retrieve message history (instead of using it to cover up missing keys that should actually be available to the device).

### Recovery setup
When a user has no signed-in devices, it is necessary to use recovery in order to regain access to their crypto identity (4S and key backup). The recovery key can also be used to verify devices (in a single device use case it's mandatory). This section describes the requirements to set up recovery.

- Recovery setup should not be part of [FTUE](https://github.com/vector-im/element-meta/blob/develop/docs/FTUE.md) to keep the experience slick and reduce the amount of steps.
- If recovery isn't yet set up, there should be a notice to the user to inform and guide to recovery setup. This notice should be visible until the user has completed it.

#### Recovery setup steps
- As a foundation, the app generates a recovery key for the user (there can be other mechanisms in the future)
- The user should be informed that they
  - need this recovery key in order to get access to their encryption identity. This allows to verify new devices and to get access to message history. If they logout (or lose) all of their devices, this key is mandatory.
  - should store the recovery key in a safe location (e.g., password manager or a safe)

**Generate a recovery key**
- A suitable recovery key will be generated for the user
- The user can copy or save the key as file

### Recovery settings
- Set up recovery
  -  Allows the user to set up recovery (see [Recovery setup](#recovery-setup))
  -  Only shown if recovery isn't yet set up
- Change recovery key
  - Requires the device to be trusted. Otherwise an existing recovery key is required.
  - If a user has lost their recovery key (or has other reasons to change it) but still has logged-in devices, they can create a new recovery key
  - Invalidates the previous recovery key(s)
  - Starts a new recovery set up
- Disable backup
  - Removes existing key backup and 4S
  - Disables further key backup
  - Informs the user about consequences in a confirmation dialogue
    - On a new device, the user will not be able to retrieve their message history from the server (there might still be other clients forwarding keys for message history).
    - If the user signs out (or loses) all of their devices, they'll not be able to get access to their crypto identity.
      - They will need to rotate it which will be noticeable by other users they communicate with
      - They will lose access to their message history
      - They will need to re-verify users they have verified before to establish trust again
 - Sync backup (troubleshooting)
   - Only shown if something is wrong (some keys not available, etc.)
   - As this is important to fix, it should also be shown as a banner above the room list to make the user aware
   - Asks the user to enter the recovery key to re-initialize the backup
   - Guides the user how to obtain a new recovery key from another device if they have lost it
   - Guides the user to reset their crypto identity (last resort!) if they do not have access to another device and have lost their recovery key

### Preventing loss of message history
There are a couple of circumstances where a user will lose access to their message history if they sign out their last device. For these cases, a warning should be shown to inform/remind the user and guide them to do the right thing.
- Backup is disabled
  - The user should see a prompt telling them `You have turned off backup`, explaining that they will lose message history if they continue and guiding them to chat backup settings
- Recovery wasn't set up
  - The user should see a prompt telling them `Recovery not set up`, explaining that they will lose message history if they continue and guiding them to chat backup settings
- The client hasn't finished backing up keys
  - The user should see a prompt telling them `Backup is still in progress`, explaining that they will lose message history if they continue and giving guidance
- Everything is good but the user lost their recovery key
  - The user should see a prompt telling them `Do you have your recovery key?`, explaining that they will lose message history if they don't have it and guiding them to settings to create a new one

It should always be possible to force-logout the app.

### Corner cases and unhappy paths
- User is signed-in but the device isn't verified [this case will be eliminated with the new [FTUE](https://github.com/vector-im/element-meta/blob/develop/docs/FTUE.md) concept]
  - The user should be prompted to verify the device via a banner at the top of the room list
  - The user should see a hint at the top of the timeline of each room telling them that `Message history is unavailable in this room. Verify this device to see your message history.`
- User is signed-in but the device was verified before the chat backup feature was enabled/available [this is a theoretical case for the transition period where chat backup is being introduced]
  - In this case the client does not have the backup key as it only gets transferred during the verification process
  - The client should try again to get the backup key from another device
  - If that doesn't work, the client should prompt the user for the recovery key
- User is signed-in, device is verified but key backup isn't enabled
  - The user should see a hint at the top of the timeline of each room telling them that `Message history is unavailable as chat backup was turned off. Please turn on chat backup to avoid this in the future.`
- Message history is disabled in a particular room
  - The user should see a hint at the top of the timeline of each room telling them that `Message history is unavailable`

### Recovery
The recovery process is handled in the [FTUE](https://github.com/vector-im/element-meta/blob/develop/docs/FTUE.md) concept.

### Indicators for message history
