## 2024-05-18 - Custom Toggle Button Accessibility
**Learning:** When using custom `div` or `button` elements to visually represent a switch or toggle, standard screen readers may not announce their state correctly without proper ARIA attributes.
**Action:** Always add `role="switch"` and `aria-checked={boolean}` to custom toggle buttons to ensure their state is properly communicated to assistive technologies. Additionally, ensure the element has a descriptive `aria-label`.
