import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        
        await page.goto("file:///C:/Antigravity IDE/WEB DEIS/Programáticas_Web/index.html")
        await page.wait_for_timeout(2000)
        
        print("Clicking BCG...")
        # Evaluate directly to avoid waiting for selector if it's hidden or complex
        await page.evaluate("window.abrirReporteNeonatal('bcg')")
        
        await page.wait_for_timeout(2000)
        print("Errors caught:")
        for err in errors:
            print(err)
            
        await browser.close()

asyncio.run(main())
