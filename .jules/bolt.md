## 2024-05-18 - Optimize array searches in `StockMonitor.tsx`
**Learning:** Redundant array searches `.find()` in React render and effect dependencies were causing unnecessary O(N) operations across `scanData.results` and `screenerData.results`.
**Action:** Replace multiple instances of these array searches with a single `useMemo` calculation (`activeChartData`), and ensure it's added to `useEffect` dependency arrays to satisfy ESLint hooks plugin requirements and prevent stale closures.
