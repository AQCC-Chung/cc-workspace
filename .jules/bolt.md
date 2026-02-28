## 2024-03-01 - [Implement Code Splitting in App Routing]
**Learning:** The application bundle size was relatively large (>500KB after minification) due to all page components (`FitTracker`, `Flights`, `Home`, `MeetNote`, `TasteMap`) being imported synchronously in `src/App.tsx`.
**Action:** Used `React.lazy` and `Suspense` for route-level code splitting to reduce the initial load time and bundle size. Next time, consider route-level code splitting early on for multi-page React applications.
