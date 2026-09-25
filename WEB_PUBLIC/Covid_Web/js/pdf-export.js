/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · PDF Export Module
   Exportación de reportes tabulares (Matriz Técnica) con html2pdf.js
   ══════════════════════════════════════════════════════════════════════════════ */

import { getCurrentYear, getData, fmt } from './data.js';

export function exportToPDF() {
    if (typeof html2pdf === 'undefined') {
        alert("Librería PDF no cargada.");
        return;
    }

    const currentYear = getCurrentYear();
    const DATA = getData();
    const table = document.querySelector('.matriz-table');
    if (!table) {
        alert("No hay datos en la tabla para exportar.");
        return;
    }

    const btnPdf = document.getElementById('btnExportPDF');
    const originalText = btnPdf.innerHTML;
    btnPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    btnPdf.disabled = true;

    // 1. Extraer Datos (Igual que en Excel)
    const thElements = Array.from(table.querySelectorAll('thead th'));
    const headerNames = thElements.map(th => th.textContent);

    const trElements = Array.from(table.querySelectorAll('tbody tr'));
    const extractedData = [];
    trElements.forEach(tr => {
        if (tr.classList.contains('grand-total') || tr.classList.contains('subtotal-row')) return;
        const tds = Array.from(tr.querySelectorAll('td'));
        if (tds.length === 1) return;
        
        const rowData = tds.map(td => {
            const txt = td.textContent.replace(/\./g, '');
            return isNaN(txt) ? txt : Number(txt);
        });
        extractedData.push(rowData);
    });

    const comunasMap = {};
    extractedData.forEach(row => {
        const comuna = row[0];
        if (!comunasMap[comuna]) comunasMap[comuna] = [];
        comunasMap[comuna].push(row);
    });
    
    const sortedComunas = Object.keys(comunasMap).sort();
    const dataRows = [];
    
    sortedComunas.forEach(comuna => {
        const rows = comunasMap[comuna];
        let comunaSums = new Array(headerNames.length).fill(0);
        
        rows.forEach(row => {
            dataRows.push({ type: 'data', data: row });
            for (let i = 2; i < row.length; i++) {
                comunaSums[i] += (Number(row[i]) || 0);
            }
        });
        
        let subRow = new Array(headerNames.length).fill("");
        subRow[0] = "";
        subRow[1] = `Subtotal ${comuna}`;
        for (let i = 2; i < subRow.length; i++) {
            subRow[i] = comunaSums[i];
        }
        dataRows.push({ type: 'subtotal', data: subRow });
    });

    if (sortedComunas.length > 0) {
        let grandTotalRow = new Array(headerNames.length).fill("");
        grandTotalRow[0] = "";
        grandTotalRow[1] = "Total General";
        for (let i = 2; i < headerNames.length; i++) grandTotalRow[i] = 0;
        
        sortedComunas.forEach(comuna => {
            const rows = comunasMap[comuna];
            rows.forEach(row => {
                for (let i = 2; i < row.length; i++) {
                    grandTotalRow[i] += (Number(row[i]) || 0);
                }
            });
        });
        dataRows.push({ type: 'grandtotal', data: grandTotalRow });
    }

    // Filtros aplicados
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-CL');
    const cutoffDate = (DATA && DATA.fecha_actualizacion) ? DATA.fecha_actualizacion : dateStr;
    
    const critNodes = document.querySelectorAll('#matrizCriterioMultiSelect input:checked:not([value="all"])');
    const isAllCrit = document.getElementById('criterioSelectAll')?.checked;
    let criterioText = "Todos";
    if (!isAllCrit && critNodes.length > 0) {
        criterioText = Array.from(critNodes).map(n => n.parentElement.textContent.trim()).join(", ");
    }

    const comNodes = document.querySelectorAll('#matrizComunaMultiSelect input:checked:not([value="all"])');
    const isAllCom = document.getElementById('comunaSelectAll')?.checked;
    let comunaText = "Todas";
    if (!isAllCom && comNodes.length > 0) {
        comunaText = Array.from(comNodes).map(n => n.parentElement.textContent.trim()).join(", ");
    }

    // 2. Construir HTML para el PDF
    const reportDiv = document.createElement('div');
    reportDiv.style.padding = '20px';
    reportDiv.style.fontFamily = "'Inter', sans-serif";
    reportDiv.style.color = '#1e293b';
    reportDiv.style.backgroundColor = '#ffffff';

    // Encabezado
    reportDiv.innerHTML = `
        <div style="border-bottom: 3px solid #0f69b4; padding-bottom: 10px; margin-bottom: 20px;">
            <h1 style="color: #0f69b4; margin: 0; font-size: 24px; text-transform: uppercase;">Reporte COVID-19 ${currentYear}</h1>
            <h2 style="color: #475569; margin: 5px 0 0 0; font-size: 16px;">Servicio de Salud Osorno - Reporte por Ocurrencia</h2>
        </div>
        <div style="margin-bottom: 20px; font-size: 12px; color: #334155;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="width: 50%; vertical-align: top;">
                        <strong style="text-decoration: underline;">INFORMACIÓN DEL REPORTE</strong><br>
                        <strong>Comuna:</strong> ${comunaText}<br>
                        <strong>Periodo Informado:</strong> Campaña Anual ${currentYear}<br>
                        <strong>Criterios Seleccionados:</strong> ${criterioText}<br>
                    </td>
                    <td style="width: 50%; vertical-align: top; text-align: right;">
                        <strong>Filtro Fecha de Corte:</strong> Actual (${cutoffDate})<br>
                        <strong>Fuente:</strong> DEIS - MINSAL<br>
                        <strong>Fecha de Actualización:</strong> Actual (${cutoffDate})<br>
                    </td>
                </tr>
            </table>
        </div>
    `;

    // Tabla de Datos
    const tableHTML = document.createElement('table');
    tableHTML.style.width = '100%';
    tableHTML.style.borderCollapse = 'collapse';
    tableHTML.style.fontSize = '9px'; // Letra pequeña para que quepa en A4 Horizontal

    // Thead
    let theadStr = '<thead><tr>';
    headerNames.forEach(h => {
        theadStr += `<th style="background-color: #17365D; color: white; padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: bold;">${h}</th>`;
    });
    theadStr += '</tr></thead>';
    tableHTML.innerHTML = theadStr;

    // Tbody
    const tbody = document.createElement('tbody');
    dataRows.forEach(rowObj => {
        const tr = document.createElement('tr');
        
        let bgColor = '#ffffff';
        let color = '#000000';
        let fontWeight = 'normal';

        if (rowObj.type === 'subtotal') {
            bgColor = '#E9ECEF';
            fontWeight = 'bold';
        } else if (rowObj.type === 'grandtotal') {
            bgColor = '#17365D';
            color = '#ffffff';
            fontWeight = 'bold';
        }

        rowObj.data.forEach((cellVal, idx) => {
            const td = document.createElement('td');
            td.style.border = '1px solid #000';
            td.style.padding = '4px';
            td.style.fontWeight = fontWeight;
            td.style.backgroundColor = bgColor;
            td.style.color = color;

            if (idx === 0 || idx === 1) {
                td.style.textAlign = 'left';
            } else {
                td.style.textAlign = 'center';
            }

            // Color specific for subtotal numbers
            if (rowObj.type === 'subtotal' && idx >= 2) {
                td.style.backgroundColor = '#366092';
                td.style.color = '#ffffff';
            }

            // Darker background for the last column (Total column)
            if (idx === rowObj.data.length - 1) {
                td.style.fontWeight = 'bold';
                td.style.color = '#ffffff';
                if (rowObj.type === 'subtotal') {
                    td.style.backgroundColor = '#366092';
                } else {
                    td.style.backgroundColor = '#17365D';
                }
            }

            td.textContent = (idx >= 2 && typeof cellVal === 'number') ? fmt(cellVal) : cellVal;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    
    tableHTML.appendChild(tbody);
    reportDiv.appendChild(tableHTML);

    // Disclaimer Footer
    const footer = document.createElement('div');
    footer.innerHTML = `
        <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-size: 8px; color: #64748b; text-align: center;">
            Documento generado automáticamente por el Sistema de Geointeligencia Epidemiológica. <br>
            Los datos representados excluyen Errores Programáticos (EPRO) según norma técnica MINSAL.
        </div>
    `;
    reportDiv.appendChild(footer);

    // No agregar al DOM, html2pdf puede procesar el elemento o string HTML
    // directamente. Pasaremos el HTML interno.

    // Opciones html2pdf
    const opt = {
        margin:       10,
        filename:     `Reporte_COVID_${currentYear}_Ocurrencia.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(reportDiv).save().then(() => {
        btnPdf.innerHTML = originalText;
        btnPdf.disabled = false;
    }).catch(err => {
        console.error("Error generating PDF", err);
        btnPdf.innerHTML = originalText;
        btnPdf.disabled = false;
        alert("Ocurrió un error al generar el PDF.");
    });
}

// Hacerlo disponible globalmente
window.exportToPDF = exportToPDF;
