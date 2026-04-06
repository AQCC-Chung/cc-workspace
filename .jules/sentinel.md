## 2024-04-06 - Reverse Tabnabbing Vulnerability
**Vulnerability:** Reverse tabnabbing vulnerability via `window.open` calls without `noopener,noreferrer`.
**Learning:** React elements utilizing `window.open` programmatically must explicitly pass `noopener,noreferrer` as the third argument to prevent the opened page from maliciously modifying `window.opener.location` of the original page.
**Prevention:** Always include `noopener,noreferrer` when using `window.open` with `_blank`, just as you would add `rel="noopener noreferrer"` to `<a>` tags.
