import re
import codecs

path = r'c:\Antigravity IDE\WEB DEIS\Covid_Web\index.html'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Remove the misplaced button
misplaced = r'                <button class="tab-btn" data-tab="autoconsulta">\s*<i class="fas fa-search"></i> Autoconsulta de Vacunaci.n\s*</button>\s*'
content = re.sub(misplaced, '', content)

# 2. Insert it into the correct nav bar
correct_btn = """                <button class="tab-btn" data-tab="autoconsulta">
                    <i class="fas fa-search"></i> Autoconsulta de Vacunación
                </button>"""
content = re.sub(r'(<button class="tab-btn" data-tab="produccion">.*?</button>\s*)(</nav>)', r'\1' + correct_btn + r'\n            \2', content, flags=re.DOTALL)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Moved Autoconsulta button to the correct nav bar!")
