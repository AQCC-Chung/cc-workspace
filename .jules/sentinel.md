## 2024-05-18 - Prevent Server-Side Request Forgery (SSRF)
**Vulnerability:** `backend/scraper.py` blindly passes unsanitized URLs from DuckDuckGo search results or user input into `requests.get()`. This can lead to SSRF if a search result points to an internal IP or local service.
**Learning:** External search results can be poisoned or an attacker can provide internal URLs to proxy requests.
**Prevention:** Always validate URLs against `is_safe_url` to restrict schemes to http/https and to filter out private, loopback, and unroutable IPs before making outgoing HTTP requests.
