---
name: Office file parsing without python3/xlsx
description: How to extract data from .xlsx/.pptx when python3 and the xlsx npm package are unavailable in the sandbox.
---

`python3` is not installed in this container, and the `xlsx` npm package cannot be `import()`-ed inside the CodeExecution sandbox. `.xlsx`/`.pptx` files are zip archives, so the reliable workaround is:

1. `unzip` the file via ShellExec (e.g. into `/tmp/xlsx_extract`).
2. For xlsx: regex-parse `xl/worksheets/sheet1.xml`, matching `<is><t>...</t></is>` (inline strings) and `<v>...</v>` (numeric/shared values), decoding `&amp;` and numeric XML entities.
3. For pptx: regex-parse each slide's `<a:t>...</a:t>` text runs; media assets live under `ppt/media/`.
4. Do this parsing in CodeExecution (Node), not ShellExec — regex/JSON assembly is much easier there.

**Why:** discovered after failed attempts to use python3 and the xlsx package; this is the only reliable path found so far.
**How to apply:** whenever a user attaches a `.xlsx`, `.pptx`, or `.docx` and default text extraction isn't enough.
