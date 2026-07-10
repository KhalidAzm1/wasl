---
name: Un-disabled dialog Save buttons cause duplicate records
description: Symptom pattern where lists (meetings/risks/action items/documents) show duplicated entries because create dialogs allow double-submission.
---

Any "Save" button wired to a React Query `mutate()` call must guard against double-firing: both an early-return inside the handler (`if (mutation.isPending) return;`) and `disabled={mutation.isPending}` on the button itself.

**Why:** Server logs showed bursts of identical POST/DELETE requests fired milliseconds apart from the same dialog — a user double-clicking (or a slow network round-trip) before the button disabled itself. Without a guard, each click is a fully valid, separately-inserted row, so it isn't caught by server-side validation and only surfaces later as confusing "duplicate report" complaints.

**How to apply:** When adding any new create/update dialog backed by a mutation hook, apply this guard from the start rather than waiting for a bug report.
