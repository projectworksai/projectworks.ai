# Server warnings (and what to do)

## "TT: undefined function: 32"

- **Source:** The `pdf-extraction` / `pdfkit` stack when parsing some PDFs (TrueType font handling).
- **Impact:** None on behaviour; text extraction still runs. The library hits an optional font feature it doesn’t implement.
- **Action:** Safe to ignore. To hide it you’d need to switch to another PDF library (e.g. `pdf-parse`) or patch `node_modules`.

## "Buffer() is deprecated" (DEP0005)

- **Source:** A dependency (likely `pdfkit` or `pdf-extraction`) still uses the old `Buffer()` constructor instead of `Buffer.from()` / `Buffer.alloc()`.
- **Impact:** None for now; Node still accepts it but may remove it in a future major version.
- **Action:**  
  - To hide this warning when running the dev server:
    - Windows (PowerShell): `$env:NODE_OPTIONS="--no-deprecation"; npm run dev`
    - Windows (CMD): `set NODE_OPTIONS=--no-deprecation && npm run dev`
    - macOS/Linux: `NODE_OPTIONS=--no-deprecation npm run dev`  
  - Optional: add a script in `package.json`, e.g. `"dev:quiet": "set NODE_OPTIONS=--no-deprecation&& next dev"` (Windows) or `"dev:quiet": "NODE_OPTIONS=--no-deprecation next dev"` (macOS/Linux).

## "Primary model failed. Switching to fallback..."

- **Meaning:** The first model (e.g. `anthropic/claude-3-haiku`) returned an error; the server then tried the fallback model (e.g. `mistralai/mistral-7b-instruct`).
- **Check logs:** The server now logs the primary failure reason, e.g.:
  - `401` / invalid key → fix `OPENAI_API_KEY` or OpenRouter key.
  - `429` → rate limit; wait or use another model.
  - `ETIMEDOUT` / timeout → request too large or slow; shorten input or increase timeout.
- **Action:** Fix the reported error (key, quota, or timeout). If the fallback succeeds, generation still works.
