---
name: logo.clearbit.com unreachable
description: DNS resolution for logo.clearbit.com fails in this environment, even though other external domains resolve fine.
---

`logo.clearbit.com` fails to resolve (`curl`: "Could not resolve host") from this container's network, while other domains (google.com, placehold.co) resolve normally. This affects both server-side curl checks and the browser-preview screenshot tool.

**Why:** Confirmed by testing multiple domains — this is domain-specific, not a general network restriction. Cause unconfirmed (could be the service being deprecated/blocked), but the failure is consistent.
**How to apply:** Never rely on `<img src>` from `logo.clearbit.com` (or similar third-party logo APIs) without a client-side `onError` fallback to an icon/initials. Build a reusable fallback-image component whenever seed/import data includes external logo URLs.
