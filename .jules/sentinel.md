## 2025-02-18 - Reverse Tabnabbing Vulnerability
**Vulnerability:** Usage of `window.open(url, '_blank')` without `'noopener,noreferrer'` exposing the app to reverse tabnabbing.
**Learning:** Found in `src/pages/TasteMap/Card.tsx` and `src/pages/TasteMap/DetailModal.tsx`. Missing the third argument allows a newly opened tab to retain a reference to `window.opener`, which can potentially navigate the original page to a malicious site.
**Prevention:** Always ensure `'noopener,noreferrer'` is included as the third argument when using `window.open(url, '_blank')` in React.
