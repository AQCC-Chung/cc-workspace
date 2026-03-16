## 2024-03-16 - Pre-compiled Regex for Performance
**Learning:** Redundant regex compilations, such as using `re.sub(r'\s+', ...)` multiple times in a function (like `parse_query` string cleanup), causes overhead in execution time as Python has to recompile the regex object or fetch from its internal cache on every call.
**Action:** Always pre-compile frequently used regular expressions as module-level constants (e.g. `_RE_WHITESPACE = re.compile(r'\s+')`) and use their `.sub()` or `.match()` methods directly to avoid this redundant compilation overhead.
