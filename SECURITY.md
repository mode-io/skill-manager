# Security Policy

`skill-manager` is a local-first tool that can read from and mutate local skill
directories on your machine. If you believe you have found a security issue in
the project, please report it privately.

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.

Send reports to:

- `siruizhangdev@gmail.com`

When possible, include:

- the affected version
- how you installed or ran `skill-manager`
- reproduction steps
- the expected impact
- logs, screenshots, or proof-of-concept details if relevant

Reports will be reviewed on a best-effort basis. If the issue is confirmed, we
will coordinate a fix and public disclosure when appropriate.

## Scope

Examples of issues that are in scope:

- unintended local file mutation or deletion
- unsafe path traversal or path resolution
- install, update, or delete flows that can be abused unexpectedly
- insecure handling of the local API/server state inside `skill-manager`
- packaging or release-artifact integrity issues in project-owned artifacts

Examples of issues that are out of scope:

- expected documented behavior of a local file-mutating tool
- vulnerabilities in third-party harnesses unless `skill-manager` causes or
  amplifies them
- generic upstream GitHub, npm, or Homebrew issues not caused by this project
- feature requests or general support questions

## Supported Versions

Security fixes are provided for the latest released version only.

## Bug Bounty

This project does not currently offer a bug bounty program.

