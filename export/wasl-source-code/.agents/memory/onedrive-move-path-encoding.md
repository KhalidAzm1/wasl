---
name: OneDrive/Graph parentReference.path must not be percent-encoded
description: Why moving a Graph driveItem (archive/restore) can 400 even when the same URL-style encoding works for path-addressing endpoints.
---

When calling Microsoft Graph `PATCH /drive/items/{id}` to move a file (e.g. archive-to-folder / restore-from-folder), the `parentReference.path` field is a **JSON body value**, not part of a URL. It must be the raw, human-readable path (e.g. `/drive/root:/Wasl Documents/Archive`).

**Why:** a helper that percent-encodes path segments (correct for `root:/...:/children` or `root:/...:/content` URL-addressing endpoints) will also encode spaces as `%20` if reused for `parentReference.path`. Graph then looks for a folder literally named `Wasl%20Documents` and returns a generic `400 invalidRequest` with no useful detail — easy to misdiagnose as a permissions or folder-existence problem.

**How to apply:** any Graph move/copy call that sets `parentReference.path` should build that string directly (plain path, unencoded), separately from any path-encoding helper used for URL construction elsewhere in the same file.
