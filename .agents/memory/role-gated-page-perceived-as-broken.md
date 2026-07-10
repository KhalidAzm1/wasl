---
name: Bare access-denied pages get reported as "black screen" bugs
description: Why a role-gate whose denial view is just small centered text on a dark background gets misread by users as a broken/blank page.
---

A `RequireAuth roles={[...]}` (or similar) denial branch that renders only a
short line of muted text on the app's near-black background looks, from a
glance, indistinguishable from a truly blank/broken page — users report it
as "black screen" rather than "access denied".

**Why:** A regular admin's sidebar still linked to a super_admin-only page;
clicking it landed on the denial text, which the user reported as a black
screen bug rather than a permissions message.

**How to apply:** Prefer not letting users reach a role gate they'll always
fail — hide nav links/entry points for roles that can't access the target
(filter by role client-side, in addition to the mandatory server-side check).
If a denial view is still reachable another way, give it a normal page shell
(icon, heading, some contrast) rather than bare text so it reads as an
intentional message, not a crash.
