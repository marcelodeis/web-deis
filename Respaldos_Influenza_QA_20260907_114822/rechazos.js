document.addEventListener('DOMContentLoaded', () => {



    if (!window.dataRechazos) {



        console.error("No se encontróó data de rechazos.");



        return;



    }







    // Initialize group filter options



    const grupos = [...new Set(window.dataRechazos.map(d => d.grupo))].sort();



    const grupoSelect = document.getElementById('rechazosGrupoFilter');



    if (grupoSelect) {



        const otrosRegistrosList = ["Población general", "SIN GRUPO REGISTRADO", "Vacunación privada (No población objetivo)", "Otras prioridades", "EPRO", "Poblacion general"];



        



        const optgroupObjetivo = document.createElement('optgroup');



        optgroupObjetivo.label = "GRUPOS OBJETIVO";



        const optgroupOtros = document.createElement('optgroup');



        optgroupOtros.label = "OTROS REGISTROS";







        grupos.forEach(g => {



            const opt = document.createElement('option');



            opt.value = g;



            opt.textContent = g;



            if (otrosRegistrosList.some(o => g.toUpperCase().includes(o.toUpperCase()))) {



                optgroupOtros.appendChild(opt);



            } else {



                optgroupObjetivo.appendChild(opt);



            }



        });



        



        if (optgroupObjetivo.children.length > 0) grupoSelect.appendChild(optgroupObjetivo);



        



        // Add visual separator before OTROS REGISTROS



        if (optgroupOtros.children.length > 0) {



            const spacer = document.createElement('option');



            spacer.disabled = true;



            spacer.textContent = "----------";



            grupoSelect.appendChild(spacer);



            grupoSelect.appendChild(optgroupOtros);



        }



        



        grupoSelect.addEventListener('change', renderRechazos);



    }







    // Listen to global filters



    const globalComuna = document.getElementById('globalComunaFilter');



    if (globalComuna) {



        globalComuna.addEventListener('change', renderRechazos);



    }



    



    // Initialize Ocurrencia Select

    const ocurrencias = [...new Set(window.dataRechazos.map(d => d.comuna_ocurrencia).filter(Boolean))].sort();

    const ocurrenciaSelect = document.getElementById('rechazosOcurrenciaSelect');

    if (ocurrenciaSelect) {

        ocurrencias.forEach(c => {

            if (c !== 'DESCONOCIDA' && c !== 'SIN INFORMACION') {

                const opt = document.createElement('option');

                opt.value = c;

                opt.textContent = c;

                ocurrenciaSelect.appendChild(opt);

            }

        });

        

        ocurrenciaSelect.addEventListener('change', () => {

            if (typeof renderRechazosDetalleEstablecimientos === 'function') {

                // Since this runs independent of row clicks now, we need to grab the global state variables:

                const currentYearEl = document.querySelector('.year-btn.active');

                const currentYear = currentYearEl ? parseInt(currentYearEl.dataset.year) : new Date().getFullYear();

                

                const grupoSelect = document.getElementById('rechazosGrupoFilter');

                const selectedGrupo = grupoSelect ? grupoSelect.value : 'all';

                

                // Note: the occurrence panel calculates using the whole dataset for that year, filtered by group

                const dataYear = window.dataRechazos.filter(d => d.year === currentYear);

                const currentUniverso = selectedGrupo === 'all' ? dataYear : dataYear.filter(d => d.grupo === selectedGrupo);

                

                renderRechazosDetalleEstablecimientos(currentYear, selectedGrupo, currentUniverso);

            }

        });

    }



    



    // Intercept switchYear to trigger renderRechazos



    if (typeof window.switchYear === 'function') {



        const originalSwitchYear = window.switchYear;



        window.switchYear = function(year) {



            originalSwitchYear(year);



            setTimeout(renderRechazos, 50);



        };



    } else {



        // Fallback for year buttons if switchYear is not accessible



        document.getElementById('btnYear2025')?.addEventListener('click', () => setTimeout(renderRechazos, 50));



        document.getElementById('btnYear2026')?.addEventListener('click', () => setTimeout(renderRechazos, 50));



    }







    // Initial render



    setTimeout(renderRechazos, 500); // slight delay to ensure other scripts loaded



});







let rechazosGruposChartInstance = null;



let rechazosHistoricoChartInstance = null;

window.selectedRechazosDetalleComuna = null;







function renderRechazos() {



    if (!window.dataRechazos) return;







    // 1. Get current filters



    const yearBtn2026 = document.getElementById('btnYear2026');



    const currentYear = yearBtn2026 && yearBtn2026.classList.contains('active') ? 2026 : 2025;



    const selectedComuna = document.getElementById('globalComunaFilter')?.value || 'all';



    const selectedGrupo = document.getElementById('rechazosGrupoFilter')?.value || 'all';







    // Update territory tag



    const tag = document.getElementById('rechazos-territory-tag');



    if (tag) tag.innerHTML = `&#128205; PROVINCIAL | BASE RESIDENCIA ${currentYear}`;







    // 2. Filter data for current year



    const dataCurrentYear = window.dataRechazos.filter(d => d.year === currentYear);



    const dataPrevYear = window.dataRechazos.filter(d => d.year === (currentYear - 1));







    // UNIVERSO A: Total provincial (sin filtro de grupo)



    const filterUniversoA = d => {



        if (selectedComuna !== 'all' && d.comuna !== selectedComuna.toUpperCase()) return false;



        return true;



    };



    const currentUniversoA = dataCurrentYear.filter(filterUniversoA);



    const totalProvincial = currentUniversoA.reduce((sum, d) => sum + d.count, 0);







    // UNIVERSO B: Subtotal filtrado



    const filterUniversoB = d => {



        if (!filterUniversoA(d)) return false;



        if (selectedGrupo !== 'all' && d.grupo !== selectedGrupo) return false;



        return true;



    };



    const currentUniversoB = dataCurrentYear.filter(filterUniversoB);



    const prevUniversoB = dataPrevYear.filter(filterUniversoB);



    



    // We will use Universo B for total counts in the cards, but contextualize with Universo A



    const totalCurrent = currentUniversoB.reduce((sum, d) => sum + d.count, 0);



    const totalPrev = prevUniversoB.reduce((sum, d) => sum + d.count, 0);







    // Update titles for Context and Distribución



    const rankTitle = document.getElementById('rechazos-ranking-title');



    const distTitle = document.getElementById('rechazos-distribucion-title');



    const distSub = document.getElementById('rechazos-distribucion-subtitle');



    const tablaSuffix = document.getElementById('rechazos-tabla-title-suffix');



    const card1Title = document.getElementById('rechazos-card1-title');



    



    if (selectedGrupo === 'all') {



        if (rankTitle) rankTitle.textContent = "Grupos con más rechazos";



        if (distTitle) distTitle.textContent = "Distribución por grupo objetivo";



        if (distSub) distSub.style.display = "none";



        if (tablaSuffix) tablaSuffix.textContent = "";



        if (card1Title) card1Title.textContent = "TOTAL PERSONAS CON RECHAZO";



    } else {



        if (rankTitle) rankTitle.textContent = "Contexto provincial | Ranking general de rechazos";



        if (distTitle) distTitle.textContent = "Posición del grupo seleccionado en el contexto provincial";



        if (distSub) distSub.style.display = "block";



        if (tablaSuffix) tablaSuffix.textContent = `| Grupo: ${selectedGrupo}`;



        if (card1Title) card1Title.textContent = "PERSONAS CON RECHAZO Â· GRUPO SELECCIONADO";



    }







    // 3. Calculate Cards Logic



    



    // Card 1



    const totalEl = document.getElementById('rechazos-total');



    if (totalEl) totalEl.textContent = totalCurrent.toLocaleString('es-CL');







    // Card 2 (Peso / Grupo)



    const card2Title = document.getElementById('rechazos-card2-title');



    const topGEl = document.getElementById('rechazos-top-grupo');



    const topGStatsEl = document.getElementById('rechazos-top-grupo-stats');



    



    if (selectedGrupo === 'all') {



        if (card2Title) card2Title.textContent = "Grupo con más rechazos";



        const gruposAgg = {};



        currentUniversoA.forEach(d => { gruposAgg[d.grupo] = (gruposAgg[d.grupo] || 0) + d.count; });



        const sortedGrupos = Object.entries(gruposAgg).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));



        



        if (topGEl && topGStatsEl) {



            if (sortedGrupos.length > 0) {



                const [topG, topGCount] = sortedGrupos[0];



                topGEl.textContent = topG;



                const pctG = totalProvincial > 0 ? ((topGCount / totalProvincial) * 100).toFixed(1) : 0;



                topGStatsEl.textContent = `${topGCount.toLocaleString('es-CL')} personas (${pctG.replace('.', ',')}%)`;



            } else {



                topGEl.textContent = "Sin datos";



                topGStatsEl.textContent = "";



            }



        }



    } else {



        if (card2Title) card2Title.textContent = "Peso en los rechazos provinciales";



        if (topGEl && topGStatsEl) {



            const pct = totalProvincial > 0 ? ((totalCurrent / totalProvincial) * 100).toFixed(1) : 0;



            topGEl.textContent = `${pct.replace('.', ',')}%`;



            topGStatsEl.textContent = `${totalCurrent.toLocaleString('es-CL')} del grupo de ${totalProvincial.toLocaleString('es-CL')} total provincial`;



        }



    }







    // Card 3 (Comuna)



    const comunasAggCard = {};



    currentUniversoB.forEach(d => { comunasAggCard[d.comuna] = (comunasAggCard[d.comuna] || 0) + d.count; });



    const sortedComunasCard = Object.entries(comunasAggCard).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));







    const topCEl = document.getElementById('rechazos-top-comuna');



    const topCStatsEl = document.getElementById('rechazos-top-comuna-stats');



    if (topCEl && topCStatsEl) {



        if (sortedComunasCard.length > 0) {



            const [topC, topCCount] = sortedComunasCard[0];



            topCEl.textContent = topC;



            const pctC = totalCurrent > 0 ? ((topCCount / totalCurrent) * 100).toFixed(1) : 0;



            const extraText = selectedGrupo !== 'all' ? " del grupo seleccionado" : "";



            topCStatsEl.textContent = `${topCCount.toLocaleString('es-CL')} personas (${pctC.replace('.', ',')}%${extraText})`;



        } else {



            topCEl.textContent = "Sin datos";



            topCStatsEl.textContent = "";



        }



    }







    // Card 4 (Variación)



    const varEl = document.getElementById('rechazos-variacion');



    const varAbsEl = document.getElementById('rechazos-variacion-abs');



    if (varEl && varAbsEl) {



        if (totalPrev === 0) {



            if (totalCurrent > 0) {



                varEl.textContent = "Nuevo / sin base";



                varEl.style.fontSize = "1rem";



                varEl.style.color = "#64748b";



                varAbsEl.textContent = `+${totalCurrent.toLocaleString('es-CL')} personas`;



            } else {



                varEl.textContent = "Sin datos";



                varEl.style.fontSize = "1rem";



                varEl.style.color = "#64748b";



                varAbsEl.textContent = "";



            }



        } else {



            const pct = ((totalCurrent - totalPrev) / totalPrev) * 100;



            const abs = totalCurrent - totalPrev;



            const sign = pct > 0 ? "+" : "";



            varEl.textContent = `${sign}${pct.toFixed(1).replace('.', ',')}%`;



            varEl.style.fontSize = "1.25rem";



            varEl.style.color = pct > 0 ? "#dc2626" : (pct < 0 ? "#16a34a" : "#1e293b");



            varAbsEl.textContent = `${sign}${abs.toLocaleString('es-CL')} respecto a ${currentYear - 1}`;



        }



    }







    // 4. Ranking 3 Grupos (Always Universo A)



    const gruposAggAll = {};



    currentUniversoA.forEach(d => { gruposAggAll[d.grupo] = (gruposAggAll[d.grupo] || 0) + d.count; });



    const sortedGruposAll = Object.entries(gruposAggAll).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));



    



    const rankingContainer = document.getElementById('rechazos-ranking-container');



    if (rankingContainer) {



        rankingContainer.innerHTML = "";



        



        let foundInTop3 = false;



        



        sortedGruposAll.slice(0, 3).forEach((g, index) => {



            const isSelected = (selectedGrupo !== 'all' && selectedGrupo === g[0]);



            if (isSelected) foundInTop3 = true;



            



            const pct = totalProvincial > 0 ? ((g[1] / totalProvincial) * 100).toFixed(1) : 0;



            const posColor = index === 0 ? '#f59e0b' : (index === 1 ? '#94a3b8' : '#b45309');



            const bgClass = isSelected ? 'background: rgba(79, 70, 229, 0.1); border-color: #4f46e5;' : 'background: white; border-color: #e2e8f0;';



            rankingContainer.innerHTML += `



                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border-radius: 6px; border: 1px solid transparent; box-shadow: 0 1px 2px rgba(0,0,0,0.02); ${bgClass}">



                    <div style="display: flex; align-items: center; gap: 10px; width: 70%;">



                        <div style="background: ${posColor}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0;">



                            ${index + 1}



                        </div>



                        <div style="font-size: 0.85rem; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${g[0]}">



                            ${g[0]}



                        </div>



                    </div>



                    <div style="text-align: right; width: 30%;">



                        <div style="font-weight: 700; color: #0f69b4; font-size: 0.95rem;">${g[1].toLocaleString('es-CL')}</div>



                        <div style="font-size: 0.7rem; color: #64748b;">${pct.replace('.', ',')}%</div>



                    </div>



                </div>



            `;



        });



        



        if (selectedGrupo !== 'all' && !foundInTop3) {



            // Find its rank



            const rankIndex = sortedGruposAll.findIndex(g => g[0] === selectedGrupo);



            if (rankIndex !== -1) {



                const g = sortedGruposAll[rankIndex];



                const pct = totalProvincial > 0 ? ((g[1] / totalProvincial) * 100).toFixed(1) : 0;



                rankingContainer.innerHTML += `



                    <div style="margin-top: 10px; margin-bottom: 5px; font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase;">Grupo activo</div>



                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border-radius: 6px; border: 1px solid #4f46e5; background: rgba(79, 70, 229, 0.1); box-shadow: 0 1px 2px rgba(0,0,0,0.02);">



                        <div style="display: flex; align-items: center; gap: 10px; width: 70%;">



                            <div style="background: #4f46e5; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0;">



                                ${rankIndex + 1}



                            </div>



                            <div style="font-size: 0.85rem; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${g[0]}">



                                ${g[0]}



                            </div>



                        </div>



                        <div style="text-align: right; width: 30%;">



                            <div style="font-weight: 700; color: #0f69b4; font-size: 0.95rem;">${g[1].toLocaleString('es-CL')}</div>



                            <div style="font-size: 0.7rem; color: #64748b;">${pct.replace('.', ',')}%</div>



                        </div>



                    </div>



                `;



            }



        }



        



        if (sortedGruposAll.length === 0) {



            rankingContainer.innerHTML = `<div style="padding: 1rem; text-align: center; color: #64748b; font-size: 0.85rem;">No se registran personas con rechazo para la selección actual.</div>`;



        }



    }







    // 5. Chart Distribución Grupos (Always Universo A)



    const ctxGruposEl = document.getElementById('rechazosGruposChart');



    if (ctxGruposEl) {



        const ctxGrupos = ctxGruposEl.getContext('2d');



        if (rechazosGruposChartInstance) rechazosGruposChartInstance.destroy();



        



        const chartGruposData = sortedGruposAll.slice(0, 10);



        



        // Colores: resaltar si esta seleccionado



        const bgColors = chartGruposData.map(d => {



            if (selectedGrupo === 'all') return 'rgba(79, 70, 229, 0.7)';



            return d[0] === selectedGrupo ? 'rgba(79, 70, 229, 1)' : 'rgba(148, 163, 184, 0.3)';



        });



        const borderColors = chartGruposData.map(d => {



            if (selectedGrupo === 'all') return 'rgba(79, 70, 229, 1)';



            return d[0] === selectedGrupo ? 'rgba(79, 70, 229, 1)' : 'rgba(148, 163, 184, 0.5)';



        });







        rechazosGruposChartInstance = new Chart(ctxGrupos, {



            type: 'bar',



            data: {



                labels: chartGruposData.map(d => d[0]),



                datasets: [{



                    label: 'Personas con rechazo',



                    data: chartGruposData.map(d => d[1]),



                    backgroundColor: bgColors,



                    borderColor: borderColors,



                    borderWidth: 1,



                    borderRadius: 4



                }]



            },



            options: {



                indexAxis: 'y',



                responsive: true,



                maintainAspectRatio: false,



                plugins: {



                    legend: { display: false },



                    datalabels: {



                        anchor: 'end',



                        align: 'end',



                        color: '#1e293b',



                        font: { weight: '600', size: 13 },



                        formatter: function(value) {



                            return value.toLocaleString('es-CL');



                        }



                    },



                    tooltip: {



                        intersect: true,



                        mode: 'nearest',



                        callbacks: {



                            title: function() { return null; },



                            beforeLabel: function(context) {



                                return context.label;



                            },



                            label: function(context) {



                                const val = context.raw;



                                const indexPos = sortedGruposAll.findIndex(g => g[0] === context.label);



                                const rank = indexPos !== -1 ? (indexPos + 1) + "Â°" : "-";



                                const pct = totalProvincial > 0 ? ((val / totalProvincial) * 100).toFixed(1) : 0;



                                return [



                                    `${val.toLocaleString('es-CL')} personas con rechazo`,



                                    `${pct.replace('.', ',')}% del total provincial`,



                                    `Posición provincial: ${rank}`



                                ];



                            }



                        }



                    }



                },



                scales: {



                    x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },



                    y: { 



                        grid: { display: false },



                        ticks: {



                            font: { size: 12, weight: '500' }, color: '#1e293b',



                            font: { size: 12, weight: '500' }, color: '#1e293b',
                            callback: function(value) {



                                let label = this.getLabelForValue(value);



                                return label.length > 30 ? label.substr(0, 30) + '...' : label;



                            }



                        }



                    }



                }



            }



        });



    }







    // 6. Tabla Análisis Territorial (Always Universo B)



    const tbody = document.getElementById('rechazos-comunas-body');



    if (tbody) {



        tbody.innerHTML = "";



        



        const comunasAggTbl = {};



        currentUniversoB.forEach(d => { comunasAggTbl[d.comuna] = (comunasAggTbl[d.comuna] || 0) + d.count; });



        const prevComunasAggTbl = {};



        prevUniversoB.forEach(d => { prevComunasAggTbl[d.comuna] = (prevComunasAggTbl[d.comuna] || 0) + d.count; });







        const allComunas = new Set([...Object.keys(comunasAggTbl), ...Object.keys(prevComunasAggTbl)]);



        const comunasTableData = Array.from(allComunas).map(c => {



            const curr = comunasAggTbl[c] || 0;



            const prev = prevComunasAggTbl[c] || 0;



            return { comuna: c, curr, prev };



        }).sort((a, b) => b.curr - a.curr || a.comuna.localeCompare(b.comuna));







        comunasTableData.forEach(row => {



            const pct = totalCurrent > 0 ? ((row.curr / totalCurrent) * 100).toFixed(1) : "0.0";



            let varHtml = "-";



            if (row.prev === 0) {



                if (row.curr > 0) varHtml = `<span style="color: #64748b; font-size: 0.75rem;">Nuevo (+${row.curr})</span>`;



            } else {



                const varPct = ((row.curr - row.prev) / row.prev) * 100;



                const color = varPct > 0 ? "#dc2626" : (varPct < 0 ? "#16a34a" : "#64748b");



                const sign = varPct > 0 ? "+" : "";



                const absSign = (row.curr - row.prev) > 0 ? "+" : "";



                varHtml = `<span style="color: ${color}; font-weight: 600;" title="${absSign}${(row.curr - row.prev).toLocaleString('es-CL')} personas">${sign}${varPct.toFixed(1).replace('.', ',')}%</span>



                           <br><span style="font-size: 0.7rem; color: #94a3b8;">${absSign}${(row.curr - row.prev).toLocaleString('es-CL')}</span>`;



            }



            



            const isSelected = selectedComuna !== 'all' && selectedComuna.toUpperCase() === row.comuna;

            const bgStyle = isSelected ? "background: rgba(79, 70, 229, 0.1);" : "";

            

            tbody.innerHTML += `

                <tr style="${bgStyle}">

                    <td style="padding: 8px; font-weight: ${isSelected ? '700' : '500'}; color: #334155;">${row.comuna}</td>

                    <td style="padding: 8px; text-align: right; font-weight: 600;">${row.curr.toLocaleString('es-CL')}</td>

                    <td style="padding: 8px; text-align: right; color: #64748b;">${pct.replace('.', ',')}%</td>

                    <td style="padding: 8px; text-align: center; line-height: 1.1;">${varHtml}</td>

                </tr>

            `;



        });



        



        if (comunasTableData.length === 0) {



            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 1rem; color: #64748b;">No hay datos para la selección actual.</td></tr>`;



        }



    }







    // 7. Chart Evolución Histórica (Always Universo B)



    const ctxHistEl = document.getElementById('rechazosHistoricoChart');



    if (ctxHistEl) {



        const ctxHist = ctxHistEl.getContext('2d');



        if (rechazosHistoricoChartInstance) rechazosHistoricoChartInstance.destroy();



        



        // Remove 2024 from X axis, handle logic via legend



        const years = [2025, 2026];



        const histData = years.map(y => {



            const dataYear = window.dataRechazos.filter(d => d.year === y);



            if (dataYear.length === 0) return null; // No hay data para el año



            



            return dataYear



                .filter(filterUniversoB)



                .reduce((sum, d) => sum + d.count, 0);



        });







        // Legend



        const leg = document.getElementById('rechazos-hist-leyenda');



        if (leg) {



             leg.textContent = "Nota: 2025 corresponde a año cerrado; 2026 presenta datos parciales hasta la fecha de corte.";



        }



        



        // Inline Plugin for Anti-collision DataLabels



        const customDataLabels = {



            id: 'customDataLabels',



            afterDatasetsDraw(chart, args, options) {



                const { ctx, data, chartArea: { top, bottom, left, right, width, height }, scales: { x, y } } = chart;



                ctx.save();



                ctx.font = 'bold 14px Inter, sans-serif';



                ctx.textAlign = 'center';



                ctx.textBaseline = 'middle';



                



                data.datasets.forEach((dataset, i) => {



                    const meta = chart.getDatasetMeta(i);



                    meta.data.forEach((bar, index) => {



                        const val = dataset.data[index];



                        if (val !== null) {



                            const text = val.toLocaleString('es-CL');



                            let xPos = bar.x;



                            let yPos = bar.y - 18; // Default offset top



                            



                            // Prevent going out of top bounds



                            if (yPos < top + 10) yPos = bar.y + 18;



                            



                            // Draw background pill (halo)



                            const textWidth = ctx.measureText(text).width;



                            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';



                            ctx.beginPath();



                            ctx.roundRect(xPos - (textWidth/2) - 4, yPos - 8, textWidth + 8, 16, 4);



                            ctx.fill();



                            



                            // Draw text



                            ctx.fillStyle = '#0f69b4';



                            ctx.fillText(text, xPos, yPos);



                        }



                    });



                });



                ctx.restore();



            }



        };







        rechazosHistoricoChartInstance = new Chart(ctxHist, {



            type: 'line',



            data: {



                labels: years.map(String),



                datasets: [{



                    label: 'Personas con rechazo',



                    data: histData,



                    borderColor: '#0f69b4',



                    backgroundColor: 'rgba(15, 105, 180, 0.1)',



                    borderWidth: 2,



                    pointBackgroundColor: '#0f69b4',



                    pointRadius: 5,



                    pointHoverRadius: 7,



                    fill: true,



                    tension: 0.1,



                    spanGaps: true



                }]



            },



            plugins: [customDataLabels],



            options: {



                responsive: true,



                maintainAspectRatio: false,



                layout: {



                    padding: { top: 30, right: 55, left: 15 } // Headroom para las etiquetas



                },



                plugins: {



                    legend: { display: false },



                    datalabels: { display: false },



                    tooltip: {



                        callbacks: {



                            label: function(context) {



                                if (context.raw === null) return "N/D (sin base disponible)";



                                return `${context.raw.toLocaleString('es-CL')} personas`;



                            }



                        }



                    }



                },



                scales: {



                    x: { grid: { display: false }, ticks: { font: { size: 12, weight: '500' }, color: '#1e293b' } },



                    y: { 



                        beginAtZero: true, 



                        grid: { color: 'rgba(0,0,0,0.05)' },



                        suggestedMax: Math.max(...histData.filter(d=>d!==null)) * 1.20, // 20% Headroom



                        ticks: {



                            font: { size: 12, weight: '500' }, color: '#1e293b',
                            callback: function(value) {



                                return value.toLocaleString('es-CL');



                            }



                        }



                    }



                }



            }



        });



    }



    window.rechazosInterpretationContext = {

        campaignYear: currentYear,

        territorialBasis: "Base Residencia",

        selectedGroup: selectedGrupo,

        provincialTotal: totalProvincial,

        selectedGroupTotal: totalCurrent,

        selectedGroupWeight: totalProvincial > 0 ? ((totalCurrent / totalProvincial) * 100) : 0,

        selectedGroupRank: selectedGrupo !== 'all' ? sortedGruposAll.findIndex(g => g[0] === selectedGrupo) + 1 : 1,

        topGroup: sortedGruposAll.length > 0 ? sortedGruposAll[0][0] : 'Sin datos',

        topGroupTotal: sortedGruposAll.length > 0 ? sortedGruposAll[0][1] : 0,

        topGroupWeight: sortedGruposAll.length > 0 && totalProvincial > 0 ? ((sortedGruposAll[0][1] / totalProvincial) * 100) : 0,

        topCommune: sortedComunasCard.length > 0 ? sortedComunasCard[0][0] : 'Sin datos',

        topCommuneTotal: sortedComunasCard.length > 0 ? sortedComunasCard[0][1] : 0,

        topCommuneWeight: sortedComunasCard.length > 0 && totalCurrent > 0 ? ((sortedComunasCard[0][1] / totalCurrent) * 100) : 0,

        currentYearValue: totalCurrent,

        previousYearValue: totalPrev,

        absoluteDifference: totalCurrent - totalPrev,

        percentageVariation: totalPrev > 0 ? (((totalCurrent - totalPrev) / totalPrev) * 100) : 0,

        historicalDataAvailable: totalPrev > 0 || totalCurrent > 0

    };



    if (document.getElementById('helpModal') && document.getElementById('helpModal').style.display === 'block') {

        if (typeof window.updateRechazosHelpModalContent === 'function') {

            window.updateRechazosHelpModalContent();

        }

    }



    if (typeof window.renderRechazosDetalleEstablecimientos === 'function') {

        const dataOcurrenciaCurrentYear = (window.dataRechazosOcurrencia || []).filter(d => d.year === currentYear);

        const ocurrenciaUniverso = selectedGrupo === 'all' ? dataOcurrenciaCurrentYear : dataOcurrenciaCurrentYear.filter(d => d.grupo === selectedGrupo);

        window.renderRechazosDetalleEstablecimientos(currentYear, selectedGrupo, ocurrenciaUniverso);

    }

}



window.updateRechazosHelpModalContent = function() {

    const modal = document.getElementById('helpModal');

    if (!modal) return;

    

    const ctx = window.rechazosInterpretationContext;

    if (!ctx) {

        document.getElementById('helpModalTitle').innerText = 'Ayuda Interpretativa Epidemiológica';

        document.getElementById('helpModalBody').innerHTML = `<div style="padding: 1rem; color: #ef4444; font-weight: 600;">No fue posible generar la interpretación con el estado actual de los datos. Intente nuevamente.</div>`;

        return;

    }



    const {

        campaignYear,

        territorialBasis,

        selectedGroup,

        provincialTotal,

        selectedGroupTotal,

        selectedGroupWeight,

        selectedGroupRank,

        topGroup,

        topGroupTotal,

        topGroupWeight,

        topCommune,

        topCommuneTotal,

        topCommuneWeight,

        currentYearValue,

        previousYearValue,

        absoluteDifference,

        percentageVariation,

        historicalDataAvailable

    } = ctx;



    let ctxAnalyzed = `Influenza ${campaignYear} &middot; ${territorialBasis} &middot; ${selectedGroup === 'all' ? 'Todos los grupos objetivo' : selectedGroup}`;

    const posStr = selectedGroupRank > 0 ? selectedGroupRank + '°' : '-';

    

    const topComunaPct = topCommuneWeight.toFixed(1).replace('.', ',');

    const pctProvincial = selectedGroupWeight.toFixed(1).replace('.', ',');

    const topGrupoPct = topGroupWeight.toFixed(1).replace('.', ',');

    

    let difPctStr = Math.abs(percentageVariation).toFixed(1).replace('.', ',');

    let diffAbs = absoluteDifference;

    let totalCurrent = currentYearValue;

    let totalPrev = previousYearValue;

    

    let html = `<div style="color: var(--text-color, #334155); font-size: 0.95rem;">`;

    html += `<div style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; padding: 10px 14px; margin-bottom: 1rem; font-weight: 600; font-size: 0.85rem; color: #475569;">

        Contexto de esta interpretación: <span style="color: #1e293b;">${ctxAnalyzed}</span>

    </div>`;

    

    let bloqueC = ""; let bloqueD = ""; let bloqueE = ""; let bloqueF = ""; let bloqueG = "";

    

    // 1. Eliminar redundancias (Regla 2)

    if (selectedGroup === 'all') {

        bloqueC = `Durante ${campaignYear} se registran <strong>${totalCurrent.toLocaleString('es-CL')} personas</strong> con rechazo a la vacunación contra Influenza en el territorio analizado. El grupo <strong>${topGroup}</strong> concentra ${topGroupTotal.toLocaleString('es-CL')} registros, equivalentes al ${topGrupoPct}% del total provincial, constituyéndose como el principal grupo en términos absolutos.`;

        bloqueD = `Territorialmente, la comuna de <strong>${topCommune}</strong> concentra la mayor cantidad de registros a nivel provincial, con ${topCommuneTotal.toLocaleString('es-CL')} personas, equivalentes al ${topComunaPct}% de los rechazos totales.`;

    } else {

        bloqueC = `Durante la Campaña Influenza ${campaignYear} se registran <strong>${totalCurrent.toLocaleString('es-CL')} personas con rechazo en el grupo &laquo;${selectedGroup}&raquo;</strong>, equivalentes al <strong>${pctProvincial}%</strong> del total provincial de personas con rechazo registrado. Este grupo ocupa actualmente el <strong>${posStr} lugar</strong> del ranking provincial.`;

        bloqueD = `La comuna de <strong>${topCommune}</strong> concentra la mayor cantidad de registros, con ${topCommuneTotal.toLocaleString('es-CL')} personas, equivalentes al <strong>${topComunaPct}%</strong> de los rechazos registrados en este grupo.`;

    }

    

    // 2. Mejorar redacción de diferencias históricas (Regla 1)

    let variacionStr = "";

    if (totalPrev > 0) {

        if (diffAbs > 0) {

            variacionStr = `${Math.abs(diffAbs).toLocaleString('es-CL')} personas adicionales (+${difPctStr}%)`;

        } else if (diffAbs < 0) {

            variacionStr = `${Math.abs(diffAbs).toLocaleString('es-CL')} personas menos (-${difPctStr}%)`;

        } else {

            variacionStr = `sin variación respecto de ${campaignYear - 1}`;

        }

    }

    

    if (totalPrev === 0 && totalCurrent > 0) {

        bloqueE = `En ${campaignYear} se registran ${totalCurrent.toLocaleString('es-CL')} personas. Durante ${campaignYear - 1} no se registraban casos comparables para este filtro, por lo que el cambio se clasifica como <strong>nuevo registro</strong> y no corresponde calcular una variación porcentual.`;

    } else if (totalPrev > 0) {

        let dirStr = diffAbs > 0 ? 'aumentaron' : (diffAbs < 0 ? 'disminuyeron' : 'se mantuvieron estables');

        if (diffAbs === 0) {

            bloqueE = `Respecto de ${campaignYear - 1}, los registros ${dirStr} (ambos períodos con ${totalCurrent.toLocaleString('es-CL')} personas), es decir, <strong>${variacionStr}</strong>.`;

        } else {

            bloqueE = `Respecto de ${campaignYear - 1}, los registros ${dirStr} desde ${totalPrev.toLocaleString('es-CL')} a ${totalCurrent.toLocaleString('es-CL')} personas, representando <strong>${variacionStr}</strong>.`;

        }

        if (totalPrev < 10 && diffAbs !== 0) {

            bloqueE += ` <span style="color: #b45309; font-weight: 500;">El elevado porcentaje de variación está influido por el bajo número absoluto de registros del período anterior.</span>`;

        }

    } else {

        bloqueE = `No hay datos comparables en ${campaignYear - 1} ni ${campaignYear} para el filtro seleccionado.`;

    }

    

    bloqueE += `<div style="margin-top: 8px; font-size: 0.85rem; color: #64748b;"><strong>2024: sin información comparable.</strong> La serie histórica disponible comienza en 2025; por lo tanto, no corresponde calcular una tendencia utilizando 2024.</div>`;

    

    // 3, 4, 5. Conclusión dinámica y categorías internas (Reglas 3, 4, 5 y 6)

    let tendenciaAumento = totalPrev > 0 && diffAbs > 0;

    let tendenciaDisminucion = totalPrev > 0 && diffAbs < 0;

    let tendenciaEstable = (totalPrev > 0 && diffAbs === 0) || (totalPrev === 0 && totalCurrent > 0);

    

    if (selectedGroup === 'all') {

        bloqueF = `A nivel provincial se registran ${totalCurrent.toLocaleString('es-CL')} personas con rechazo. `;

        if (tendenciaAumento) {

             bloqueF += `El aumento interanual observado justifica profundizar el análisis por grupo objetivo y territorio. `;

        } else if (tendenciaDisminucion) {

             bloqueF += `A pesar de la disminución general observada, el volumen absoluto justifica mantener vigilancia activa. `;

        } else {

             bloqueF += `La estabilidad en los registros sugiere continuar el monitoreo rutinario por grupo y territorio. `;

        }

        

        if (topCommuneWeight >= 30) {

             bloqueG = `Territorialmente, ${topCommune} concentra el mayor volumen absoluto de registros, con ${topCommuneTotal.toLocaleString('es-CL')} personas (${topComunaPct}% del total provincial).`;

        } else {

             bloqueG = `Territorialmente, ${topCommune} concentra la mayor cantidad de registros absolutos, con ${topCommuneTotal.toLocaleString('es-CL')} personas (${topComunaPct}% del total provincial), seguida de una distribución heterogénea en el resto de las comunas.`;

        }

    } else {

        let pesoAlto = selectedGroupWeight >= 10;

        let rankStr = (selectedGroupRank === 1 || selectedGroupRank === 3) ? selectedGroupRank + '.er' : selectedGroupRank + '.º';



        bloqueF = `Con ${totalCurrent.toLocaleString('es-CL')} personas con rechazo, el grupo ocupa el ${rankStr} lugar del ranking provincial y concentra el ${pctProvincial}% de los registros. `;

        

        if (pesoAlto) { 

            if (tendenciaAumento) {

                bloqueF += `Dado su elevado peso relativo y el aumento observado respecto del año anterior, constituye un grupo prioritario para profundizar el análisis de los rechazos registrados.`;

            } else if (tendenciaDisminucion) {

                bloqueF += `Aunque presenta una disminución respecto del año anterior, continúa siendo un grupo prioritario para el análisis por su elevado volumen de registros.`;

            } else {

                bloqueF += `Al mantener un elevado volumen de registros de forma estable, continúa siendo un grupo prioritario para el análisis.`;

            }

        } else { 

            if (tendenciaAumento) {

                bloqueF += `Su tendencia al aumento representa una situación a vigilar, evitando sobredimensionarla dado su peso acotado en la provincia.`;

            } else if (tendenciaDisminucion) {

                bloqueF += `Esta combinación de menor peso relativo y tendencia descendente sugiere mantener vigilancia regular.`;

            } else {

                bloqueF += `Su bajo peso y estabilidad sugieren mantener una vigilancia rutinaria sin requerir medidas extraordinarias.`;

            }

        }

        

        if (topCommuneWeight >= 20) {

            bloqueG = `Territorialmente, el mayor volumen absoluto se registra en ${topCommune}, con ${topCommuneTotal.toLocaleString('es-CL')} personas (${topComunaPct}% del grupo).`;

            if (topCommuneWeight >= 40) {

                bloqueG += ` Esta alta concentración indica que es un territorio clave para focalizar la revisión local de los datos.`;

            }

        } else {

            bloqueG = `Territorialmente, la distribución en las comunas es menos concentrada, sin que un territorio supere el 20% de los registros del grupo.`;

        }

    }

    

    html += `

        <h4 style="color: #1e293b; font-size: 1.05rem; margin-top: 0; margin-bottom: 8px;">Análisis Provincial</h4>

        <p style="margin-top: 0; margin-bottom: 12px; line-height: 1.5;">${bloqueC}</p>

        

        <h4 style="color: #1e293b; font-size: 1.05rem; margin-top: 16px; margin-bottom: 8px;">Distribución Territorial</h4>

        <p style="margin-top: 0; margin-bottom: 12px; line-height: 1.5;">${bloqueD}</p>

        

        <h4 style="color: #1e293b; font-size: 1.05rem; margin-top: 16px; margin-bottom: 8px;">Comparación Histórica</h4>

        <p style="margin-top: 0; margin-bottom: 12px; line-height: 1.5;">${bloqueE}</p>

        

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-top: 20px;">

            <h4 style="color: #334155; font-size: 0.95rem; margin-top: 0; margin-bottom: 8px;"><i class="fas fa-stethoscope"></i> Lectura Epidemiológica y Gestión</h4>

            <p style="margin-top: 0; margin-bottom: 8px; font-size: 0.9rem;">${bloqueF}</p>

            <p style="margin-top: 0; margin-bottom: 0; font-size: 0.9rem;">${bloqueG}</p>

        </div>

        

        <div style="margin-top: 20px; border-top: 1px dashed #cbd5e1; padding-top: 12px;">

            <h4 style="color: #64748b; font-size: 0.85rem; margin-top: 0; margin-bottom: 6px; text-transform: uppercase;">Consideraciones Metodológicas</h4>

            <ul style="margin: 0; padding-left: 20px; color: #64748b; font-size: 0.8rem; line-height: 1.4;">

                <li>Unidad de análisis = persona con rechazo registrado (conteo mediante RUT único dentro de la campaña).</li>

                <li>Análisis territorial = comuna de residencia.</li>

                <li>La comparación territorial presentada corresponde a números absolutos de personas con rechazo registrado y no a una tasa poblacional de rechazo; por tanto, un mayor número de registros no implica necesariamente una mayor propensión al rechazo en esa comuna.</li>

                <li>Un aumento o disminución estadística no demuestra causalidad; los datos describen registros y no permiten inferir razones del rechazo, desconfianza ni efectividad de las intervenciones.</li>

            </ul>

        </div>

    `;

    html += `</div>`;

    

    document.getElementById('helpModalTitle').innerText = 'Ayuda Interpretativa Epidemiológica';

    document.getElementById('helpModalBody').innerHTML = html;

};



window.openRechazosHelpModal = function(btnElement) {

    const card = btnElement ? btnElement.closest('section') : null;

    let overlay = document.getElementById('spotlightOverlay');

    if (!overlay) {

        overlay = document.createElement('div');

        overlay.id = 'spotlightOverlay';

        overlay.className = 'spotlight-overlay';

        overlay.onclick = window.closeHelpModal || function() {

            overlay.style.opacity = '0';

            const mdl = document.getElementById('helpModal');

            if(mdl) { mdl.style.opacity = '0'; mdl.style.transform = 'translateY(-20px)'; }

            setTimeout(() => {

                overlay.style.display = 'none';

                if(mdl) mdl.style.display = 'none';

            }, 300);

        };

        document.body.appendChild(overlay);

    }

    overlay.style.display = 'block';

    void overlay.offsetWidth;

    overlay.style.opacity = '1';

    

    if (card) {

        card.classList.add('spotlight-active');

        window.currentSpotlightCard = card;

    }

    

    const modal = document.getElementById('helpModal');

    if(!modal) return;

    

    window.updateRechazosHelpModalContent();

    

    modal.style.display = 'block';

    modal.style.opacity = '0';

    modal.style.transform = 'translateY(-20px)';

    

    setTimeout(() => {

        modal.style.transition = 'all 0.3s ease-out';

        modal.style.opacity = '1';

        modal.style.transform = 'translateY(0)';

        

        if (btnElement) {

            const cardRect = btnElement.getBoundingClientRect();

            const modalRect = modal.getBoundingClientRect();

            const viewportWidth = window.innerWidth;

            const viewportHeight = window.innerHeight;

            

            let modalTop = Math.max(20, cardRect.bottom + 10);

            let modalLeft = cardRect.left;

            

            if (modalLeft + modalRect.width > viewportWidth - 20) {

                modalLeft = viewportWidth - modalRect.width - 20;

            }

            if (modalTop + modalRect.height > viewportHeight - 20) {

                modalTop = viewportHeight - modalRect.height - 20;

            }

            modal.style.top = modalTop + 'px';

            modal.style.left = modalLeft + 'px';

        } else {

            modal.style.top = '100px'; 

            modal.style.left = '50%';

            modal.style.transform = 'translate(-50%, 0)';

        }

    }, 10);

};



window.renderRechazosDetalleEstablecimientos = function(currentYear, selectedGrupo, currentUniverso) {

    const container = document.getElementById('rechazos-detalle-establecimientos');

    const content = document.getElementById('rechazos-est-content');

    const select = document.getElementById('rechazosOcurrenciaSelect');

    if (!container || !content || !select) return;



    // Initialize select options and event listener if not already done

    if (select.options.length <= 1) {

        const uniqueComunas = [...new Set((window.dataRechazosOcurrencia || []).filter(d => d.year === currentYear).map(d => d.comuna_ocurrencia))].sort();

        uniqueComunas.forEach(c => {

            if (c !== 'all') {

                const opt = document.createElement('option');

                opt.value = c;

                opt.textContent = c;

                select.appendChild(opt);

            }

        });

        

        select.addEventListener('change', function() {

            const globalYear = document.getElementById('globalYearFilter') ? parseInt(document.getElementById('globalYearFilter').value) : 2026;

            const globalGrupo = document.getElementById('rechazosGrupoFilter') ? document.getElementById('rechazosGrupoFilter').value : 'all';

            

            const dataOcurrenciaCurrentYear = (window.dataRechazosOcurrencia || []).filter(d => d.year === globalYear);

            const ocurrenciaUniverso = globalGrupo === 'all' ? dataOcurrenciaCurrentYear : dataOcurrenciaCurrentYear.filter(d => d.grupo === globalGrupo);

            

            window.renderRechazosDetalleEstablecimientos(globalYear, globalGrupo, ocurrenciaUniverso);

        });

    }



    const comuna = select.value;

    

    // Filter to the selected comuna de ocurrencia (if not all)

    let dataOcurrencia = currentUniverso;

    if (comuna !== 'all') {

        dataOcurrencia = currentUniverso.filter(d => d.comuna_ocurrencia === comuna);

    }

    

    const totalOcurrencia = dataOcurrencia.reduce((sum, d) => sum + d.count, 0);



    if (totalOcurrencia === 0) {

        content.innerHTML = `<div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem; text-align: center; margin-top: 1rem;">Sin establecimientos con registros disponibles para la selección actual.</div>`;

        return;

    }



    // Group by establecimiento

    const estAgg = {};

    let sinInfoCount = 0;

    dataOcurrencia.forEach(d => {

        if (d.establecimiento === 'SIN INFORMACION' || !d.establecimiento) {

            sinInfoCount += d.count;

        } else {

            estAgg[d.establecimiento] = (estAgg[d.establecimiento] || 0) + d.count;

        }

    });



    const estList = Object.keys(estAgg).map(e => ({ est: e, count: estAgg[e] }))

                          .sort((a, b) => b.count - a.count);



    const top3 = estList.slice(0, 3);

    const top3Count = top3.reduce((sum, d) => sum + d.count, 0);

    const concentration = ((top3Count / totalOcurrencia) * 100).toFixed(1).replace('.', ',');



    const medals = ['🥇', '🥈', '🥉'];

    

    const scopeLabel = comuna === 'all' ? 'Toda la red' : comuna;

    

    let html = `

        <div style="margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 0.5rem;">

            <div style="font-size: 1.1rem; font-weight: 700; color: #1e293b;">${scopeLabel} &middot; ${selectedGrupo === 'all' ? 'Todos los grupos objetivo' : selectedGrupo}</div>

            <div style="font-size: 0.8rem; color: #64748b;">${totalOcurrencia.toLocaleString('es-CL')} personas con rechazo registrado por ocurrencia</div>

        </div>

    `;



    if (top3.length > 0) {

        html += '<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">';

        top3.forEach((d, i) => {

            const pct = ((d.count / totalOcurrencia) * 100).toFixed(1).replace('.', ',');

            html += `

                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f8fafc; border-radius: 6px; border: 1px solid #f1f5f9;">

                    <div style="font-weight: 600; color: #334155; font-size: 0.85rem;">

                        <span style="margin-right: 6px;">${medals[i]}</span> ${d.est}

                    </div>

                    <div style="font-size: 0.8rem; color: #475569; text-align: right;">

                        <span style="font-weight: 700; color: #0f69b4;">${d.count.toLocaleString('es-CL')}</span> personas &middot; ${pct}%

                    </div>

                </div>

            `;

        });

        html += '</div>';



        if (estList.length < 3) {

            html += `<div style="font-size: 0.75rem; color: #64748b; margin-bottom: 1rem; text-align: center;">Se registran rechazos asociados a ${estList.length} establecimiento(s) para esta selección.</div>`;

        } else {

            const scopeText = comuna === 'all' ? 'toda la red' : `la comuna de ${comuna}`;

            html += `<div style="font-size: 0.75rem; color: #64748b; margin-bottom: 1rem; text-align: center;">Los ${top3.length} establecimientos concentran el ${concentration}% de los rechazos registrados por ocurrencia en ${scopeText}.</div>`;

        }

    } else {

        html += `<div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem; text-align: center;">Sin establecimientos identificados para esta selección.</div>`;

    }



    if (sinInfoCount > 0) {

        html += `<div style="font-size: 0.75rem; color: #94a3b8; text-align: center; border-top: 1px dashed #e2e8f0; padding-top: 0.5rem; margin-bottom: 1rem;">Sin establecimiento informado: ${sinInfoCount.toLocaleString('es-CL')} personas</div>`;

    }



    html += `<div style="font-size: 0.7rem; color: #94a3b8; line-height: 1.4; text-align: center; background: rgba(241, 245, 249, 0.5); padding: 0.5rem; border-radius: 4px;">

                La comuna y el establecimiento corresponden al lugar donde fue registrado el rechazo (base de ocurrencia). Este análisis describe volumen de registros y no una tasa poblacional de rechazo.

             </div>`;



    content.innerHTML = html;

};



