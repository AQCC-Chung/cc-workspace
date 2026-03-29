from playwright.sync_api import sync_playwright, expect

def verify_modal(page):
    page.goto("http://localhost:5173/cc-workspace/#/tastemap")

    # Wait for the app to load
    page.wait_for_selector(".hero-content", timeout=10000)

    try:
        # Wait for cards to load
        page.wait_for_selector(".card", timeout=10000)

        # Click the first card
        cards = page.locator(".card")
        cards.first.click()

        # Wait for modal to appear
        page.wait_for_selector(".modal-backdrop", state="visible")

        # Take screenshot of the open modal
        page.screenshot(path="/app/verification/modal_open.png")
        print("Modal opened successfully. Screenshot saved to /app/verification/modal_open.png")

        # Verify a11y attributes
        backdrop = page.locator(".modal-backdrop")
        expect(backdrop).to_have_attribute("role", "dialog")
        expect(backdrop).to_have_attribute("aria-modal", "true")

        close_btn = page.locator(".modal-close-btn")
        expect(close_btn).to_have_attribute("aria-label", "關閉")
        print("A11y attributes verified successfully.")

        # Press Escape key
        page.keyboard.press("Escape")

        # Wait for modal to disappear
        page.wait_for_selector(".modal-backdrop", state="hidden")

        # Take screenshot after Escape
        page.screenshot(path="/app/verification/modal_closed.png")
        print("Modal closed successfully via Escape key. Screenshot saved to /app/verification/modal_closed.png")

    except Exception as e:
        print(f"Error during verification: {e}")
        page.screenshot(path="/app/verification/error_state.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_modal(page)
        finally:
            browser.close()
