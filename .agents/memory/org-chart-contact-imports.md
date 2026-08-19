---
name: Org chart contact imports
description: Safe behavior for importing contacts into manually maintained bank organization charts.
---

Contact imports must merge into an existing organization chart rather than replace it. Existing node identities, reporting relationships, and image references must survive an import; only genuinely new contacts get new nodes and contact-derived reporting lines.

**Why:** A replace-style import erased manually assembled hierarchy and profile images when a user refreshed contacts to add a phone number.

**How to apply:** Treat the chart as the source of manual layout truth. Match imported contacts by normalized name or phone, update their contact fields conservatively, append unmatched entries, and preserve stable storage paths for uploaded images rather than persisting short-lived signed URLs.