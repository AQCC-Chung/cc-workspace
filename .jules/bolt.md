## 2024-05-19 - Hoist array searches inside React components

**Learning:** Repeated `.find()` array searches inside functional components that return large lists of items or components with inline definitions, or used in JSX attributes (like `signal={data.find(...)}` and `score={data.find(...)}`), cause multiple O(N) operations per re-render.

**Action:** Extract repetitive array searches into a `useMemo` hook at the top level of the component. Use the memoized result across the component's effects and return statement to convert multiple O(N) lookups into a single O(N) lookup per render cycle.
