## 2023-10-27 - Icon-only buttons lacking ARIA labels
**Learning:** Icon-only buttons (like '✕' for closing/deleting or generic icons for toggles) often lack descriptive context for screen readers in custom components (like MeetNote history and file items). A common pattern is missing `aria-label`, or for expand/collapse buttons, missing `aria-expanded` and `aria-controls`.
**Action:** When inspecting components with custom minimalist UI elements, explicitly check button roles for adequate textual or aria-label descriptions and ensure collapsible sections link their state correctly.
