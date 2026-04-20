## 2024-05-14 - Accessible Custom Toggle Switches
**Learning:** Custom UI toggle switches (often implemented as `<button>` elements with animated absolute-positioned inner dots) are completely opaque to screen readers by default. They are announced simply as "button" with no indication of their current state.
**Action:** Always add `role="switch"` and `aria-checked={boolean}` to any custom toggle element to properly convey its on/off state to assistive technologies, along with an appropriate `aria-label` if it lacks visible accompanying text.
