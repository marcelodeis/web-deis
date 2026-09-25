/* =========================================================================
   GLOBAL PREMIUM SCRIPT (DEIS)
   Dark Mode Memory, PDF Export, Loader Hook, and Toastify
   ========================================================================= */

// 1. GLOBAL LOADER LOGIC
window.hideDeisLoader = function() {
    const loader = document.getElementById('deis-global-loader');
    if (loader) {
        loader.classList.add('deis-loader-hidden');
    }
};

// Monkey-patch Papa.parse to automatically hide the loader when parsing finishes
if (typeof window.Papa !== 'undefined') {
    const originalPapaParse = window.Papa.parse;
    window.Papa.parse = function(file, config) {
        if (config) {
            const originalComplete = config.complete;
            config.complete = function(results, file) {
                if (originalComplete) {
                    originalComplete(results, file);
                }
                // Hide loader after a short delay to allow charts to render
                setTimeout(window.hideDeisLoader, 300);
            };
        }
        return originalPapaParse(file, config);
    };
} else {
    // Fallback if PapaParse isn't loaded or used
    if (document.readyState === 'complete') {
        setTimeout(window.hideDeisLoader, 500);
    } else {
        window.addEventListener('load', function() {
            setTimeout(window.hideDeisLoader, 500);
        });
    }
}

// FAILSAFE: Always hide loader after 3.5 seconds maximum, no matter what
setTimeout(window.hideDeisLoader, 3500);

// 2. DARK MODE MEMORY (LOCALSTORAGE)
function applySavedTheme() {
    const savedTheme = localStorage.getItem('deis-theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        // If there's an icon in the toggle button, update it
        const icon = document.querySelector('#themeToggleBtn i');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
        // Force chart updates if the global function exists
        if (typeof updateChartColors === 'function') {
            setTimeout(updateChartColors, 100);
        }
    }
}

// Hook into DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    
    // Apply theme on load
    applySavedTheme();

    // Intercept theme toggle click
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        // Remove existing inline onclick if any
        themeBtn.removeAttribute('onclick');
        
        // Clone and replace to strip existing event listeners just in case
        const newBtn = themeBtn.cloneNode(true);
        themeBtn.parentNode.replaceChild(newBtn, themeBtn);
        
        newBtn.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('deis-theme', isDark ? 'dark' : 'light');
            
            const icon = newBtn.querySelector('i');
            if (icon) {
                if (isDark) {
                    icon.classList.remove('fa-moon');
                    icon.classList.add('fa-sun');
                } else {
                    icon.classList.remove('fa-sun');
                    icon.classList.add('fa-moon');
                }
            }
            
            if (typeof updateChartColors === 'function') {
                updateChartColors();
            }
            
            // Show toast
            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: isDark ? "🌓 Modo oscuro activado" : "☀️ Modo claro activado",
                    duration: 2000,
                    gravity: "bottom",
                    position: "right",
                    className: "toastify-info"
                }).showToast();
            }
        });
    }
    
    // 3. TOASTIFY ON FILTERS
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
        select.addEventListener('change', function() {
            if (typeof Toastify !== 'undefined') {
                const label = this.options[this.selectedIndex].text;
                Toastify({
                    text: "Filtro aplicado: " + label,
                    duration: 3000,
                    gravity: "bottom",
                    position: "right",
                    className: "toastify-success"
                }).showToast();
            }
        });
    });
    
    // 4. GENERATE PDF REPORT
    const btnExportPdf = document.getElementById('btnExportPdf');
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', function() {
            if (typeof html2pdf === 'undefined') {
                alert("Error: La librería PDF no se cargó correctamente.");
                return;
            }
            
            // Notify user
            Toastify({
                text: "📄 Generando informe PDF... Por favor espera.",
                duration: 4000,
                gravity: "bottom",
                position: "right",
                className: "toastify-info"
            }).showToast();
            
            const element = document.body;
            const opt = {
                margin:       10,
                filename:     'Reporte_DEIS_' + new Date().toLocaleDateString('es-CL').replace(/\//g, '-') + '.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, logging: false },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };
            
            document.body.classList.add('pdf-exporting');
            
            html2pdf().set(opt).from(element).save().then(() => {
                document.body.classList.remove('pdf-exporting');
                Toastify({
                    text: "✅ Informe descargado con éxito.",
                    duration: 3000,
                    gravity: "bottom",
                    position: "right",
                    className: "toastify-success"
                }).showToast();
            });
        });
    }
    
    // 5. DYNAMIC STICKY TAB NAVIGATION
    function updateStickyTabs() {
        const header = document.getElementById('dashboardHeader');
        const tabNav = document.getElementById('tabNav');
        
        if (header && tabNav) {
            // La nav global suele medir 56px (definido en #dashboardHeader top)
            const headerHeight = header.offsetHeight;
            const totalTop = 56 + headerHeight;
            tabNav.style.setProperty('top', totalTop + 'px', 'important');
        }
    }

    // Calcular en la carga inicial y cuando la ventana cambie de tamaño
    updateStickyTabs();
    window.addEventListener('resize', updateStickyTabs);

    // Recalcular si los filtros cambian (pueden afectar la altura del header en móviles)
    const allFilters = document.querySelectorAll('.main-filter, .year-toggle-btn, button');
    allFilters.forEach(el => {
        el.addEventListener('click', () => setTimeout(updateStickyTabs, 100));
        el.addEventListener('change', () => setTimeout(updateStickyTabs, 100));
    });
});
