import codecs

path = r'c:\Antigravity IDE\WEB DEIS\Covid_Web\index.html'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

nav_bar = """    <!-- ── BARRA DE NAVEGACIÓN GLOBAL RNI ── -->
                <!-- 🛸 BARRA DE NAVEGACIÓN GLOBAL RNI 🛸 -->
    <nav class="global-nav-bar">
        <div class="global-nav-left">
            <a href="../Portal_Web/index.html" class="btn-portal-rni">
                <i class="fas fa-home"></i> Portal RNI
            </a>
        </div>
        
        <div class="global-nav-center d-none d-md-flex">
            <a href="https://estadisticas.ssosorno.cl/index.php" style="color: #ffffff; display: flex; align-items: center; text-decoration: none;">
                <!-- Mini Logo DEIS SVG -->
                <svg viewBox="0 0 400 300" height="40" style="margin-right: 15px;" xmlns="http://www.w3.org/2000/svg">
                    <rect x="0" y="100" width="50" height="150" fill="#0072bc" />
                    <rect x="60" y="40" width="50" height="210" fill="#00adef" />
                    <rect x="120" y="0" width="120" height="250" fill="#ffffff" />
                    <text font-family="'Inter', Arial, sans-serif" font-weight="700" font-size="130" letter-spacing="-3">
                        <tspan x="140" y="220" fill="#0b1f40">D</tspan>
                        <tspan x="250" y="220" fill="#ffffff">EIS</tspan>
                    </text>
                    <text x="255" y="250" font-family="'Inter', Arial, sans-serif" font-weight="500" font-size="26" fill="#ffffff" letter-spacing="1">OSORNO</text>
                </svg>
                <div style="line-height: 1.2;">
                    <div style="font-weight: 700; font-size: 16px; letter-spacing: 0.5px; color: #ffffff;">SERVICIO DE SALUD OSORNO</div>
                    <div style="font-size: 12px; font-weight: 400; opacity: 0.8; color: #ffffff;">Departamento de Estadísticas e Información de Salud</div>
                </div>
            </a>
        </div>

        <div class="global-nav-right">
            <button class="global-nav-dropdown-btn">
                <i class="fas fa-syringe"></i> Cambiar Vacuna <i class="fas fa-chevron-down" style="font-size: 0.7rem; margin-left: 2px;"></i>
            </button>
            <div class="global-nav-dropdown-content">
                <a href="../Influenza_Web/index.html" ><i class="fas fa-virus" style="color: #3b82f6;"></i> Campaña Influenza</a>
                <a href="../VPH_Web/index.html" ><i class="fas fa-ribbon" style="color: #ec4899;"></i> Vacuna VPH</a>
                <a href="../Covid_Web/index.html" class="active"><i class="fas fa-biohazard" style="color: #10b981;"></i> Campaña COVID-19</a>
                <a href="../VRS/index.html" ><i class="fas fa-shield-virus" style="color: #8b5cf6;"></i> Campaña VRS</a>
                <a href="../Programáticas_Web/index.html" ><i class="fas fa-syringe" style="color: #f59e0b;"></i> Vacunas Programáticas</a>
                <div style="border-top: 1px solid #e2e8f0; margin: 4px 0;"></div>
                <a href="../Portal_Web/index.html" style="color: #64748b;"><i class="fas fa-arrow-left"></i> Volver al Menú Principal</a>
            </div>
        </div>
    </nav>
"""

# Check if the loader-overlay exists to decide where to insert
loader_tag = """    <div id="loader-overlay" class="loader-overlay" style="display: none; position: fixed; inset: 0; background: rgba(255,255,255,0.8); z-index: 9999; justify-content: center; align-items: center;">"""
body_tag = """<body>\n"""

if loader_tag in content:
    # Insert before loader
    content = content.replace(loader_tag, nav_bar + "\n" + loader_tag)
else:
    # Insert after body
    content = content.replace(body_tag, body_tag + nav_bar)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
