---
name: WebGL unavailable in headless preview/screenshot tool
description: canvas.getContext('webgl') can return a truthy context in this sandbox's headless browser yet still fail on actual WebGLRenderer construction.
---

When adding a Three.js/React Three Fiber canvas, `canvas.getContext('webgl')` returning non-null is not sufficient proof WebGL works — the headless screenshot browser here can return a context object that still throws `Error creating WebGL context` when `THREE.WebGLRenderer` is constructed.

**Why:** hit this building a rotating cube for a sidebar; naive feature detection let the crash through and broke the whole layout in the Screenshot tool (real user browsers with GPU access are typically fine).

**How to apply:** always pair feature detection with a React error boundary around the `<Canvas>` mount, and also handle the `webglcontextlost` event by switching to a static fallback — detection alone isn't enough.
