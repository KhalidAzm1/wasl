---
name: OneDrive-backed image/file URLs behind Bearer auth
description: How to make OneDrive-stored files renderable via <img>/<a> when the app's auth is Bearer-token-only (no cookies).
---

Problem: browsers never attach `Authorization` headers to `<img src>` or plain `<a href>` navigation, so a Bearer-token-authenticated API cannot gate file access the normal way. Also, Microsoft Graph's real download URL (`@microsoft.graph.downloadUrl`) expires in ~1 hour and must never be persisted, and Graph's `webUrl` requires the *connector's* Microsoft account to be logged in in-browser — it does not work for arbitrary app users.

Solution: a public, unauthenticated redirect route (`GET /files/content/:itemId`) that:
1. Requires a short-lived HMAC-signed `token` query param (itemId + expiry signed with a server secret), minted fresh by every *authenticated* JSON response that serializes a file URL — never stored in the DB.
2. Denies archived/unknown items before redirecting.
3. Resolves a fresh Graph download URL server-side and 302-redirects to it.

**Why:** this is the only way to keep the underlying Graph URL non-persistent (compliant with "never store file bytes/long-lived signed URLs") while still letting authenticated users' browsers render images without extra client-side plumbing (blob fetch, etc.).

**How to apply:** whenever adding a new response path that returns a stored `/files/content/:itemId`-shaped URL, route it through the shared re-signing helper — every serialization path must be covered, or you leak stale/unsigned URLs (caught this exact gap in bank-detail nested documents during review).
