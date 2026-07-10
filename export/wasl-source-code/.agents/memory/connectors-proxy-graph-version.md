---
name: Replit connectors proxy needs API version in path
description: Symptom and fix for ReplitConnectors.proxy() calls to Microsoft Graph-backed connectors (e.g. onedrive) failing with a 404 "Invalid version" error.
---

`new ReplitConnectors().proxy(connectorName, path, opts)` forwards `path` almost verbatim onto the underlying API host — it does not inject an API version segment for you.

**Why:** Microsoft Graph (used by the onedrive connector) requires the version as the first path segment, e.g. `/v1.0/me/drive/root:/...`. Calling `proxy("onedrive", "/me/drive/root:/...")` (no version) produces a confusing `404 ResourceNotFound: Invalid version: me` because Graph interprets `me` itself as the version segment. The error is caught generically as an upload failure client-side, so it just looks like "upload doesn't work" with no obvious cause in app logs.

**How to apply:** When adding or debugging any `connectors.proxy(...)` call against a Graph-based connector (onedrive, outlook, teams, etc.), always prefix the path with `/v1.0` (or the intended Graph API version). If a proxy call to any connector 404s with an "Invalid version" style message, suspect a missing version prefix first — reproduce with a standalone `tsx` script calling the helper directly to see the raw upstream error body (workflow request logs only show the outer status code, not the thrown error text).
