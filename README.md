# Element meta

This is the home of shared Element app documentation and artefacts for the element [web](https://github.com/vector-im/element-web), [desktop](https://github.com/element-hq/element-desktop), [Android](https://github.com/vector-im/element-android) and [iOS](https://github.com/vector-im/element-ios) apps.

Each project will link to the [wiki](https://github.com/vector-im/element-meta/wiki) directly to reference processes that it has adopted.

## Setting up label sync in another repository

This repository includes a reusable workflow for synchronising labels across repositories and from YAML files. To set up label synchronisation in another repository, go to that repository and create an empty file `.github/labels.yml` as well as a new workflow `.github/workflows/sync-labels.yml`.

```
name: Sync labels
on:
    workflow_dispatch: {}
    schedule:
        - cron: "0 2 * * *" # 2am every day
    push:
        branches:
            - develop
        paths:
            - .github/labels.yml
jobs:
    sync-labels:
        uses: vector-im/element-meta/.github/workflows/sync-labels.yml@develop
        with:
            LABELS: |
                vector-im/element-meta
                .github/labels.yml
            DELETE: true
            WET: false
        secrets:
            ELEMENT_BOT_TOKEN: ${{ secrets.ELEMENT_BOT_TOKEN }}
```

This will sync labels from vector-im/element-meta as well as the local `labels.yml` file. Note that `WET: false` ensures that the workflow runs in dry mode without actually changing any labels.

Manually execute the workflow once. The workflow run's logs will include a summary of the label changes that would have been applied. Take particular note of the section that lists additional labels.

```
The following labels exist in matrix-org/matrix-react-sdk-module-api but are missing in all sources. They will be deleted.
- name: "A-Timesheet-1"
  description: "Log any time spent on this into the A-Timesheet-1 project"
  color: "5319E7"
- name: "bug"
  description: "Something isn't working"
  color: "d73a4a"
- name: "documentation"
  ...
```

If you want to retain these labels, either copy them to `labels.yml` or set `DELETE: false`.

Afterwards set `WET: true` in the workflow and execute it. You may hit GitHub's rate limits on the initial run.

```
Syncing labels
[UnhandledPromiseRejection: This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). The promise rejected with the reason "Error: You have exceeded a secondary rate limit. Please wait a few minutes before you try again. If you reach out to GitHub Support for help, please include the request ID 9892:05D0:25DA3A:4F0839:6564EE53.".] {
  code: 'ERR_UNHANDLED_REJECTION'
}
```

If so, just do as the message says and execute the workflow again after a few minutes to let it apply the leftover changes. From here on labels should be kept in sync automatically.
