// Modal Close Outside Click
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('helpModalOverlay');
    if(modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeHelpModal();
            }
        });
    }
});

/* =========================================================
   MODAL AYUDA INTERPRETATIVA (RICH MODAL DINÁMICO)
========================================================= */

function getHelpContent(chartId, comuna) {
    const isProvincial = !comuna || comuna === 'all';
    const locationStr = isProvincial ? 'Provincial' : comuna;
    const locationPrefix = isProvincial ? 'la provincia' : `la comuna de ${comuna}`;
    const redStr = isProvincial ? 'la red asistencial provincial' : `la red local de ${comuna}`;

    // --- MOTOR ALGORÍTMICO EPIDEMIOLÓGICO ---
    let localAnalysis = '';
    
    // Sólo calcular si las funciones globales están disponibles (app_v9.js)
    if (typeof getResidenciaForComuna === 'function' && typeof getMetasForComuna === 'function' && typeof DATA !== 'undefined') {
        try {
            const resi = getResidenciaForComuna(comuna);
            const metas = getMetasForComuna(comuna);
            
            let totalDosis = 0;
            let totalMeta = 0;
            let worst = { vac: '', pct: Infinity, missing: 0 };
            
            DATA.headers.forEach(vac => {
                const admin = resi[vac] || 0;
                const meta = metas[vac] || 0;
                totalDosis += admin;
                totalMeta += meta;
                
                if (meta > 0) {
                    const ratio = admin / meta;
                    if (ratio < worst.pct) {
                        worst = { vac, pct: ratio, missing: Math.max(0, meta - admin) };
                    }
                }
            });
            
            if (totalMeta > 0) {
                const cob = (totalDosis / totalMeta) * 100;
                // Meta protectora del 90% (Inmunidad de Rebaño)
                const missingDoses = Math.max(0, Math.ceil(totalMeta * 0.90) - totalDosis);
                
                let tacticalText = '';
                if (missingDoses > 0 && worst.vac) {
                    const labelVac = typeof getLabel === 'function' ? getLabel(worst.vac) : worst.vac;
                    tacticalText = `<br><br>📉 <strong>Foco Táctico (Eslabón Débil):</strong> La vacuna que más reduce la inmunidad poblacional promedio en ${locationStr} es <strong>${labelVac}</strong> (con solo un ${(worst.pct * 100).toFixed(1).replace('.', ',')}% de cobertura poblacional). Sugerimos focalizar de manera urgente la búsqueda activa de casos susceptibles para mitigar el riesgo de brotes en este grupo específico.`;
                }
                
                const localTacticalText = (missingDoses > 0) ? `
                <br><br>🎯 <strong>Brecha de Susceptibilidad:</strong> Para lograr la meta epidemiológica del 90% y reducir la tasa de transmisión efectiva, el equipo necesita administrar aproximadamente <strong>${missingDoses.toLocaleString('es-CL')} dosis adicionales</strong> en este territorio territorial.${tacticalText}` : '';
                
                if (cob >= 90) {
                    localAnalysis = `
                        <div style="background: rgba(16, 185, 129, 0.12); border-left: 4px solid #10b981; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
                            <strong style="color: #047857; font-size: 1.1rem;">🟢 Nivel Óptimo: Escudo Inmunológico Consolidado (${cob.toFixed(1).replace('.', ',')}%)</strong>
                            <p style="margin: 8px 0 0 0; color: #064e3b;">¡Excelente trabajo! El territorio ha superado el umbral del 90%, logrando una fuerte inmunidad de rebaño. La estrategia actual ha sido sumamente efectiva, reduciendo drásticamente la probabilidad de circulación comunitaria de enfermedades inmunoprevenibles. Es un gran momento para sistematizar y compartir estas buenas prácticas logísticas con el resto de la red.</p>
                        </div>
                    `;
                } else if (cob >= 70) {
                    localAnalysis = `
                        <div style="background: rgba(245, 158, 11, 0.12); border-left: 4px solid #f59e0b; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
                            <strong style="color: #92400e; font-size: 1.1rem;">🟡 Nivel de Alerta: Avance Inmunológico Parcial (${cob.toFixed(1).replace('.', ',')}%)</strong>
                            <p style="margin: 8px 0 0 0; color: #78350f;">Observamos un progreso constante, pero aún persiste un riesgo epidemiológico latente debido a la acumulación de individuos susceptibles. Es crucial intensificar la comunicación de riesgo, re-evaluar la microprogramación y considerar operativos extramurales focalizados para cortar las cadenas de transmisión tempranamente.${localTacticalText}</p>
                        </div>
                    `;
                } else {
                    localAnalysis = `
                        <div style="background: rgba(239, 68, 68, 0.12); border-left: 4px solid #ef4444; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
                            <strong style="color: #991b1b; font-size: 1.1rem;">🔴 Nivel Crítico: Rezago de Cobertura (${cob.toFixed(1).replace('.', ',')}%)</strong>
                            <p style="margin: 8px 0 0 0; color: #7f1d1d;">Existe una brecha significativa en el escudo protector poblacional. Esta alta densidad de susceptibles incrementa exponencialmente la probabilidad de brotes epidémicos con potencial impacto en la red asistencial. Se recomienda activar de inmediato planes de rescate nominal, operativos en terreno y estrategias de vacunación oportuna.${localTacticalText}</p>
                        </div>
                    `;
                }
            }
        } catch(e) {
            console.error("Error calculando insights epidemiológicos:", e);
        }
    }
    // --- FIN MOTOR ---

    const content = {
        'chartCoberturaVacuna': {
            title: `Cobertura Endémica por Biológico 2025-2026 (${locationStr})`,
            fundamento: `${localAnalysis}
            <p>La cobertura poblacional es la variable paramétrica central para modular la velocidad de propagación (impacto directo sobre <strong>R0</strong>) en ${locationPrefix}. Conservar las tasas por sobre el umbral del 90% blinda a la comunidad mediante la <strong>inmunidad de rebaño</strong>; una caída por debajo de este límite crítico detona la acumulación de huéspedes susceptibles, operando como combustible biológico para la emergencia de brotes epidémicos territoriales durante el bienio 2025-2026.</p>`,
            fuente: '<strong>Modelo Analítico DEIS-MINSAL (Base Residencia):</strong> Vincula las dosis validadas (sin EPRO) a la comuna de residencia del paciente. Otorga una medición fidedigna del Escudo Inmunológico real del territorio, anulando sesgos de flujo migratorio intrarregional.',
            lectura: `
                <div class="help-box color-blue">
                    <h5><i class="fas fa-chart-bar"></i> Nivel de Contención</h5>
                    <p>Cuantifica el blindaje inmunológico de la cohorte objetivo frente a la meta demográfica proyectada para ${locationPrefix} en este ciclo. Es el termómetro clínico del éxito preventivo.</p>
                </div>
                <div class="help-box color-red">
                    <h5><i class="fas fa-exclamation-circle"></i> Focos de Vulnerabilidad</h5>
                    <p>Las métricas rezagadas delatan clústeres de población desprotegida. Constituyen vectores de riesgo prioritario que obligan a redirigir los recursos de Búsqueda Activa de Casos (BAC) de inmediato.</p>
                </div>
            `
        },
        'chartDistribucion': {
            title: `Carga Operativa y Consumo de Arsenal (Top 8 - ${locationStr})`,
            fundamento: `<p>Sustentado en el <strong>Principio de Pareto (80/20)</strong>, este algoritmo visibiliza la concentración del esfuerzo asistencial en ${locationPrefix}. Ante el estrés endémico del periodo 2025-2026, esta inteligencia es vital para gestionar anticipadamente la cadena de suministro, prevenir quiebres de stock en cámaras de frío y calibrar la dotación táctica de TENS/Enfermería frente al agotamiento por sobredemanda.</p>`,
            fuente: '<strong>Enfoque Logístico:</strong> Evalúa la presión productiva bruta (esfuerzo operativo puro) sobre la red, complementando el análisis de impacto poblacional.',
            lectura: `
                <div class="help-box color-blue">
                    <h5><i class="fas fa-chart-pie"></i> Estrés Operativo</h5>
                    <p>Mapea la distribución de la carga horaria y el flujo logístico, prediciendo tempranamente el desgaste del capital humano en ${redStr} para evitar EPRO por fatiga.</p>
                </div>
            `
        },
        'tableMatrizContainer': {
            title: `Matriz de Riesgo Territorial Continua 2026 (${locationStr})`,
            fundamento: `${localAnalysis}
            <p>Ejerce como un <strong>Sistema de Alerta Temprana (Early Warning)</strong>. Al cruzar las cuotas demográficas, esta matriz detecta precozmente anomalías inmunitarias micro-locales en ${locationPrefix}. Esta alta resolución espacial permite orquestar intervenciones quirúrgicas territoriales y neutralizar el riesgo antes de la manifestación de focos infecciosos incontrolables.</p>`,
            fuente: '<strong>Fuente Metodológica:</strong> Base DEIS-MINSAL (Base Residencia).',
            lectura: `
                <div class="help-box color-orange">
                    <h5><i class="fas fa-exclamation-triangle"></i> Cuadrantes de Alerta (Rojo/Naranjo)</h5>
                    <p>Evidencian un colapso en la estrategia preventiva local. Imponen la activación urgente de protocolos de barrido extramural y revisión de nominalización.</p>
                </div>
                <div class="help-box color-green">
                    <h5><i class="fas fa-check-circle"></i> Cuadrantes Estabilizados (Verde/Azul)</h5>
                    <p>Certifican un Escudo Inmunológico robusto contra patógenos circulantes en ese cohorte específico de ${locationPrefix}.</p>
                </div>
            `
        },
        'heatmapContainer': {
            title: `Cartografía de Susceptibilidad: Heterogeneidad Espacial`,
            fundamento: `<p>Aplica analítica avanzada de <strong>Epidemiología Espacial</strong>. A menudo, un promedio provincial exitoso oculta silenciosos micro-territorios desprotegidos. Este mapeo geo-epidemiológico aísla clústeres de alta densidad de susceptibles que poseen el potencial de detonar cadenas de transmisión intra-red${isProvincial ? ' en la provincia' : ` en ${comuna}`} durante el horizonte 2025-2026.</p>`,
            fuente: '<strong>Discretización Visual:</strong> Emplea una rampa térmica estandarizada para diferenciar coberturas seguras de bolsones de riesgo crítico en salud pública.',
            lectura: `
                <div class="help-box color-green">
                    <h5><i class="fas fa-shield-virus"></i> Zonas de Cortafuegos (Verdes)</h5>
                    <p>Barreras de protección consolidadas. En estas geocercas, la propagación de patógenos es matemáticamente inviable debido a la baja tasa de susceptibles.</p>
                </div>
                <div class="help-box color-orange">
                    <h5><i class="fas fa-virus"></i> Zonas Cero Epidémicas (Amarillos/Rojos)</h5>
                    <p>Defensas deprimidas, altamente propensas a importar y multiplicar agentes virales/bacterianos. Foco absoluto de intervenciones móviles preventivas.</p>
                </div>
            `
        },
        'chartRezagadas': {
            title: `Brecha Absoluta de Riesgo: Top 5 Biológicos Críticos (${locationStr})`,
            fundamento: `${localAnalysis}
            <p>Abandona la lectura porcentual para calcular la <strong>Brecha Absoluta de Riesgo (Déficit Poblacional Inmunitario)</strong>. Al cuantificar en número absoluto (N) la masa de individuos desprotegidos, dimensionamos con rigor clínico el volumen real de la amenaza latente. Es la métrica decisiva para proyectar escenarios de estrés asistencial y asignar recursos costo-efectivos en ${redStr} para 2026.</p>`,
            fuente: '<strong>Algoritmo Predictivo:</strong> Diferencial matemático neto entre la cohorte demográfica de meta (2025/2026) y la producción clínica validada (sin EPRO).',
            lectura: `
                <div class="help-box color-red">
                    <h5><i class="fas fa-exclamation-triangle"></i> Magnitud de la Susceptibilidad</h5>
                    <p>La extensión de la barra equivale directamente a la cantidad de personas en riesgo vital inminente. Los biológicos de la cima de este ranking son de rescate táctico mandatario.</p>
                </div>
            `
        },
        'chartTendencia': {
            title: `Cinemática Temporal y Velocidad de Inmunización (${locationStr})`,
            fundamento: `<p>Monitorea longitudinalmente el <strong>momentum logístico</strong> de las inoculaciones en ${locationPrefix}. Permite modelar predictivamente si la cadencia clínica será suficiente para cruzar la meta antes de los peaks endémicos del 2025-2026, detectando fatiga operativa de forma prematura para reaccionar tácticamente.</p>`,
            fuente: '<strong>Enfoque Analítico:</strong> Evalúa la dinámica (flujo neto) de dosis administradas por unidad de tiempo (mes), aislando valles productivos.',
            lectura: `
                <div class="help-box color-dark">
                    <h5><i class="fas fa-level-down-alt"></i> Sesgo de Latencia de Datos</h5>
                    <p>Una caída brusca en el último segmento de la curva frecuentemente delata lentitud en la digitación en plataformas ministeriales (RNI) y no un cese abrupto de la estrategia inmunizadora.</p>
                </div>
                <div class="help-box color-blue">
                    <h5><i class="fas fa-chart-line"></i> Inferencia Asistencial</h5>
                    <p>Si la curva decrece sistémicamente, revela factores macros (ej. crisis climática, movilizaciones). Depresiones asiladas por biológico presagian un quiebre en la cadena local de distribución y stock.</p>
                </div>
            `
        },
        'chartTopEstabs': {
            title: `Ranking de Nodos Estratégicos Asistenciales (${locationStr})`,
            fundamento: `<p>Identifica los <strong>Nodos Críticos (Centinelas)</strong> dentro de la arquitectura de la red primaria y secundaria. Un número selecto de centros procesa la mayor densidad poblacional. Cualquier falla o estrés operativo en estos bastiones de vacunación frente a escenarios pandémicos 2025/2026 causará una onda expansiva de vulnerabilidad sistémica.</p>`,
            fuente: '<strong>Fuente Metodológica (Ocurrencia):</strong> Mapea el esfuerzo crudo y la contribución productiva exacta de cada centro vacunatorio hacia el ecosistema sanitario provincial.',
            lectura: `
                <div class="help-box color-blue">
                    <h5><i class="fas fa-hospital"></i> Carga Dinámica de la Red</h5>
                    <p>Las magnitudes evidencian la tracción logística de cada centro en ${locationPrefix}. Entrega inteligencia para redistribuir horas clínicas y salvaguardar a los equipos contra el burnout laboral.</p>
                </div>
            `
        },
        'tableProdContainer': {
            title: `Matriz de Desempeño y Productividad Clínica (${locationStr})`,
            fundamento: `<p>Configura nuestro <strong>Centro de Comando Logístico</strong>. Documenta con trazabilidad estricta el <em>throughput</em> o caudal productivo de los equipos ejecutores en ${locationPrefix}. Es una herramienta implacable para evaluar el desempeño, optimizar flujos y gestionar la contingencia de la carga asistencial proyectada hacia 2026.</p>`,
            fuente: '<strong>Fuente Metodológica:</strong> Base Ocurrencia (dosis efectivas in situ).',
            lectura: `
                <div class="help-box color-dark">
                    <h5><i class="fas fa-table"></i> Benchmarking de Red</h5>
                    <p>Detecta desviaciones de eficiencia (outliers) en los vacunatorios locales comparados con los estándares basales de ${redStr}, diagnosticando cuellos de botella para su corrección rápida.</p>
                </div>
                <div class="help-box color-dark">
                    <h5><i class="fas fa-columns"></i> Esfuerzo Clínico Consolidado</h5>
                    <p>La sumatoria marginal tangibiliza la colosal barrera de contención construida día a día por los profesionales de salud locales frente a las amenazas infectocontagiosas.</p>
                </div>
            `
        }
    };

    return content[chartId];
}

function openHelpModal(chartId) {
    const backdrop = document.getElementById('helpModalBackdrop');
    const modalWindow = document.getElementById('helpModalWindow');
    if (!backdrop || !modalWindow) return;
    
    // Spotlight Effect: Resaltar la tarjeta activa
    // Primero, limpiar cualquier resaltado previo por precaución
    document.querySelectorAll('.highlighted-element').forEach(el => el.classList.remove('highlighted-element'));
    
    const targetElement = document.getElementById(chartId);
    let cardContainer = null;
    
    if (targetElement) {
        // Buscar el contenedor padre con clase 'card' o usar el elemento en sí
        cardContainer = targetElement.closest('.card') || targetElement.parentElement;
        if (cardContainer) {
            cardContainer.classList.add('highlighted-element');
        }
    }
    
    // Lógica de posicionamiento dinámico e inteligente
    // Reseteamos las transformaciones previas
    modalWindow.style.bottom = 'auto';
    
    // Obtener contenido de ayuda antes de calcular posiciones para tener la altura correcta
    const activeComuna = (typeof currentComuna !== 'undefined') ? currentComuna : 'all';
    const contentData = getHelpContent(chartId, activeComuna);
    if (!contentData) return;

    let bodyHtml = '';
    if (contentData.fundamento) {
        bodyHtml += `
            <div class="help-section">
                <h4><i class="fas fa-book-medical"></i> Fundamento Epidemiológico</h4>
                <div class="help-section-content">${contentData.fundamento}</div>
            </div>
        `;
    }
    if (contentData.fuente) {
        bodyHtml += `
            <div class="help-section">
                <h4><i class="fas fa-database"></i> Fuente de Datos y Diferencias</h4>
                <div class="help-section-content">${contentData.fuente}</div>
            </div>
        `;
    }
    if (contentData.lectura) {
        bodyHtml += `
            <div class="help-section" style="background: transparent; border: none; padding: 0;">
                <h4 style="margin-top: 10px;"><i class="fas fa-eye"></i> Lectura Detallada</h4>
                <div class="help-grid">
                    ${contentData.lectura}
                </div>
            </div>
        `;
    }

    // Inyectamos el título y el cuerpo ANTES de posicionar
    document.getElementById('helpModalTitle').innerHTML = '<i class="fas fa-microscope" style="margin-right: 10px;"></i> ' + contentData.title;
    const contextBadge = document.getElementById('helpModalContext');
    if (contextBadge) {
        if (activeComuna === 'all') {
            contextBadge.innerHTML = 'Provincia de Osorno (Todas las comunas)';
        } else {
            contextBadge.innerHTML = `Comuna de ${activeComuna}`;
        }
    }
    document.getElementById('helpModalBody').innerHTML = bodyHtml;

    if (cardContainer) {
        const rect = cardContainer.getBoundingClientRect();
        const spaceLeft = rect.left;
        const spaceRight = window.innerWidth - rect.right;
        
        // Asumimos que el modal mide unos 500px mínimo
        if (spaceLeft > 520 || spaceRight > 520) {
            // Hay espacio a los lados
            if (spaceLeft > spaceRight) {
                // Posicionar a la izquierda del gráfico (espacio de 20px)
                modalWindow.style.right = (window.innerWidth - rect.left + 20) + 'px';
                modalWindow.style.left = 'auto';
            } else {
                // Posicionar a la derecha del gráfico
                modalWindow.style.left = (rect.right + 20) + 'px';
                modalWindow.style.right = 'auto';
            }
        } else {
            // Es un gráfico de ancho completo (ej. Mapa de Calor)
            // Posicionarlo desplazado sobre la tabla
            modalWindow.style.left = Math.max(20, rect.left + 30) + 'px';
            modalWindow.style.right = 'auto';
        }
        
        // Primero mostramos el modal con el contenido ya inyectado para calcular su altura real
        backdrop.style.display = 'block';
        modalWindow.style.display = 'flex';
        
        const modalHeight = modalWindow.offsetHeight;
        
        // Alineación Vertical Inteligente:
        // Intentamos centrar el modal verticalmente respecto al gráfico
        let topPosition = rect.top + (rect.height / 2) - (modalHeight / 2);
        
        // Evitamos que se salga por arriba de la pantalla (margen de 20px)
        if (topPosition < 20) topPosition = 20;
        
        // Evitamos que se salga por abajo de la pantalla
        if (topPosition + modalHeight > window.innerHeight - 20) {
            topPosition = window.innerHeight - modalHeight - 20;
        }
        
        modalWindow.style.top = topPosition + 'px';
    } else {
        // Fallback
        backdrop.style.display = 'block';
        modalWindow.style.display = 'flex';
        modalWindow.style.top = '10vh';
        modalWindow.style.left = 'auto';
        modalWindow.style.right = '20px';
    }
    
    // La inyección de HTML ya se realizó arriba

    
    backdrop.style.display = 'block';
    modalWindow.style.display = 'flex';
    
    // Inicializar drag si no está inicializado
    const header = document.getElementById('helpModalHeader');
    if (header && !modalWindow.dataset.dragInit) {
        makeDraggable(modalWindow, header);
        modalWindow.dataset.dragInit = 'true';
    }
}

function closeHelpModal() {
    const backdrop = document.getElementById('helpModalBackdrop');
    const modalWindow = document.getElementById('helpModalWindow');
    if (backdrop) backdrop.style.display = 'none';
    if (modalWindow) modalWindow.style.display = 'none';
    
    // Quitar el spotlight
    document.querySelectorAll('.highlighted-element').forEach(el => el.classList.remove('highlighted-element'));
}

// Lógica para hacer el modal arrastrable
function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.style.cursor = 'move';
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        // Evitar que el drag ocurra si se clickea un botón dentro del header (como cerrar)
        if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) {
            return;
        }
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        // Quitar right/left automáticos para que top/left controlen el movimiento libremente
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}
