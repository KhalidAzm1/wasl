---
name: Client-side-only PIN/2FA gates are not real access control
description: Why a sensitive admin panel needs the second factor enforced by the backend on every request, not just a frontend gate component.
---

A frontend "enter a PIN to unlock this page" component that only sets a
boolean/flag in sessionStorage does not protect anything — the underlying
API routes are still reachable directly (curl, devtools) by anyone with a
valid login session, defeating the "login alone isn't enough" goal.

**Why:** Caught in review: an AdminPinGate component correctly blocked the
React page, but `/api/admin/users*` had no server-side awareness of the PIN
at all.

**How to apply:** Any second factor (PIN, TOTP, etc.) gating a sensitive
page must issue a server-signed, expiring, user-bound token on success, and
every protected API route must verify that token itself. The signing key
must fail closed (throw) if the secret is unset — never fall back to an
empty/default key. The frontend gate is only a UX convenience layered on top.
