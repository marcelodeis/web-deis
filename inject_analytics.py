import os

SNIPPET = """<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "068ddcf406d9480499a9a5606fc3637c"}'></script><!-- End Cloudflare Web Analytics -->"""

TARGET_DIRS = [
    "Portal_Web",
    "Covid_Web",
    "Influenza_Web",
    "Programáticas_Web",
    "VRS"
]

def inject_analytics():
    for d in TARGET_DIRS:
        dir_path = os.path.join(os.getcwd(), d)
        if not os.path.isdir(dir_path):
            continue
            
        for file in os.listdir(dir_path):
            if file.startswith("index") and file.endswith(".html"):
                filepath = os.path.join(dir_path, file)
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                if "Cloudflare Web Analytics" in content:
                    print(f"[!] Analytics ya estaba en {filepath}")
                    continue
                    
                # Inyectar antes de </body>
                if "</body>" in content:
                    new_content = content.replace("</body>", f"{SNIPPET}\n</body>")
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"[+] Inyectado con éxito en {filepath}")
                else:
                    print(f"[-] No se encontró </body> en {filepath}")

if __name__ == '__main__':
    inject_analytics()
