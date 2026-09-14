import os
import re

css_to_append = """

/* === CSS PARA BOTON DE AYUDA (UNIFICADO) === */
.chart-help-btn {
    background: rgba(15, 105, 180, 0.08) !important;
    border: 1px solid rgba(15, 105, 180, 0.15) !important;
    border-radius: 50% !important;
    width: 28px !important;
    height: 28px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    color: var(--minsal-blue) !important;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
    padding: 0 !important;
    margin-left: 5px !important;
    position: relative !important;
    flex-shrink: 0 !important;
}

.chart-help-btn::after {
    content: '' !important;
    position: absolute !important;
    top: 0; left: 0; right: 0; bottom: 0 !important;
    border-radius: 50% !important;
    border: 2px solid rgba(15, 105, 180, 0.4) !important;
    z-index: -1 !important;
    opacity: 0 !important;
    animation: pulseHelp 2s infinite cubic-bezier(0.66, 0, 0, 1) !important;
}

@keyframes pulseHelp {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(1.6); opacity: 0; }
}

.chart-help-btn .info-icon {
    transition: transform 0.3s ease !important;
}

.chart-help-btn:hover {
    background: var(--minsal-blue) !important;
    color: white !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 4px 12px rgba(15, 105, 180, 0.3) !important;
}

.chart-help-btn:hover::after {
    animation: none !important;
    opacity: 0 !important;
}

.chart-help-btn:hover .info-icon {
    transform: scale(1.1) rotate(10deg) !important;
}

.chart-help-btn:active {
    transform: translateY(0) !important;
}
"""

svg_icon = """<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="info-icon">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>"""

def append_css(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        if 'pulseHelp' not in content:
            with open(filepath, 'a', encoding='utf-8') as f:
                f.write(css_to_append)
            print(f"Appended CSS to {filepath}")
        else:
            print(f"CSS already exists in {filepath}")
    except Exception as e:
        print(f"Error appending CSS to {filepath}: {e}")

def fix_html_covid(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Match <button class="chart-help-btn"...> ... </button>
        # and replace its contents and styling.
        pattern = re.compile(r'<button\s+class="chart-help-btn"\s+onclick="openHelpModal\((.*?)\)"\s+style="[^"]*"\s+title="Ayuda Interpretativa">\s*<i class="fas fa-info-circle"></i>\s*</button>', re.IGNORECASE)
        
        def replacer(match):
            args = match.group(1)
            return f'<button class="chart-help-btn" onclick="openHelpModal({args})" title="Ayuda Interpretativa">\n    {svg_icon}\n</button>'
            
        new_content, count = pattern.subn(replacer, content)
        if count > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Replaced {count} instances in {filepath}")
        else:
            print(f"No instances found to replace in {filepath}")
    except Exception as e:
        print(f"Error in {filepath}: {e}")

def fix_html_programaticas(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Match <button class="info-btn" title="Ayuda Interpretativa" onclick="openHelpModal(...)"><i class="fas fa-info"></i></button>
        pattern = re.compile(r'<button\s+class="info-btn"\s+title="Ayuda Interpretativa"\s+onclick="openHelpModal\((.*?)\)">\s*<i class="fas fa-info"></i>\s*</button>', re.IGNORECASE)
        
        def replacer(match):
            args = match.group(1)
            return f'<button class="chart-help-btn" onclick="openHelpModal({args})" title="Ayuda Interpretativa">\n    {svg_icon}\n</button>'
            
        new_content, count = pattern.subn(replacer, content)
        if count > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Replaced {count} instances in {filepath}")
        else:
            print(f"No instances found to replace in {filepath}")
    except Exception as e:
        print(f"Error in {filepath}: {e}")

base_dir = r"c:\Antigravity IDE\WEB DEIS"

# Append CSS
append_css(os.path.join(base_dir, "VRS", "styles.css"))
append_css(os.path.join(base_dir, "Covid_Web", "styles.css"))
append_css(os.path.join(base_dir, "Programáticas_Web", "styles.css"))

# Fix HTML
fix_html_covid(os.path.join(base_dir, "Covid_Web", "index.html"))
fix_html_programaticas(os.path.join(base_dir, "Programáticas_Web", "index.html"))
fix_html_programaticas(os.path.join(base_dir, "Programáticas_Web", "index2.html"))
