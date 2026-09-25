import urllib.request
endpoints = [
    'https://rni.cl/',
    'https://www.rni.cl/',
    'https://rni.cl/Portal_Web/index.html',
    'https://rni.cl/portal_web/index.html'
]
for ep in endpoints:
    try:
        req = urllib.request.Request(ep, headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(req)
        html = res.read().decode('utf-8', errors='ignore')
        title = ""
        if "<title>" in html:
            title = html.split("<title>")[1].split("</title>")[0]
        print(f"{ep} -> {res.status} (Title: {title})")
    except Exception as e:
        print(f"{ep} -> ERROR: {e}")
