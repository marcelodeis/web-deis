/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Table Module
   Matriz técnica, filtros multi-select y exportación Excel
   ══════════════════════════════════════════════════════════════════════════════ */

import { getData, getCurrentYear, COMUNAS, fmt } from './data.js';

// ── Multi-Select Logic ───────────────────────────────────────────────────────
export function setupMultiSelect(optionsListId, selectAllId, multiSelectId, defaultText, emptyText, dataList, valueFn, labelFn, preSelected = null) {
    const optionsList = document.getElementById(optionsListId);
    if (!optionsList) return;

    optionsList.innerHTML = '';
    dataList.forEach(item => {
        const val = valueFn(item);
        const label = labelFn(item);
        const isChecked = preSelected ? preSelected.includes(val) : true;
        const labelEl = document.createElement('label');
        labelEl.innerHTML = `<input type="checkbox" value="${val}" class="${optionsListId}-cb" ${isChecked ? 'checked' : ''}> ${label}`;
        optionsList.appendChild(labelEl);
    });

    const oldSelectAllCb = document.getElementById(selectAllId);
    if(!oldSelectAllCb) return;
    const selectAllCb = oldSelectAllCb.cloneNode(true);
    oldSelectAllCb.parentNode.replaceChild(selectAllCb, oldSelectAllCb);
    
    if (dataList.length <= 1) selectAllCb.parentNode.style.display = 'none';
    else selectAllCb.parentNode.style.display = '';
    
    if (!optionsList.dataset.initialized) {
        document.addEventListener('click', (e) => {
            const container = document.getElementById(multiSelectId);
            if (container && !container.contains(e.target)) container.classList.remove('open');
        });
        optionsList.dataset.initialized = 'true';
    }

    const cbs = document.querySelectorAll(`.${optionsListId}-cb`);
    
    selectAllCb.addEventListener('change', (e) => {
        cbs.forEach(cb => cb.checked = e.target.checked);
        updateSelectText();
        renderTable();
    });

    cbs.forEach(cb => {
        cb.addEventListener('change', () => {
            selectAllCb.checked = Array.from(cbs).every(c => c.checked);
            updateSelectText();
            renderTable();
        });
    });
    
    function updateSelectText() {
        const selectedCount = Array.from(cbs).filter(c => c.checked).length;
        const textSpan = document.querySelector(`#${multiSelectId} .selected-text`);
        if (dataList.length === 1) {
            textSpan.textContent = selectedCount === 1 ? labelFn(dataList[0]) : emptyText;
        } else {
            if (selectedCount === cbs.length) textSpan.textContent = defaultText;
            else if (selectedCount === 0) textSpan.textContent = emptyText;
            else textSpan.textContent = `${selectedCount} seleccionados`;
        }
    }
    updateSelectText();
}

// ── Dynamic Filters ──────────────────────────────────────────────────────────
export function updateDynamicFilters() {
    const DATA = getData();
    if(!DATA) return;
    
    const selectedComunas = Array.from(document.querySelectorAll('.comunaOptionsList-cb:checked')).map(c => c.value);
    const preCom = selectedComunas.length ? selectedComunas : COMUNAS;
    setupMultiSelect('comunaOptionsList', 'comunaSelectAll', 'matrizComunaMultiSelect', 'Todas las Comunas', 'Ninguna', COMUNAS, c=>c, c=>c, preCom);
    
    const applySubFilters = () => {
        const coms = Array.from(document.querySelectorAll('.comunaOptionsList-cb:checked')).map(c => c.value);
        const estabQuery = (document.getElementById('searchEstab')?.value || '').toLowerCase();
        
        let filtered = DATA.data_ocurrencia.filter(d => coms.includes(d.comuna) && d.establecimiento.toLowerCase().includes(estabQuery));
        
        let validVacs = new Set();
        let validCrits = new Set();
        filtered.forEach(d => {
            Object.keys(d.datos_mes || {}).forEach(v => validVacs.add(v));
            validCrits.add(d.criterio);
        });
        
        const isAllVacs = document.getElementById('vacunaBaseSelectAll')?.checked;
        const selVacs = isAllVacs ? null : Array.from(document.querySelectorAll('.vacunaBaseOptionsList-cb:checked')).map(c => c.value);
        setupMultiSelect('vacunaBaseOptionsList', 'vacunaBaseSelectAll', 'matrizVacunaBaseMultiSelect', 'Todas las Vacunas', 'Ninguna', [...validVacs].sort(), v=>v, v=>v, selVacs);
        
        const isAllCrits = document.getElementById('criterioSelectAll')?.checked;
        const selCrits = isAllCrits ? null : Array.from(document.querySelectorAll('.criterioOptionsList-cb:checked')).map(c => c.value);
        setupMultiSelect('criterioOptionsList', 'criterioSelectAll', 'matrizCriterioMultiSelect', 'Todos los Criterios', 'Ninguno', [...validCrits].sort(), v=>v, v=>v, selCrits);
        
        document.querySelectorAll('.vacunaBaseOptionsList-cb, .criterioOptionsList-cb').forEach(cb => cb.addEventListener('change', renderTable));
        document.getElementById('vacunaBaseSelectAll')?.addEventListener('change', renderTable);
        document.getElementById('criterioSelectAll')?.addEventListener('change', renderTable);
        
        const corteSelect = document.getElementById('fechaCorteSelect');
        if (corteSelect && !corteSelect.dataset.initialized) {
            corteSelect.addEventListener('change', renderTable);
            corteSelect.dataset.initialized = 'true';
        }
        
        renderTable();
    };

    document.querySelectorAll('.comunaOptionsList-cb').forEach(cb => cb.addEventListener('change', applySubFilters));
    document.getElementById('comunaSelectAll')?.addEventListener('change', applySubFilters);
    document.getElementById('searchEstab')?.addEventListener('input', applySubFilters);
    
    applySubFilters();
}

// ── Render Table ─────────────────────────────────────────────────────────────
export function renderTable() {
    const DATA = getData();
    if (!DATA) return;
    const container = document.getElementById('tableProdContainer');
    const estabQuery = (document.getElementById('searchEstab').value || '').toLowerCase();
    
    const comCbs = document.querySelectorAll('.comunaOptionsList-cb');
    const comunasActivas = comCbs.length ? Array.from(comCbs).filter(c => c.checked).map(c=>c.value) : COMUNAS;
    
    const vacCbs = document.querySelectorAll('.vacunaBaseOptionsList-cb');
    const vacActivas = vacCbs.length ? Array.from(vacCbs).filter(c => c.checked).map(c=>c.value) : DATA.headers;
    
    const critCbs = document.querySelectorAll('.criterioOptionsList-cb');
    let critsActivos = null;
    if(critCbs.length) critsActivos = Array.from(critCbs).filter(c => c.checked).map(c=>c.value);

    let filtered = DATA.data_ocurrencia.filter(d => 
        comunasActivas.includes(d.comuna) && 
        d.establecimiento.toLowerCase().includes(estabQuery) &&
        (!critsActivos || critsActivos.includes(d.criterio))
    );
    
    const estabMap = {};
    filtered.forEach(d => {
        if (!estabMap[d.establecimiento]) estabMap[d.establecimiento] = { comuna: d.comuna, total: 0, vacs: {} };
        Object.keys(d.datos_mes || {}).forEach(v => {
            if (vacActivas.includes(v)) {
                if (!estabMap[d.establecimiento].vacs[v]) estabMap[d.establecimiento].vacs[v] = 0;
                
                const corteEl = document.getElementById('fechaCorteSelect');
                let maxMonth = 12;
                if (corteEl && corteEl.value) {
                    if (corteEl.value.toLowerCase().includes('actual')) {
                        maxMonth = 12;
                    } else {
                        const parts = corteEl.value.split('/');
                        if (parts.length >= 2) {
                            maxMonth = parseInt(parts[1], 10);
                        }
                    }
                }
                
                const sum = Object.entries(d.datos_mes[v] || {})
                                  .filter(([m, _]) => parseInt(m) <= maxMonth)
                                  .reduce((a, [_, count]) => a + count, 0);
                                  
                estabMap[d.establecimiento].vacs[v] += sum;
                estabMap[d.establecimiento].total += sum;
            }
        });
    });
    
    const estabs = Object.keys(estabMap).sort((a,b) => estabMap[b].total - estabMap[a].total);
    
    const comunasMapHtml = {};
    estabs.forEach(e => {
        if (estabMap[e].total === 0) return;
        const c = estabMap[e].comuna;
        if (!comunasMapHtml[c]) comunasMapHtml[c] = [];
        comunasMapHtml[c].push(e);
    });

    const sortedComunasHtml = Object.keys(comunasMapHtml).sort();
    
    let htmlParts = [];
    htmlParts.push(`<table class="matriz-table">
        <thead>
            <tr>
                <th>Comuna</th>
                <th>Establecimiento</th>
                ${vacActivas.map(h => `<th>${h}</th>`).join('')}
                <th>Total</th>
            </tr>
        </thead>
        <tbody>`);
        
    if (sortedComunasHtml.length === 0) {
        htmlParts.push(`<tr><td colspan="${vacActivas.length + 3}" style="text-align:center;">No hay datos para mostrar</td></tr>`);
    } else {
        let grandTotalVacs = {};
        vacActivas.forEach(v => grandTotalVacs[v] = 0);
        let grandTotalAll = 0;

        sortedComunasHtml.forEach(comuna => {
            const estabsEnComuna = comunasMapHtml[comuna];
            
            let subtotalVacs = {};
            vacActivas.forEach(v => subtotalVacs[v] = 0);
            let subtotalAll = 0;
            
            estabsEnComuna.forEach(e => {
                htmlParts.push(`<tr>
                    <td>${comuna}</td>
                    <td>${e}</td>
                    ${vacActivas.map(h => {
                        const v = estabMap[e].vacs[h] || 0;
                        subtotalVacs[h] += v;
                        grandTotalVacs[h] += v;
                        return `<td class="num">${fmt(v)}</td>`;
                    }).join('')}
                    <td class="num total-col">${fmt(estabMap[e].total)}</td>
                </tr>`);
                subtotalAll += estabMap[e].total;
                grandTotalAll += estabMap[e].total;
            });
            
            htmlParts.push(`<tr class="subtotal-row">
                <td></td>
                <td style="text-align: center;">Subtotal ${comuna}</td>
                ${vacActivas.map(h => `<td class="num">${fmt(subtotalVacs[h])}</td>`).join('')}
                <td class="num total-col">${fmt(subtotalAll)}</td>
            </tr>`);
        });
        
        htmlParts.push(`<tr class="grand-total">
            <td></td>
            <td style="text-align: center; font-weight: 900; color: #fff;">Total General</td>
            ${vacActivas.map(h => `<td class="num" style="font-weight: 900; color: #fff;">${fmt(grandTotalVacs[h])}</td>`).join('')}
            <td class="num total-col" style="font-weight: 900; color: #fff;">${fmt(grandTotalAll)}</td>
        </tr>`);
    }
    
    htmlParts.push(`</tbody></table>`);
    requestAnimationFrame(() => {
        container.innerHTML = htmlParts.join('');
    });
}

// ── Export Excel ──────────────────────────────────────────────────────────────
export function setupExcelExport() {
    const btnExcel = document.getElementById('btnExportExcel');
    if (!btnExcel) return;

    btnExcel.addEventListener('click', () => {
        const currentYear = getCurrentYear();
        const DATA = getData();
        if (typeof XLSX === 'undefined') { alert("Librería Excel no cargada."); return; }
        const table = document.querySelector('.matriz-table');
        if (!table) return;

        const thElements = Array.from(table.querySelectorAll('thead th'));
        const headerNames = thElements.map(th => th.textContent);

        const dataRows = [];
        
        dataRows.push([]);
        dataRows.push([`REPORTE COVID-19 ${currentYear}`]);
        dataRows.push([`Servicio de Salud Osorno`]);
        dataRows.push([`Reporte por Ocurrencia`]);
        dataRows.push([]);
        dataRows.push([`INFORMACIÓN DEL REPORTE`]);

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

        const corteEl = document.getElementById('fechaCorteSelect');
        const corteSelectedText = corteEl ? corteEl.options[corteEl.selectedIndex].text : `Actual (${cutoffDate})`;

        dataRows.push([`- Comuna:`, comunaText]);
        dataRows.push([`- Periodo Informado:`, `Campaña Anual ${currentYear}`]);
        dataRows.push([`- Filtro Fecha de Corte:`, corteSelectedText]);
        dataRows.push([`- Fuente:`, `DEIS - MINSAL`]);
        dataRows.push([`- Fecha de Actualización:`, `Actual (${cutoffDate})`]);
        dataRows.push([]);
        dataRows.push(headerNames);

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
        const subtotalRowIndices = new Set();
        
        sortedComunas.forEach(comuna => {
            const rows = comunasMap[comuna];
            let comunaSums = new Array(headerNames.length).fill(0);
            
            rows.forEach(row => {
                dataRows.push(row);
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
            dataRows.push(subRow);
            subtotalRowIndices.add(dataRows.length - 1);
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
            dataRows.push(grandTotalRow);
            subtotalRowIndices.add(dataRows.length - 1);
        }

        const ws = XLSX.utils.aoa_to_sheet(dataRows);

        const titleStyle = { font: { bold: true, sz: 14 } };
        const subTitleStyle = { font: { bold: true, sz: 11 } };
        const infoTitleStyle = { font: { bold: true, sz: 10, underline: true } };
        const infoLabelStyle = { font: { bold: true, sz: 10 } };
        const infoValStyle = { font: { sz: 10 } };

        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
            fill: { fgColor: { rgb: "17365D" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };
        
        const cellStyleWhiteLeft = {
            font: { sz: 10 },
            alignment: { horizontal: "left", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };

        const cellStyleWhiteCenter = {
            font: { sz: 10 },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };

        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({r: R, c: C});
                if (!ws[cellRef]) continue;
                
                if (R === 1) {
                    ws[cellRef].s = titleStyle;
                } else if (R === 2 || R === 3) {
                    ws[cellRef].s = subTitleStyle;
                } else if (R === 5) {
                    ws[cellRef].s = infoTitleStyle;
                } else if (R >= 6 && R <= 10) {
                    if (C === 0) ws[cellRef].s = infoLabelStyle;
                    if (C === 1) ws[cellRef].s = infoValStyle;
                } else if (R === 12) {
                    ws[cellRef].s = headerStyle;
                } else if (R > 12) {
                    let isTextCol = (C === 0 || C === 1);
                    let cellS = isTextCol ? { ...cellStyleWhiteLeft } : { ...cellStyleWhiteCenter };
                    
                    const isGrandTotal = (R === range.e.r);
                    
                    if (isGrandTotal) {
                        cellS.font = { ...cellS.font, bold: true, color: { rgb: "FFFFFF" } };
                        cellS.fill = { fgColor: { rgb: "17365D" } };
                        if (C === 1) {
                            cellS.alignment = { horizontal: "center", vertical: "center" };
                        }
                    } else if (subtotalRowIndices.has(R)) {
                        cellS.font = { ...cellS.font, bold: true };
                        cellS.fill = { fgColor: { rgb: "E9ECEF" } };
                        if (C === 1) {
                            cellS.alignment = { horizontal: "center", vertical: "center" };
                        }
                    }
                    
                    if (C === range.e.c) {
                        cellS.font = { ...cellS.font, bold: true, color: { rgb: "FFFFFF" } };
                        if (subtotalRowIndices.has(R)) {
                            cellS.fill = { fgColor: { rgb: "366092" } };
                        } else {
                            cellS.fill = { fgColor: { rgb: "17365D" } };
                        }
                    }
                    
                    ws[cellRef].s = cellS;
                    
                    if (!isTextCol) {
                        ws[cellRef].z = '#,##0';
                    }
                }
            }
        }

        const EXTEND_ROWS = 30;
        const EXTEND_COLS = 10;
        const originalMaxR = range.e.r;
        const originalMaxC = range.e.c;
        const maxR = originalMaxR + EXTEND_ROWS;
        const maxC = Math.max(originalMaxC + EXTEND_COLS, 15);
        
        for (let R = 0; R <= maxR; ++R) {
            for (let C = 0; C <= maxC; ++C) {
                const cellRef = XLSX.utils.encode_cell({r: R, c: C});
                if (!ws[cellRef]) {
                    ws[cellRef] = { t: 's', v: '' };
                }
                if (!ws[cellRef].s) {
                    ws[cellRef].s = {};
                }
                if (R < 12 || R > originalMaxR || C > originalMaxC) {
                    if (!ws[cellRef].s.fill) {
                        ws[cellRef].s.fill = { fgColor: { rgb: "FFFFFF" } };
                    }
                }
            }
        }
        ws['!ref'] = XLSX.utils.encode_range({s: {r: 0, c: 0}, e: {r: maxR, c: maxC}});

        ws['!merges'] = [
            { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
            { s: { r: 5, c: 0 }, e: { r: 5, c: 4 } }
        ];

        ws['!cols'] = [
            { wch: 15 },
            { wch: 40 }
        ];
        for (let i = 2; i < headerNames.length; i++) ws['!cols'].push({ wch: 15 });

        ws['!views'] = [{ showGridLines: false }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Produccion");
        XLSX.writeFile(wb, `Matriz_COVID_Ocurrencia_${currentYear}.xlsx`);
    });
}
