---
name: Responsible-person photo persistence
description: Rules for retaining uploaded responsible-person images across a later names-list save.
---

When one UI action uploads a file and another saves the ordered metadata list, the server must retain the authoritative stored object path when the later request lacks it. Accept a client-provided path only if it belongs to the current record's storage prefix; otherwise resolve from the existing server state by name and index. The public API contract must explicitly include both the persistent path and the freshly signed display URL; response parsing strips fields absent from that contract.

**Why:** Mixed live client versions can send a names-only save immediately after an upload. Replacing the structured list blindly then writes a null path, while the UI only appears correct until its temporary image URL is discarded on reload.

**How to apply:** For every record containing both user-editable metadata and a stored-file reference, use the server's existing path as the fallback during list replacement, declare both fields in OpenAPI, regenerate the API packages, and return a newly signed display URL on reads.