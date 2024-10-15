# io.element.matrix_client_information.<device_id>: Storing additional client information per device

## Problem

Currently, sessions are only easily recognisable by their `display_name`. Depending on client implementation, this may
include some stringified information about the session. (For example, Element Web uses `'%(appName)s (%(browserName)s,
%(osName)s)'`). This information can become stale, and if edited by the user any device detail is lost.

By saving structured and up to date session information, users will be able to more easily recognise their sessions.
This gives users  more confidence in removing stale or suspicious sessions.


## Proposal

We introduce the account_data event `io.element.matrix_client_information.<device_id>`.

An example event for a device with `device_id` of `abc123`:

```json5
{
  "type": "io.element.matrix_client_information.abc123",
  "content": {
    "name": "Element Web",
    "version": "1.2.3",
    "url": "app.element.io"
  }
}
```

All properties are strings. `url` property is optional.

## Client advisory

Storage of client information should be opt-in.

When starting the client after login or update:
1. Upsert an account data event with the type `io.element.matrix_client_information.<device_id>` for the current device

When rendering device application information:

1. Read account data event of type `io.element.matrix_client_information.<device_id>` for each given device.

These events should be pruned periodically.

## MSC
Pruning of events depends on implementation of [MSC3391: Removing account
data](https://github.com/matrix-org/matrix-spec-proposals/pull/3391)

## Security considerations
Storage of client information in account_data exposes information about user sessions to server administrators.
The goal of the feature is to make session management easier, particularly identification of suspicious sessions.
For this reason client information events will not use secret storage.

## Implementations

* The `matrix-react-sdk` which powers Element Web and Desktop implemented this in September 2022.
  * https://github.com/matrix-org/matrix-react-sdk/pull/9314
