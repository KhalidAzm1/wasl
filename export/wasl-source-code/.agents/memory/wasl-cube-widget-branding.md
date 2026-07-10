---
name: Wasl sidebar cube widget — no-logo invariant
description: Why the sidebar's rotating cube widget must never render the Wasl wordmark, in any state or fallback path.
---

The Wasl platform sidebar shows exactly one Wasl logo (top of sidebar). A rotating cube widget lower in the sidebar previously reintroduced the logo multiple times: once as a static "large logo card" fallback, and later as one of its own rotating face textures (`useBankCubeFaces` included `waslLogoUrl`) and in a lazy-import failure fallback.

**Why:** any code path that can render the Wasl wordmark inside the cube widget recreates the "two logos" bug, even if the top logo is otherwise correct. This was missed twice by only fixing the primary render path and not every fallback/edge branch (WebGL unavailable, context lost, lazy chunk-load failure, empty face-data).

**How to apply:** when auditing a "must never show X" UI requirement, grep for the asset (e.g. `wasl_logo_2026`) across the whole component tree, not just the primary render path — check every fallback, error boundary, and default-value branch. For this widget specifically, cube face textures come only from bank logos + an abstract SVG glyph (`MinimalCubeGlyph`/`minimalCubeGlyphDataUrl`), never the Wasl logo asset.
