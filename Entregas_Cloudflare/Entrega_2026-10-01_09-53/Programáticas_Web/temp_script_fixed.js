
                    // Lógica estática 2026 para el bloque neonatal
                    document.addEventListener('DOMContentLoaded', function() {
                        var d = window.dataNeonatal['2026'];
                        
                        var totalEl = document.getElementById('neo-total-nacidos');
                        if(totalEl) totalEl.innerText = d.total_nacidos.toLocaleString('es-CL');
                        
                        // BCG Calc
                        var bcgBrechaEl = document.getElementById('neo-bcg-brecha');
                        if(bcgBrechaEl) bcgBrechaEl.innerText = d.bcg.pendientes.toLocaleString('es-CL');
                        var bcgPctBrechaEl = document.getElementById('neo-bcg-pct-brecha');
                        var bcgPctBrecha = ((d.bcg.pendientes / d.bcg.elegibles) * 100).toFixed(1).replace('.', ',');
                        if(bcgPctBrechaEl) bcgPctBrechaEl.innerText = bcgPctBrecha + '% del universo elegible';
                        
                        var bcgUniEl = document.getElementById('neo-bcg-uni');
                        if(bcgUniEl) bcgUniEl.innerText = d.bcg.universo.toLocaleString('es-CL');
                        var bcgExcEl = document.getElementById('neo-bcg-exc');
                        if(bcgExcEl) bcgExcEl.innerText = d.bcg.excluidos.toLocaleString('es-CL');
                        var bcgElegibleEl = document.getElementById('neo-bcg-elegible');
                        if(bcgElegibleEl) bcgElegibleEl.innerText = d.bcg.elegibles.toLocaleString('es-CL');
                        var bcgVacEl = document.getElementById('neo-bcg-vac');
                        var bcgVacPct = ((d.bcg.vacunados / d.bcg.elegibles) * 100).toFixed(1).replace('.', ',');
                        if(bcgVacEl) bcgVacEl.innerText = d.bcg.vacunados.toLocaleString('es-CL') + ' (' + bcgVacPct + ' %)';

                        // HEP B Calc
                        var hepbBrechaEl = document.getElementById('neo-hepb-brecha');
                        if(hepbBrechaEl) hepbBrechaEl.innerText = d.hepb.pendientes.toLocaleString('es-CL');
                        var hepbPctBrechaEl = document.getElementById('neo-hepb-pct-brecha');
                        var hepbPctBrecha = ((d.hepb.pendientes / d.hepb.elegibles) * 100).toFixed(1).replace('.', ',');
                        if(hepbPctBrechaEl) hepbPctBrechaEl.innerText = hepbPctBrecha + '% del universo elegible';
                        
                        var hepbUniEl = document.getElementById('neo-hepb-uni');
                        if(hepbUniEl) hepbUniEl.innerText = d.hepb.universo.toLocaleString('es-CL');
                        var hepbExcEl = document.getElementById('neo-hepb-exc');
                        if(hepbExcEl) hepbExcEl.innerText = d.hepb.excluidos.toLocaleString('es-CL');
                        var hepbElegibleEl = document.getElementById('neo-hepb-elegible');
                        if(hepbElegibleEl) hepbElegibleEl.innerText = d.hepb.elegibles.toLocaleString('es-CL');
                        var hepbVacEl = document.getElementById('neo-hepb-vac');
                        var hepbVacPct = ((d.hepb.vacunados / d.hepb.elegibles) * 100).toFixed(1).replace('.', ',');
                        if(hepbVacEl) hepbVacEl.innerText = d.hepb.vacunados.toLocaleString('es-CL') + ' (' + hepbVacPct + ' %)';
                    });

                    // Sticky Nav Observer
                    document.addEventListener('DOMContentLoaded', function() {
                        const sections = document.querySelectorAll('section[id^="bloque-"]');
                        const navLinks = document.querySelectorAll('.internal-nav a');

                        const observerOptions = {
                            root: null,
                            rootMargin: '-20% 0px -60% 0px',
                            threshold: 0
                        };

                        const observer = new IntersectionObserver(entries => {
                            entries.forEach(entry => {
                                if (entry.isIntersecting) {
                                    navLinks.forEach(link => link.classList.remove('active'));
                                    const activeLink = document.querySelector(`.internal-nav a[href="#${entry.target.id}"]`);
                                    if (activeLink) {
                                        activeLink.classList.add('active');
                                    }
                                }
                            });
                        }, observerOptions);

                        sections.forEach(section => {
                            observer.observe(section);
                        });
                    });

                    // Modal Analytics JS
                    let chartNeoEvolucion = null;
                    window.abrirReporteNeonatal = function(vacunaId) {
                        const d = window.dataNeonatal;
                        if (!d) return;
                        
                        const selectedYear = window.neoSelectedYear || '2026';
                        if(!d[selectedYear]) return;
                        
                        const anioData = d[selectedYear];
                        const vacData = anioData[vacunaId];
                        if (!vacData) return;

                        // Títulos
                        const tituloModal = document.getElementById('neoModalTitle');
                        const nombreVacuna = vacunaId === 'bcg' ? 'BCG' : 'Hepatitis B';
                        tituloModal.innerText = `Reporte de Seguimiento – ${nombreVacuna} · Dosis al nacer`;

                        const txtDescargar = document.getElementById('neoModalDownloadTxt');
                        txtDescargar.innerText = `Descargar nómina de ${vacData.pendientes} casos`;
                        
                        const btnDescargar = document.getElementById('neoModalDownloadBtn');
                        const downloadFileName = vacunaId === 'bcg' ? `Rescates_BCG_Pendientes_${selectedYear}.xlsx` : `Rescates_HepB_Pendientes_${selectedYear}.xlsx`;
                        btnDescargar.setAttribute('href', downloadFileName);

                        // Resumen
                        const elegibles = anioData.total_nacidos - (vacData.fallecidos + vacData.rechazados);
                        const porcentajeVac = elegibles > 0 ? ((vacData.vacunados / elegibles) * 100).toFixed(1) : "0.0";
                        const porcentajeSin = elegibles > 0 ? ((vacData.pendientes / elegibles) * 100).toFixed(1) : "0.0";

                        document.getElementById('neoModalKpiNacidos').innerText = anioData.total_nacidos.toLocaleString('es-CL');
                        document.getElementById('neoModalKpiElegibles').innerText = elegibles.toLocaleString('es-CL');
                        document.getElementById('neoModalKpiCon').innerHTML = `${vacData.vacunados.toLocaleString('es-CL')} <span style="font-size:0.9rem; color:#64748b;">– ${porcentajeVac}%</span>`;
                        document.getElementById('neoModalKpiSin').innerHTML = `${vacData.pendientes.toLocaleString('es-CL')} <span style="font-size:0.9rem; color:#64748b;">– ${porcentajeSin}%</span>`;

                        document.getElementById('neoModalResumenTexto').innerText = `De los ${elegibles.toLocaleString('es-CL')} nacidos vivos elegibles para seguimiento, ${vacData.vacunados.toLocaleString('es-CL')} presentan registro de vacunación ${nombreVacuna} (${porcentajeVac.replace('.', ',')} %) y ${vacData.pendientes.toLocaleString('es-CL')} no presentan registro identificado (${porcentajeSin.replace('.', ',')} %) al momento del corte.`;

                        // Flujo
                        document.getElementById('neoModalFlujoNacidos').innerText = `${anioData.total_nacidos.toLocaleString('es-CL')} nacidos vivos`;
                        const excluidos = vacData.fallecidos + vacData.rechazados;
                        document.getElementById('neoModalFlujoExcluidos').innerText = `− ${excluidos} excluidos del seguimiento`;
                        document.getElementById('neoModalFlujoElegibles').innerText = `${elegibles.toLocaleString('es-CL')} universo elegible`;
                        document.getElementById('neoModalFlujoFinal').innerHTML = `<span style="color:#10b981">${vacData.vacunados.toLocaleString('es-CL')} con registro</span> | <span style="color:#f97316">${vacData.pendientes.toLocaleString('es-CL')} sin registro</span>`;

                        const tbodyHosp = document.getElementById('neoModalTbodyHospital');
                        tbodyHosp.innerHTML = '';
                        let totalElegiblesHosp = 0;
                        let totalCountHosp = 0;
                        Object.entries(vacData.hospital_elegibles || {}).sort((a, b) => b[1] - a[1]).forEach(([hosp, elegiblesHosp]) => {
                            const count = vacData.distribucion_hospital[hosp] || 0;
                            totalElegiblesHosp += elegiblesHosp;
                            totalCountHosp += count;
                            const tasa = elegiblesHosp > 0 ? ((count / elegiblesHosp) * 100).toFixed(1) : 0;
                            tbodyHosp.innerHTML += `<tr><td>${hosp}</td><td style="text-align:right;">${elegiblesHosp}</td><td style="text-align:right;">${count}</td><td style="text-align:right;">${tasa.toString().replace('.', ',')} %</td></tr>`;
                        });
                        const totalTasaHosp = totalElegiblesHosp > 0 ? ((totalCountHosp / totalElegiblesHosp) * 100).toFixed(1) : 0;
                        tbodyHosp.innerHTML += `<tr style="font-weight: 700; background-color: #f8fafc;"><td>TOTAL</td><td style="text-align:right;">${totalElegiblesHosp.toLocaleString('es-CL')}</td><td style="text-align:right;">${totalCountHosp.toLocaleString('es-CL')}</td><td style="text-align:right;">${totalTasaHosp.toString().replace('.', ',')} %</td></tr>`;

                        const tbodyCom = document.getElementById('neoModalTbodyComuna');
                        tbodyCom.innerHTML = '';
                        const comunasEntries = Object.entries(vacData.distribucion_comuna || {}).sort((a, b) => b[1] - a[1]);
                        comunasEntries.forEach(([com, count], index) => {
                            const pct = ((count / vacData.pendientes) * 100).toFixed(1);
                            const displayStyle = index >= 5 ? 'display: none;' : '';
                            const trClass = index >= 5 ? 'class="hidden-comuna-row"' : '';
                            tbodyCom.innerHTML += `<tr ${trClass} style="${displayStyle}"><td>${com}</td><td style="text-align:right;">${count}</td><td style="text-align:right;">${pct.replace('.', ',')} %</td></tr>`;
                        });
                        
                        const btnVerTodas = document.getElementById('neoBtnVerTodasComunas');
                        if (btnVerTodas) {
                            if (comunasEntries.length > 5) {
                                btnVerTodas.style.display = 'block';
                                btnVerTodas.innerText = `Ver todas (${comunasEntries.length})`;
                                btnVerTodas.onclick = function() {
                                    document.querySelectorAll('.hidden-comuna-row').forEach(row => row.style.display = 'table-row');
                                    btnVerTodas.style.display = 'none';
                                };
                            } else {
                                btnVerTodas.style.display = 'none';
                            }
                        }
                        
                        

                        // Calidad
                        document.getElementById('neoModalCalidadRechazos').innerText = (vacData.calidad_dato?.rechazos || 0).toLocaleString('es-CL');

                        // Chart
                        const ctx = document.getElementById('chartNeoModalEvolucion').getContext('2d');
                        if(chartNeoEvolucion) chartNeoEvolucion.destroy();

                        const mesesKeysFull = ["01","02","03","04","05","06","07","08","09","10","11","12"];
                        const nombresMesesFull = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                        
                        let lastValidIdx = 0;
                        for (let i = 0; i < 12; i++) {
                            if (((vacData.mes_elegibles || {})[mesesKeysFull[i]] || 0) > 0) {
                                lastValidIdx = i;
                            }
                        }
                        const mesesKeys = mesesKeysFull.slice(0, lastValidIdx + 1);
                        const nombresMeses = nombresMesesFull.slice(0, lastValidIdx + 1);
                        
                        const dataMeses = mesesKeys.map(m => (vacData.evolucion_mensual || {})[m] || 0);
                        const dataMesesEleg = mesesKeys.map(m => (vacData.mes_elegibles || {})[m] || 0);

                        if (selectedYear == "2026") {
                            document.getElementById('neoChartMensualNote').innerText = "Nota: El último mes mostrado corresponde a un período parcial, según la fecha de corte del 11/09/2026.";
                        } else {
                            document.getElementById('neoChartMensualNote').innerText = "";
                        }

                        chartNeoEvolucion = new Chart(ctx, {
                            type: 'bar',
                            data: {
                                labels: nombresMeses,
                                datasets: [{
                                    label: 'Casos sin registro',
                                    data: dataMeses,
                                    backgroundColor: 'rgba(249, 115, 22, 0.7)',
                                    borderColor: 'rgba(249, 115, 22, 1)',
                                    borderWidth: 1,
                                    borderRadius: 4
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { 
                                    legend: { display: false },
                                    tooltip: {
                                        callbacks: {
                                            label: function(context) {
                                                const idx = context.dataIndex;
                                                const casos = context.raw;
                                                const eleg = dataMesesEleg[idx];
                                                const pct = eleg > 0 ? ((casos/eleg)*100).toFixed(1) : 0;
                                                const isCurrentMonth = (idx === lastValidIdx && selectedYear == "2026");
                                                const mesStr = nombresMeses[idx] + " " + selectedYear + (isCurrentMonth ? " — período parcial" : "");
                                                const lines = [
                                                    `${mesStr}`,
                                                    `Casos sin registro: ${casos.toLocaleString('es-CL')}`,
                                                    `Universo elegible del mes: ${eleg.toLocaleString('es-CL')}`,
                                                    `% sin registro: ${pct.replace('.', ',')} %`
                                                ];
                                                if (isCurrentMonth) {
                                                    lines.push("Corte: 11/09/2026");
                                                }
                                                return lines;
                                            }
                                        }
                                    }
                                },
                                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
                            }
                        });

                        document.getElementById('neoModalBackdrop').style.display = 'block';
                        document.getElementById('neoModalWindow').style.display = 'block';
                        document.body.style.overflow = 'hidden';
                    };

                    window.cerrarReporteNeonatal = function() {
                        document.getElementById('neoModalBackdrop').style.display = 'none';
                        document.getElementById('neoModalWindow').style.display = 'none';
                        document.body.style.overflow = 'auto';
                    };
                