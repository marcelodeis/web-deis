from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        page.goto('http://localhost:8082')
        
        # Click on Ocurrencia tab if needed
        # Depending on the UI, the tab might need to be clicked first
        try:
            page.click('text="Producción (Ocurrencia)"')
            page.wait_for_timeout(1000)
        except:
            pass
        
        # Scroll to rechazos-detalle-establecimientos
        page.evaluate("document.getElementById('rechazos-detalle-establecimientos').scrollIntoView()")
        page.wait_for_timeout(1000)
        
        # Select Osorno
        page.select_option('#rechazosOcurrenciaSelect', value='OSORNO')
        page.wait_for_timeout(1000)
        
        # Take screenshot of selector area
        page.locator('#rechazos-detalle-establecimientos').screenshot(path='selector_osorno.png')
        
        # Open modal
        page.click('button:has-text("Ver ranking completo")')
        page.wait_for_timeout(1000)
        
        # Take screenshot of modal
        page.locator('#rechazosFullRankingModal').screenshot(path='modal.png')
        
        browser.close()

if __name__ == '__main__':
    run()
