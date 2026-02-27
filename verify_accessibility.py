
import asyncio
from playwright.async_api import async_playwright, expect

async def verify_fit_tracker_accessibility():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        try:
            # Navigate to the Home page first
            await page.goto("http://localhost:5173/cc-workspace/")
            await page.wait_for_load_state("networkidle")

            # Click the FitTracker link
            fit_tracker_link = page.get_by_role("link", name="FitTracker").first
            await fit_tracker_link.click()

            # Wait for FitTracker page to load
            await page.wait_for_selector('h1', timeout=10000) # Wait for header "FitTracker"

            # Handle initial Body Data modal if present
            body_modal_cancel = page.locator('button', has_text="取消")
            if await body_modal_cancel.is_visible():
                print("Body Data modal detected. Closing it.")
                await body_modal_cancel.click()
                await page.wait_for_timeout(500) # Wait for animation

            # Verify Settings Button has aria-label
            settings_button = page.locator('button[aria-label="設定"]')
            await expect(settings_button).to_be_visible()
            print("Verified: Settings button has aria-label='設定'")

            # Click Settings Button to open modal
            await settings_button.click()

            # Verify Close Settings Button
            close_settings_button = page.locator('button[aria-label="關閉"]').first
            await expect(close_settings_button).to_be_visible()
            print("Verified: Settings modal close button has aria-label='關閉'")

            # Verify TTS Toggle
            tts_toggle = page.locator('button[aria-label="切換語音激勵"]')
            await expect(tts_toggle).to_be_visible()
            print("Verified: TTS toggle has aria-label='切換語音激勵'")

             # Verify Smart Coach Toggle
            coach_toggle = page.locator('button[aria-label="切換 Smart Coach"]')
            await expect(coach_toggle).to_be_visible()
            print("Verified: Smart Coach toggle has aria-label='切換 Smart Coach'")

            # Verify Smart Coach Info Button
            coach_info = page.locator('button[aria-label="關於 Smart Coach"]')
            await expect(coach_info).to_be_visible()
            print("Verified: Smart Coach info button has aria-label='關於 Smart Coach'")

            # Close Settings Modal
            await close_settings_button.click()

            # Navigate to Weight Training tab (default)
            # Find an exercise and click it to open details
            exercise_buttons = page.locator('.grid button')
            count = await exercise_buttons.count()

            if count > 0:
                await exercise_buttons.first.click()
                print("Clicked first exercise")
                await page.wait_for_timeout(500) # Wait for potential "Base Weight" modal

                # Check if "Base Weight Setup" modal appeared
                base_weight_modal = page.locator('h2', has_text="設定基準重量")
                if await base_weight_modal.is_visible():
                    print("Base Weight Setup modal appeared. Clicking '開始訓練' to proceed to exercise view.")
                    start_training_btn = page.locator('button', has_text="開始訓練")
                    await start_training_btn.click()
                    await page.wait_for_timeout(500) # Wait for transition

                # Verify Exercise Modal Close Button
                # Wait for the exercise modal to be visible first
                close_exercise_button = page.locator('button[aria-label="關閉"]').first
                await expect(close_exercise_button).to_be_visible()
                print("Verified: Exercise modal close button has aria-label='關閉'")

                # Verify Weight Adjustment Buttons
                dec_weight = page.locator('button[aria-label="減少重量"]')
                inc_weight = page.locator('button[aria-label="增加重量"]')
                await expect(dec_weight).to_be_visible()
                await expect(inc_weight).to_be_visible()
                print("Verified: Weight adjustment buttons have aria-labels")

                # Verify Reps Adjustment Buttons
                dec_reps = page.locator('button[aria-label="減少次數"]')
                inc_reps = page.locator('button[aria-label="增加次數"]')
                await expect(dec_reps).to_be_visible()
                await expect(inc_reps).to_be_visible()
                print("Verified: Reps adjustment buttons have aria-labels")

                # Close Exercise Modal
                await close_exercise_button.click()
            else:
                 print("Warning: Could not find any exercise buttons")

            # Verify Edit Equipment Modal Button (Pencil icon)
            edit_equip_button = page.locator('button').filter(has_text="編輯").first
            if await edit_equip_button.is_visible():
                await edit_equip_button.click()
                print("Clicked Edit Equipment button")

                # Verify Edit Equipment Close Button
                close_edit_button = page.locator('button[aria-label="關閉"]').last
                await expect(close_edit_button).to_be_visible()
                print("Verified: Edit Equipment modal close button has aria-label='關閉'")

                await close_edit_button.click()

            # Take a screenshot for visual confirmation
            await page.screenshot(path="verification_accessibility.png", full_page=True)
            print("Screenshot saved to verification_accessibility.png")

        except Exception as e:
            print(f"Verification failed: {e}")
            await page.screenshot(path="verification_failure.png")
            raise e
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_fit_tracker_accessibility())
