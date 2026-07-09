---
name: PATCH routes must re-validate image fields
description: A generic resource PATCH endpoint that accepts the same field as a dedicated, validated upload endpoint (e.g. PUT /resource/:id/logo) bypasses that validation unless it re-checks the field itself.
---

Pattern seen: an entity has a dedicated `PUT /:id/logo` (or `/hero`) endpoint that validates image data URLs (MIME allowlist, size cap) before writing `logoUrl`/`heroImageUrl`. The entity also has a general `PATCH /:id` endpoint whose update-body schema includes the same `logoUrl`/`heroImageUrl` fields (for other legitimate PATCH use cases) — that endpoint wrote the fields straight to the DB with no image validation, silently bypassing the dedicated endpoint's controls.

**Why:** Validation added to one write path does not protect other write paths that can set the same field. Frontend code happening to always go through the dedicated endpoint does not prevent a script, import job, or future feature from using PATCH instead.

**How to apply:** Whenever a field has special validation requirements (image data URL format/size, URL allowlisting, etc.), enforce that validation in every route handler that can set the field, not just the "intended" one — or remove the field from the generic update schema and require the dedicated endpoint.
