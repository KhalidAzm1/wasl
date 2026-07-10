---
name: drizzle-kit push hangs without a TTY
description: drizzle-kit push's interactive rename/conflict resolver can't be scripted; work around it with raw SQL, then re-verify push is clean.
---

`drizzle-kit push` opens an interactive picker when it detects an ambiguous table/column rename (e.g. replacing one table with a differently-named but similarly-shaped one). This picker needs a real TTY; it cannot be scripted with piped input, and `--force` only skips data-loss confirmations, not this picker.

**Why:** post-merge setup and CI-style environments run with stdin closed, so any pending ambiguous-rename diff will hang or fail there too — not just in an interactive agent session.

**How to apply:** when a schema change looks like a rename to drizzle-kit's differ, apply it directly with raw SQL against the dev database instead of `push`, then immediately re-run `drizzle-kit push` (and whatever the post-merge script uses) to confirm it now reports "no changes" / exits cleanly non-interactively — that's the signal the environment will bootstrap correctly later.
