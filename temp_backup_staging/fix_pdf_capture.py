import os

files = {
    "Influenza": r"c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js",
    "Covid":     r"c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js",
    "VRS":       r"c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js",
    "VPH":       r"c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js"
}

def fix_generate_pdf_capture(content, vaccine_name):
    start_marker = "    _generatePDF() {"
    end_marker = "    /**\n     * Descarga el reporte visual como PNG"
    
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    if end_idx == -1:
        end_marker = "    /**\r\n     * Descarga el reporte visual como PNG"
        end_idx = content.find(end_marker)
        
    if start_idx == -1 or end_idx == -1:
        print(f"[{vaccine_name}] Could not find _generatePDF bounds")
        return content
        
    new_generate = '''    _generatePDF() {
        const resultsContainer = document.getElementById('autoconsultaResults');
        if (!resultsContainer || resultsContainer.style.display === 'none') {
            alert('No hay reporte para exportar. Procese un archivo primero.');
            return;
        }

        const cd = this._state.chartData;
        if (!cd) return;

        // Ocultar botones de accion (Nueva Consulta y Exportar) para que no salgan en el PDF
        let actionButtons = null;
        // Buscamos el contenedor de botones que esta al final del resultsContainer
        const flexContainers = resultsContainer.querySelectorAll('div');
        flexContainers.forEach(div => {
            if (div.style.justifyContent === 'center' && div.style.display === 'flex' && div.innerHTML.includes('Exportar')) {
                actionButtons = div;
            }
        });
        
        if (actionButtons) {
            actionButtons.style.display = 'none';
        }

        // Expandir todos los acordeones (details) para capturar toda la informacion (Grafico Pareto, etc)
        const details = resultsContainer.querySelectorAll('details');
        const previouslyClosed = [];
        details.forEach(d => {
            if (!d.hasAttribute('open')) {
                previouslyClosed.push(d);
                d.setAttribute('open', '');
            }
        });

        // Configurar PDF
        const now = new Date();
        const fechaStr = now.toLocaleDateString('es-CL').replace(/\//g, '-');
        const opt = {
            margin:       10,
            filename:     `Informe_Web_${cd.nombreVacuna.replace(/\s/g, '_')}_${fechaStr}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                backgroundColor: '#f8fafc' // Color de fondo del body
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };

        if (typeof Toastify !== 'undefined') {
            Toastify({ text: '⏳ Capturando interfaz web... por favor espere.', duration: 3000, gravity: 'bottom', position: 'right', style: { background: '#3b82f6', borderRadius: '10px' } }).showToast();
        }

        // Darle 500ms al DOM para renderizar los acordeones abiertos antes de capturar
        setTimeout(() => {
            html2pdf().set(opt).from(resultsContainer).save().then(() => {
                // Restaurar estado
                if (actionButtons) actionButtons.style.display = 'flex';
                previouslyClosed.forEach(d => d.removeAttribute('open'));
                
                if (typeof Toastify !== 'undefined') {
                    Toastify({ text: '✅ PDF de la web descargado exitosamente', duration: 4000, gravity: 'bottom', position: 'right', style: { background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '10px' } }).showToast();
                }
            }).catch(err => {
                console.error("Error generando PDF:", err);
                alert("Ocurrió un error al generar el PDF.");
                if (actionButtons) actionButtons.style.display = 'flex';
                previouslyClosed.forEach(d => d.removeAttribute('open'));
            });
        }, 500);
    },
'''
    return content[:start_idx] + new_generate + content[end_idx:]

for vaccine, path in files.items():
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    content = fix_generate_pdf_capture(content, vaccine)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Fixed {vaccine} with WEB CAPTURE mode!")
