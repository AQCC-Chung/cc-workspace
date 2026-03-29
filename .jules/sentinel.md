## $(date +%Y-%m-%d) - Secure target="_blank" links
**Vulnerability:** External links opened with `target="_blank"` without `rel="noopener noreferrer"` can expose the site to reverse tabnabbing attacks where the newly opened tab gains access to the original window's `window.opener` object.
**Learning:** React automatically adds `rel="noopener noreferrer"` to `<a>` tags with `target="_blank"`, but when calling `window.open` programmatically, we must explicitly pass `'noopener,noreferrer'` as the window features string.
**Prevention:** Always include `'noopener,noreferrer'` as the third argument to `window.open(url, '_blank')`.
