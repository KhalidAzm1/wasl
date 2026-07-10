---
name: WebGL can fail in the live Replit preview itself, not just headless tools
description: THREE.WebGLRenderer construction can throw in the real proxied preview pane, not only in headless screenshot tooling -- getContext() alone is not sufficient feature detection.
---

`canvas.getContext('webgl')` returning non-null is not proof WebGL works. `new THREE.WebGLRenderer()` can still throw (`Error creating WebGL context`, e.g. `BindToCurrentSequence failed`) in both the headless Screenshot tool and the real proxied preview pane.

**Why:** a React error boundary around `<Canvas>` is not enough on its own — React re-throws caught errors to the console in dev, which triggers Vite's `runtime-error-plugin` full-screen overlay even when the boundary already recovered underneath it, so the user perceives a broken/blank page instead of the intended fallback.

**How to apply:**
1. Probe for real support once at module load with an actual `try { new THREE.WebGLRenderer({canvas}).dispose(); return true } catch { return false }`, and skip mounting `<Canvas>` entirely (render a static fallback) when it returns false — this avoids the throw, so Vite's overlay never fires.
2. Still keep a React error boundary around `<Canvas>` for other synchronous throws, and a `webglcontextlost` listener (via `onCreated`) for async GPU loss mid-session — no single layer covers every failure mode.
3. To debug an auth-gated page without login credentials, temporarily add an unauthenticated route to the router pointing at the same page, screenshot it, then remove the route.
