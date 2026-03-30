## 2025-02-17 - Prevent Reverse Tabnabbing
**Vulnerability:** External links opened programmatically with `window.open` without the `'noopener,noreferrer'` feature flag allow the newly opened tab to potentially hijack the original tab via `window.opener`.
**Learning:** React elements naturally handle `rel="noopener noreferrer"` for `<a>` tags, but when using `window.open` programmatically to open external links (like in `src/pages/TasteMap/Card.tsx` and `src/pages/TasteMap/DetailModal.tsx`), we must explicitly pass `'noopener,noreferrer'` as the window features string.
**Prevention:** Always verify programmatic navigation handles security attributes, specifically passing `'noopener,noreferrer'` as the third argument to `window.open`.
