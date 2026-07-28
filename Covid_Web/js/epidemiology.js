/* ══════════════════════════════════════════════════════════════════════════════
   Dashboard COVID-19 · Epidemiology Module v2 (27-Jul-2026)
   Ayudas interpretativas con análisis dinámico por provincia/comuna
   ══════════════════════════════════════════════════════════════════════════════ */

import { getData, getCurrentYear, getResidenciaTotals, getOcurrenciaData, getResidenciaData, fmt } from './data.js';

// ── Textos de Ayuda Epidemiológica ───────────────────────────────────────────
export function getCovidHelpTexts(year, filter = 'all') {
    const DATA = getData();
    const currentYear = year || 2026;
    const isAll = (filter === 'all');
    const locName = isAll ? 'la provincia de Osorno' : 'la comuna de ' + filter;
    const locNameAdj = isAll ? 'provincial' : 'comunal';

    const contextBanner = `<div style="background: var(--accent-blue, #0f69b4); color: white; padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-weight: bold; font-size: 0.95rem;">
        <i class="fa-solid fa-location-dot" style="margin-right: 8px;"></i>Vigilancia Epidemiológica Local (${currentYear}): ${isAll ? "Provincia de Osorno" : filter}
    </div>
    <div style="background: rgba(16, 185, 129, 0.1); padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 0.85rem; color: #047857; border: 1px solid rgba(16, 185, 129, 0.3);">
        <i class="fa-solid fa-check-double" style="margin-right: 6px;"></i><strong>Criterio de Calidad DEIS:</strong> Datos depurados: se excluyen Errores Programáticos (EPRO) y registros invalidados. Sólo se contabilizan inmunizaciones biológicamente válidas.
    </div>`;

    // ── Cálculos Dinámicos ────────────────────────────────────────────────────
    let dynamicGrupo = '';
    let dynamicVacunas = '';
    let dynamicEvolucion = '';
    let dynamicTop = '';
    let dynamicCobertura = '';
    let dynamicBrecha = '';

    if (DATA) {
        try {
            // 1. Grupos objetivo (Residencia) ─────────────────────────────────
            const crits = {};
            getResidenciaData(filter).forEach(d => {
                if (!crits[d.criterio]) crits[d.criterio] = 0;
                crits[d.criterio] += d.total;
            });
            const critSorted = Object.entries(crits).sort((a, b) => b[1] - a[1]);
            const totalDosisRe = critSorted.reduce((s, [, v]) => s + v, 0);
            if (critSorted.length > 0) {
                const topGrupo = critSorted[0];
                const bottomGrupo = critSorted[critSorted.length - 1];
                const pctTop = totalDosisRe > 0 ? ((topGrupo[1] / totalDosisRe) * 100).toFixed(1).replace('.', ',') : '0,0';
                const pctBottom = totalDosisRe > 0 ? ((bottomGrupo[1] / totalDosisRe) * 100).toFixed(1).replace('.', ',') : '0,0';
                dynamicGrupo = `<div style="background:rgba(16,185,129,0.08);padding:14px 16px;border-radius:8px;border:1px solid rgba(16,185,129,0.2);margin-top:16px;">
                    <strong style="color:#047857;"><i class="fa-solid fa-microchip" style="margin-right:6px;"></i>Inteligencia Epidemiológica Dirigida: ${locName}</strong>
                    <p style="margin:8px 0 0 0;">La vigilancia activa indica que el grupo <strong>"${topGrupo[0]}"</strong> concentra la mayor cobertura con <strong>${fmt(topGrupo[1])} dosis (${pctTop}%)</strong> de las inoculaciones válidas ${locNameAdj}es. En contraste, el grupo <strong>"${bottomGrupo[0]}"</strong> presenta cobertura marginal (<strong>${fmt(bottomGrupo[1])} dosis, ${pctBottom}%</strong>). Se requiere focalizar Búsqueda Activa (BAC) y estrategias extramurales en este grupo para el control endémico ${currentYear}.</p>
                </div>`;
            }

            // 2. Distribución vacunas + análisis de plataformas ───────────────
            const resTotals = getResidenciaTotals(filter);
            const vacData = Object.entries(resTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
            if (vacData.length > 0) {
                const totalVac = vacData.reduce((acc, val) => acc + val[1], 0);
                const topVac = vacData[0];
                const pct = ((topVac[1] / totalVac) * 100).toFixed(1).replace('.', ',');
                const hasModerna = resTotals['Moderna LP.8.1'] > 0;
                const hasPfizer = resTotals['Pfizer LP.8.1'] > 0;
                const ambas = hasModerna && hasPfizer;
                const pfPct = totalVac > 0 ? ((resTotals['Pfizer LP.8.1'] / totalVac) * 100).toFixed(1).replace('.', ',') : '0,0';
                const modPct = totalVac > 0 ? ((resTotals['Moderna LP.8.1'] / totalVac) * 100).toFixed(1).replace('.', ',') : '0,0';
                dynamicVacunas = `<div style="background:rgba(16,185,129,0.08);padding:14px 16px;border-radius:8px;border:1px solid rgba(16,185,129,0.2);margin-top:16px;">
                    <strong style="color:#047857;"><i class="fa-solid fa-microchip" style="margin-right:6px;"></i>Análisis de Plataformas Biológicas: ${locName}</strong>
                    <p style="margin:8px 0 0 0;">El esquema predominante corresponde a la plataforma <strong>${topVac[0]}</strong>, con el <strong>${pct}%</strong> de las inoculaciones válidas.${ambas ? ` La distribución dual (Moderna LP.8.1: <strong>${modPct}%</strong> | Pfizer LP.8.1: <strong>${pfPct}%</strong>) refleja la política de disponibilidad de stock en la red local. Ambas plataformas XBB/LP.8.1 ofrecen cobertura cruzada frente a variantes JN.1 y sus derivados circulantes en ${currentYear}.` : ` Garantizar stock en cadena de frío para mantener la continuidad de la plataforma activa frente a variantes dominantes ${currentYear}.`}</p>
                </div>`;
            }

            // 3. Evolución mensual + peak ──────────────────────────────────────
            const monthlyTotals = Array(12).fill(0);
            getResidenciaData(filter).forEach(item => {
                if (item.datos_mes) {
                    Object.values(item.datos_mes).forEach(vacMonths => {
                        Object.entries(vacMonths).forEach(([m, count]) => {
                            const mIdx = parseInt(m) - 1;
                            if (mIdx >= 0 && mIdx < 12) monthlyTotals[mIdx] += count;
                        });
                    });
                }
            });
            const totalMeses = monthlyTotals.reduce((s, v) => s + v, 0);
            const maxV = Math.max(...monthlyTotals);
            const maxMonthIdx = monthlyTotals.indexOf(maxV);
            const activeMeses = monthlyTotals.filter(v => v > 0).length;
            const promMes = activeMeses > 0 ? Math.round(totalMeses / activeMeses) : 0;
            if (maxMonthIdx >= 0 && maxV > 0) {
                const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const tendencia = monthlyTotals[maxMonthIdx] > promMes * 1.5 ? 'concentración campañística marcada' : 'distribución relativamente homogénea a lo largo de la campaña';
                dynamicEvolucion = `<div style="background:rgba(16,185,129,0.08);padding:14px 16px;border-radius:8px;border:1px solid rgba(16,185,129,0.2);margin-top:16px;">
                    <strong style="color:#047857;"><i class="fa-solid fa-microchip" style="margin-right:6px;"></i>Análisis de Curva Epidémica: ${locName}</strong>
                    <p style="margin:8px 0 0 0;">El clímax de la curva de inoculación se registra en <strong>${meses[maxMonthIdx]}</strong> con <strong>${fmt(maxV)} dosis</strong> (promedio mensual: ${fmt(promMes)} dosis). El patrón temporal evidencia una <em>${tendencia}</em>. ${maxMonthIdx < 6 ? 'Un peak temprano sugiere alta respuesta al llamado inicial de campaña — riesgo: meseta prematura en grupos rezagados.' : 'Un peak tardío podría indicar necesidad de reforzar la comunicación en etapas iniciales de próximas campañas.'} En este contexto, la estrategia extramural (operativos móviles en ELEAM y domicilios) es crítica para sostener la cadencia de inmunización.</p>
                </div>`;
            }

            // 4. Top establecimientos ──────────────────────────────────────────
            const estabTotals = {};
            getOcurrenciaData(filter).forEach(item => {
                if (!estabTotals[item.establecimiento]) estabTotals[item.establecimiento] = 0;
                estabTotals[item.establecimiento] += item.total;
            });
            const estabSorted = Object.entries(estabTotals).sort((a, b) => b[1] - a[1]);
            if (estabSorted.length > 0) {
                const top3 = estabSorted.slice(0, 3);
                const totalOc = estabSorted.reduce((s, [, v]) => s + v, 0);
                const pctTop1 = totalOc > 0 ? ((top3[0][1] / totalOc) * 100).toFixed(1).replace('.', ',') : '0';
                dynamicTop = `<div style="background:rgba(16,185,129,0.08);padding:14px 16px;border-radius:8px;border:1px solid rgba(16,185,129,0.2);margin-top:16px;">
                    <strong style="color:#047857;"><i class="fa-solid fa-microchip" style="margin-right:6px;"></i>Nodos de Alta Producción: ${locName}</strong>
                    <p style="margin:8px 0 0 0;">El nodo primario estratégico <strong>${top3[0][0]}</strong> lidera con <strong>${fmt(top3[0][1])} dosis (${pctTop1}%)</strong> de la producción ${locNameAdj}.${top3.length > 1 ? ` Le siguen ${top3.slice(1).map(([n, v]) => `<strong>${n.length > 30 ? n.slice(0, 28) + '…' : n}</strong> (${fmt(v)})`).join(' y ')}.` : ''} Una concentración excesiva en un solo nodo incrementa el riesgo de disrupción de la red ante fallos operativos (corte de suministro, ausentismo RRHH). Se recomienda redistribución estratégica de la demanda.</p>
                </div>`;
            }

            // 5. Análisis brecha Ocurrencia vs Residencia ─────────────────────
            const totalOc = getOcurrenciaData(filter).reduce((s, d) => s + d.total, 0);
            const totalRe = getResidenciaData(filter).reduce((s, d) => s + d.total, 0);
            if (totalOc > 0 && totalRe > 0) {
                const brecha = totalOc - totalRe;
                const pctBrecha = Math.abs((brecha / totalRe) * 100).toFixed(1).replace('.', ',');
                const dir = brecha > 0 ? 'positiva' : 'negativa';
                dynamicBrecha = `<div style="background:rgba(245,158,11,0.07);padding:14px 16px;border-radius:8px;border:1px solid rgba(245,158,11,0.2);margin-top:12px;">
                    <strong style="color:#92400e;"><i class="fa-solid fa-arrows-left-right" style="margin-right:6px;"></i>Balance Ocurrencia vs Residencia: ${locName}</strong>
                    <p style="margin:8px 0 0 0;">Dosis por ocurrencia: <strong>${fmt(totalOc)}</strong> | Dosis por residencia: <strong>${fmt(totalRe)}</strong>. Brecha <em>${dir}</em>: <strong>${brecha > 0 ? '+' : ''}${fmt(brecha)} (${pctBrecha}%)</strong>. ${brecha > 0 ? 'El diferencial positivo indica <strong>afluencia extraprovincial</strong> a los establecimientos locales — la red asistencial de Osorno capta vacunados de comunas o servicios de salud vecinos, lo que aumenta su carga real de producción.' : 'El diferencial negativo indica que residentes de la provincia se vacunan fuera del territorio provincial, sugiriendo movilidad intrarregional o acceso preferencial a puntos de vacunación externos.'}</p>
                </div>`;
            }

            // 6. Análisis de cobertura por criterio ───────────────────────────
            if (DATA.metas && DATA.velocidad_promedio) {
                const vel = DATA.velocidad_promedio;
                if (vel > 0) {
                    dynamicCobertura = `<div style="background:rgba(15,105,180,0.06);padding:14px 16px;border-radius:8px;border:1px solid rgba(15,105,180,0.15);margin-top:12px;">
                        <strong style="color:#0f69b4;"><i class="fa-solid fa-gauge-high" style="margin-right:6px;"></i>Velocidad de Campaña: ${locName}</strong>
                        <p style="margin:8px 0 0 0;">La cadencia actual de la campaña es de <strong>${fmt(vel)} dosis/semana</strong> a nivel provincial. ${vel < 50 ? 'Velocidad <span style="color:#dc2626;font-weight:bold;">crítica</span>: se requiere activación urgente de estrategias extramurales para acelerar la cadencia.' : vel < 150 ? 'Velocidad <span style="color:#f59e0b;font-weight:bold;">moderada</span>: hay margen de mejora mediante operativos focalizados en grupos rezagados.' : 'Velocidad <span style="color:#059669;font-weight:bold;">aceptable</span>: mantener ritmo actual con monitoreo semanal.'}</p>
                    </div>`;
                }
            }

        } catch (e) {
            console.error('Error al calcular ayuda dinámica COVID:', e);
        }
    }

    return {
        grupoObjetivo: {
            title: `Estratificación de Cobertura por Grupo Objetivo — ${locName}`,
            body: `${contextBanner}
            <div style="color:var(--text-primary,#334155);font-size:0.92rem;line-height:1.6;text-align:justify;">
                <div style="background:rgba(15,105,180,0.04);padding:14px 16px;border-radius:8px;border:1px solid rgba(15,105,180,0.12);margin-bottom:16px;">
                    <strong style="color:var(--accent-blue,#0f69b4);"><i class="fa-solid fa-microscope" style="margin-right:6px;"></i>Justificación Epidemiológica</strong>
                    <p style="margin:8px 0 0 0;">La priorización de cohortes vulnerables es la piedra angular para minimizar cuadros graves y el colapso de UPC. En la endemia de ${currentYear}, <strong>una cobertura global alta enmascara frecuentemente bolsones de susceptibilidad</strong> en nichos de alto riesgo clínico (mayores de 60 años, inmunocomprometidos, personal ELEAM).</p>
                </div>
                ${dynamicGrupo}
                <div style="margin-top:16px;">
                    <strong><i class="fa-solid fa-eye" style="margin-right:6px;color:var(--accent-blue,#0f69b4);"></i>Decisiones Basadas en Evidencia</strong>
                    <ul style="padding-left:20px;margin:8px 0 0 0;">
                        <li style="margin-bottom:8px;">Este indicador visibiliza el volumen real de dosis administradas tras el filtrado de calidad (sin EPRO), asegurando un panorama clínico fidedigno del estado inmunitario local.</li>
                        <li style="margin-bottom:8px;"><strong>Riesgo Severo:</strong> Una brecha en adultos mayores incrementa exponencialmente el riesgo de morbimortalidad frente a variantes LP.8.1 circulantes en ${currentYear}.</li>
                        <li><strong>Respuesta Inmediata:</strong> Diseñar operativos móviles extramurales enfocados en los grupos subrepresentados en ${locName}.</li>
                    </ul>
                </div>
            </div>`
        },
        distribucionVacunas: {
            title: `Trazabilidad del Arsenal Biológico y Tecnologías LP.8.1 — ${locName}`,
            body: `${contextBanner}
            <div style="color:var(--text-primary,#334155);font-size:0.92rem;line-height:1.6;text-align:justify;">
                <div style="background:rgba(100,116,139,0.04);padding:14px 16px;border-radius:8px;border:1px solid rgba(100,116,139,0.12);margin-bottom:16px;">
                    <strong style="color:#475569;"><i class="fa-solid fa-vials" style="margin-right:6px;"></i>Farmacovigilancia y Logística Sanitaria ${currentYear}</strong>
                    <p style="margin:8px 0 0 0;">Las vacunas COVID-19 activas en ${currentYear} corresponden a plataformas actualizadas (LP.8.1: Moderna/Pfizer), eficaces frente a la variante XBB y sus derivados JN.1. Este desglose certifica las plataformas biológicas efectivamente administradas, excluyendo dosis invalidadas — indicador vital para control de lotes y vigilancia ESAVI.</p>
                </div>
                ${dynamicVacunas}
                <div style="margin-top:16px;">
                    <strong><i class="fa-solid fa-bullseye" style="margin-right:6px;color:var(--accent-blue,#0f69b4);"></i>Aplicación Operativa en Red</strong>
                    <ul style="padding-left:20px;margin:8px 0 0 0;">
                        <li style="margin-bottom:8px;">Monitorizar concordancia entre protocolos MINSAL vigentes y ejecución de la red primaria local.</li>
                        <li>Estimar velocidad de consumo de biológicos para resguardar disponibilidad ininterrumpida en la Cámara de Frío jurisdiccional.</li>
                    </ul>
                </div>
            </div>`
        },
        evolucionMensual: {
            title: `Curva Epidémica de la Campaña de Inmunización (Residencia) — ${locName}`,
            body: `${contextBanner}
            <div style="color:var(--text-primary,#334155);font-size:0.92rem;line-height:1.6;text-align:justify;">
                <div style="background:rgba(245,158,11,0.06);padding:14px 16px;border-radius:8px;border:1px solid rgba(245,158,11,0.15);margin-bottom:16px;">
                    <strong style="color:#92400e;"><i class="fa-solid fa-chart-line" style="margin-right:6px;"></i>Dinámica de Protección Poblacional ${currentYear}</strong>
                    <p style="margin:8px 0 0 0;">El registro temporal de las inoculaciones efectivas documenta cómo la demanda espontánea responde a los lineamientos sanitarios. Una curva ascendente temprana es el pilar preventivo para aplanar futuras olas de contagio por variantes LP.8.1.</p>
                </div>
                ${dynamicEvolucion}
                ${dynamicCobertura}
                <div style="margin-top:16px;">
                    <strong><i class="fa-solid fa-eye" style="margin-right:6px;color:var(--accent-blue,#0f69b4);"></i>Patrones Interpretativos</strong>
                    <ul style="padding-left:20px;margin:8px 0 0 0;">
                        <li style="margin-bottom:8px;"><strong>Fase de Aceleración:</strong> Impulsada por aumento en la percepción de riesgo o inyección de recursos comunicacionales (SEREMI de Salud).</li>
                        <li style="margin-bottom:8px;"><strong>Estabilización de Demanda:</strong> Un plateau precoz exige barridos territoriales de rescate en grupos subrepresentados.</li>
                        <li>La solidez descansa en la exclusión de EPROs, ilustrando estrictamente la inmunidad comprobada en ${locName}.</li>
                    </ul>
                </div>
            </div>`
        },
        topEstablecimientos: {
            title: `Rendimiento Analítico de Nodos Asistenciales (Ocurrencia) — ${locName}`,
            body: `${contextBanner}
            <div style="color:var(--text-primary,#334155);font-size:0.92rem;line-height:1.6;text-align:justify;">
                <div style="background:rgba(16,185,129,0.08);padding:14px 16px;border-radius:8px;border:1px solid rgba(16,185,129,0.2);margin-bottom:16px;">
                    <strong style="color:#047857;"><i class="fa-solid fa-people-carry-box" style="margin-right:6px;"></i>Carga de Enfermedad e Impacto Asistencial</strong>
                    <p style="margin:8px 0 0 0;">Esta visualización mapea el <strong>volumen de producción biomédica real</strong> lograda en la infraestructura física de cada centro de salud, entregando una radiografía operativa fundamental para la toma de decisiones en el escenario endémico ${currentYear}.</p>
                </div>
                ${dynamicTop}
                ${dynamicBrecha}
                <div style="margin-top:16px;">
                    <strong><i class="fa-solid fa-scale-unbalanced" style="margin-right:6px;color:var(--accent-blue,#0f69b4);"></i>Gestión Predictiva del Riesgo</strong>
                    <ul style="padding-left:20px;margin:8px 0 0 0;">
                        <li style="margin-bottom:8px;">Detecta precozmente la sobrecarga que precipita fallos en bioseguridad, ruptura de la red de frío o EPRO por fatiga en nodos de alta presión.</li>
                        <li>Facilita reasignación dinámica de RRHH desde nodos infrautilizados hacia puntos calientes de vacunación.</li>
                    </ul>
                </div>
            </div>`
        },
        tipoCentro: {
            title: `Resolutividad según Complejidad de la Red Asistencial — ${locName}`,
            body: `${contextBanner}
            <div style="color:var(--text-primary,#334155);font-size:0.92rem;line-height:1.6;text-align:justify;">
                <p>La estratificación por nivel de atención (Hospital, CESFAM, CECOSF, Posta Rural) modela la capilaridad de la política COVID-19 dentro de la geografía y el tejido social ${locNameAdj} durante ${currentYear}.</p>
                <div style="margin-top:16px;">
                    <strong><i class="fa-solid fa-lightbulb" style="margin-right:6px;color:#f59e0b;"></i>Integración Territorial RISS</strong>
                    <ul style="padding-left:20px;margin:8px 0 0 0;">
                        <li style="margin-bottom:8px;"><strong>Equidad Sanitaria:</strong> Una sólida participación de la salud rural y periférica (Postas, CECOSF) certifica intervención exitosa frente a determinantes sociales crónicos en poblaciones dispersas de ${locName}.</li>
                        <li><strong>Contención del Riesgo Clínico Crítico:</strong> Las vacunaciones hospitalarias operan como el último cortafuegos antes del alta de pacientes inmunodeprimidos — previniendo reingresos a UPC en la red ${currentYear}.</li>
                    </ul>
                </div>
            </div>`
        }
    };
}

// ── Modal Help ───────────────────────────────────────────────────────────────
export function openHelpModal(chartId, btnElement) {
    const filter = document.getElementById('globalComunaFilter')?.value || 'all';
    const data = getCovidHelpTexts(getCurrentYear(), filter)[chartId];
    if (!data) return;

    const card = btnElement.closest('.chart-card, .card');

    let overlay = document.getElementById('spotlightOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'spotlightOverlay';
        overlay.className = 'spotlight-overlay';
        overlay.onclick = closeHelpModal;
        const container = document.querySelector('.dashboard-container') || document.body;
        container.appendChild(overlay);
    }
    overlay.style.display = 'block';
    void overlay.offsetWidth;
    overlay.style.opacity = '1';

    if (card) {
        card.classList.add('spotlight-active');
        window.currentSpotlightCard = card;

        const modal = document.getElementById('helpModal');
        if (!modal) return;

        document.getElementById('helpModalTitle').innerText = data.title;
        document.getElementById('helpModalBody').innerHTML = data.body;

        modal.style.display = 'block';
        modal.style.opacity = '0';
        modal.style.transform = 'translateY(-20px)';

        setTimeout(() => {
            const cardRect = card.getBoundingClientRect();
            const modalRect = modal.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let modalTop = Math.max(20, cardRect.top);
            let modalLeft = cardRect.right + 20;

            const spaceRight = viewportWidth - cardRect.right;
            const spaceLeft = cardRect.left;

            if (spaceLeft > spaceRight) {
                if (spaceLeft >= modalRect.width + 10) {
                    modalLeft = cardRect.left - modalRect.width - 20;
                } else {
                    modalLeft = Math.max(20, (viewportWidth - modalRect.width) / 2);
                    modalTop = cardRect.top + 60;
                }
            } else {
                if (spaceRight >= modalRect.width + 10) {
                    modalLeft = cardRect.right + 20;
                } else {
                    modalLeft = Math.max(20, (viewportWidth - modalRect.width) / 2);
                    modalTop = cardRect.top + 60;
                }
            }

            if (modalTop + modalRect.height > viewportHeight - 20) {
                modalTop = viewportHeight - modalRect.height - 20;
            }
            if (modalTop < 20) modalTop = 20;

            modal.style.top = modalTop + 'px';
            modal.style.left = modalLeft + 'px';
            modal.style.opacity = '1';
            modal.style.transform = 'translateY(0)';
        }, 10);
    }
}

export function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    const overlay = document.getElementById('spotlightOverlay');

    if (modal) {
        modal.style.opacity = '0';
        modal.style.transform = 'translateY(-20px)';
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }

    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }

    if (window.currentSpotlightCard) {
        window.currentSpotlightCard.classList.remove('spotlight-active');
        window.currentSpotlightCard = null;
    }
}
