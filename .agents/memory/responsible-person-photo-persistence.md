---
name: Responsible-person photo persistence
description: Rules for retaining uploaded responsible-person images across a later names-list save.
---

When one UI action uploads a file and another saves the ordered metadata list, the server must retain the authoritative stored object path when the later request lacks it. Accept a client-provided path only if it belongs to the current record's storage prefix; otherwise resolve from the existing server state by name and index. The public API contract must explicitly include both the persistent path and the freshly signed display URL; response parsing strips fields absent from that contract. Reads must also normalize historic photo-only entries by recovering their ordered names from the legacy names field, or omitting irrecoverable entries before response validation.

**Why:** Mixed live client versions can send a names-only save immediately after an upload, while older photo uploads could write a storage path before a matching structured name. Replacing the structured list blindly then writes a null path, while strict response validation can turn one photo-only legacy entry into a site-wide list failure.

**How to apply:** For every record containing both user-editable metadata and a stored-file reference, reject uploads with no name, use the server's existing path as the fallback during list replacement, declare both fields in OpenAPI, regenerate the API packages, normalize old data on read, and return a newly signed display URL.