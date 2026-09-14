import codecs
import os

modules = ["Influenza_Web", "Covid_Web", "VRS", "VPH_Web"]
base_dir = r"c:\Antigravity IDE\WEB DEIS"

js_append = """

// ==========================================
// DESCARGAR PLANTILLA EXCEL
// ==========================================
window.downloadTemplate = function() {
    if (typeof XLSX === 'undefined') {
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: "Error: Librería de Excel no cargada. Recargue la página.",
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: "linear-gradient(to right, #e74c3c, #c0392b)" }
            }).showToast();
        } else {
            alert('Error: Librería de Excel no cargada.');
        }
        return;
    }
    
    // Crear un libro y una hoja simple con la cabecera 'RUT'
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['RUT']]);
    
    // Darle un poco de estilo si es posible, o al menos un ancho de columna decente
    ws['!cols'] = [{wch: 15}];
    
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, 'Plantilla_Autoconsulta.xlsx');
};
"""

for mod in modules:
    file_path = os.path.join(base_dir, mod, "autoconsulta.js")
    if os.path.exists(file_path):
        with codecs.open(file_path, "a", "utf-8") as f:
            f.write(js_append)
        print(f"Updated {mod}/autoconsulta.js")
    else:
        print(f"File not found: {file_path}")
