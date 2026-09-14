import re

def update_script():
    with open('script.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the start of getHelpTexts
    start_str = "function getHelpTexts(year, filter = 'all') {"
    end_str = "window.openHelpModal = function(chartId, btnElement) {"
    
    start_idx = content.find(start_str)
    end_idx = content.find(end_str)
    
    if start_idx == -1 or end_idx == -1:
        print("Could not find boundaries")
        return

    new_function = """function getHelpTexts(year, filter = 'all') {
    const prevYear = (parseInt(year) - 1).toString();
    const isAll = (filter === 'all');
    const locName = isAll ? 'la provincia de Osorno' : 'la comuna de ' + filter;
    const locNameShort = isAll ? 'provincia' : 'comuna';
    const locNameAdjective = isAll ? 'provincial' : 'comunal';
    const contextBanner = `<div style="background: var(--minsal-blue); color: white; padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-weight: bold; font-size: 0.95rem;">
        <i class="fa-solid fa-location-dot" style="margin-right: 8px;"></i>Contexto de Vigilancia Epidemiológica: ${isAll ? "Provincia de Osorno (Red Asistencial Completa)" : filter + " (Análisis de Riesgo Local)"}
    </div>`;

    const generatePatronesRiesgo = (cg) => {
        let dynamicPatrones = '';
        if (cg.length > 0) {
            dynamicPatrones = cg.map(g => {
                let desc = '';
                let nameLower = g.name.toLowerCase();
                if (nameLower.includes('60 años') || nameLower.includes('mayores')) {
                    desc = `<strong>Alerta Sanitaria Crítica:</strong> Este estrato etario concentra históricamente la mayor tasa de letalidad y morbilidad severa por IRAG. Un déficit en esta cohorte predice un incremento directo en la tasa de hospitalización y requerimiento de ventilación mecánica. Se impera activar protocolos de rescate domiciliario e intervención directa en ELEAM.`;
                } else if (nameLower.includes('cronico') || nameLower.includes('crónico')) {
                    desc = `<strong>Riesgo de Descompensación Sistémica:</strong> La falta de inmunización frente al virus influenza exacerba patologías de base (cardiovasculares, metabólicas, respiratorias), precipitando consultas de urgencia. Se recomienda articulación urgente con programas PSC (Programa de Salud Cardiovascular) y ERA.`;
                } else if (nameLower.includes('salud')) {
                    desc = `<strong>Vulnerabilidad de la Red y Transmisión Nosocomial:</strong> La susceptibilidad del equipo clínico compromete la continuidad operativa de la red asistencial y amplifica el riesgo de brotes intrahospitalarios cruzados. Exige políticas de inmunización in situ de carácter mandatorio.`;
                } else if (nameLower.includes('embarazada')) {
                    desc = `<strong>Riesgo de Morbilidad Materno-Fetal:</strong> Exposición a complicaciones obstétricas severas, partos prematuros y ausencia de transferencia pasiva de anticuerpos al neonato. Se deben movilizar equipos de control prenatal y matronería.`;
                } else if (nameLower.includes('niños') || nameLower.includes('escolares')) {
                    desc = `<strong>Vectores Comunitarios de Alta Transmisibilidad:</strong> Las cohortes pediátricas actúan como amplificadores de la carga viral comunitaria. Su rezago acelera la propagación hacia grupos añosos. Estrategia mandatada: Operativos intraescolares (vacunatorios móviles en establecimientos educacionales).`;
                } else {
                    desc = `<strong>Brecha Epidemiológica Específica:</strong> Este grupo presenta susceptibilidad aumentada. Se instruye evaluación de determinantes sociales que dificulten su acceso a los puntos de vacunación.`;
                }
                return `<li style="margin-bottom: 8px;"><strong>${g.name} en Susceptibilidad Alta (${g.percent.toFixed(1).replace('.',',')}%):</strong> ${desc}</li>`;
            }).join('');
        } else {
            dynamicPatrones = `<li style="margin-bottom: 8px;"><strong>Estabilidad Inmunitaria:</strong> No se detectan cohortes de riesgo en umbral crítico (<70%) a nivel ${locNameAdjective}. Se recomienda mantener vigilancia activa para evitar la erosión de las coberturas y consolidar el escudo epidemiológico.</li>`;
        }

        return `
        <div style="background: rgba(245, 158, 11, 0.06); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.15); margin-bottom: 16px;">
            <strong style="color: #92400e;"><i class="fa-solid fa-magnifying-glass-chart" style="margin-right:6px;"></i>Patrones de Susceptibilidad Poblacional Detectados (${year} - ${locName})</strong>
            <ul style="padding-left: 20px; margin: 8px 0 0 0; font-size: 0.88rem;">
                ${dynamicPatrones}
            </ul>
        </div>`;
    };

    let globalTactical = '';
    let lowestGroup = { name: '', percent: 100 };
    let criticalGroups = [];
    if (isAll && dashboardData && dashboardData.data_residencia) {
        const dosisTotal = dashboardData.data_residencia.reduce((s, i) => s + i.total, 0);
        const metaTotal = getMetaTotal('all');
        const targetDoses = Math.ceil(metaTotal * 0.85);
        const missingDoses = Math.max(0, targetDoses - dosisTotal);
        
        const globalGroups = {};
        dashboardData.data_residencia.forEach(c => {
            for(let g in c.datos) {
                globalGroups[g] = (globalGroups[g] || 0) + (c.datos[g] || 0);
            }
        });
        for (let gName in globalGroups) {
            if (gName.toLowerCase().includes('total')) continue;
            const gDoses = globalGroups[gName];
            const gMeta = getMetaTotal('all', gName);
            if (gMeta > 0) {
                const gCob = (gDoses / gMeta) * 100;
                if (gCob < lowestGroup.percent) {
                    lowestGroup = { name: gName, percent: gCob };
                }
                if (gCob < 70) {
                    criticalGroups.push({ name: gName, percent: gCob });
                }
            }
        }
        
        criticalGroups.sort((a,b) => a.percent - b.percent);
        
        if (missingDoses > 0) {
            let tacticalText = '';
            if (criticalGroups.length > 0) {
                let groupsHtml = criticalGroups.map(g => `<strong>${g.name} (${g.percent.toFixed(1).replace('.', ',')}%)</strong>`).join(', ');
                tacticalText = `<p style="margin: 8px 0 0 0; color: #7f1d1d;">🚨 <strong>Falla en Inmunidad de Subgrupos (< 70%):</strong> Se pesquisan vulnerabilidades inminentes en: <span style="color:#dc2626;">${groupsHtml}</span>. La probabilidad clínica de saturación de la Unidad de Paciente Crítico (UPC) se incrementa de forma exponencial ante el eventual ingreso de estos clústeres no inmunizados.</p>`;
            } else if (lowestGroup.name) {
                tacticalText = `<p style="margin: 8px 0 0 0; color: #7f1d1d;">⚠️ <strong>Foco de Inteligencia Sanitaria:</strong> La cohorte de <strong>${lowestGroup.name} (${lowestGroup.percent.toFixed(1).replace('.', ',')}%)</strong> exhibe el mayor riesgo residual. Se mandata focalizar los esfuerzos de terreno preventivos para mitigar el impacto en morbilidad agregada.</p>`;
            }
            
            globalTactical = `
            <div style="background: rgba(239, 68, 68, 0.08); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 16px;">
                <strong style="color: #991b1b; font-size: 1.05rem;"><i class="fa-solid fa-bullseye" style="margin-right:6px;"></i>Brecha Logística para Seguridad Poblacional</strong>
                <p style="margin: 8px 0 0 0; color: #7f1d1d;">Para concretar la mitigación de riesgo a nivel red provincial (umbral ≥85%), el sistema de salud debe garantizar la administración íntegra de <strong>${missingDoses.toLocaleString('es-CL')} dosis efectivas</strong> en el corto plazo.</p>
                ${tacticalText}
            </div>`;
        }
    }

    if (isAll) {
        return {
        global: {
            title: `Monitoreo Estratégico de Inmunización Poblacional ${year}`,
            body: `<div style="color: var(--text-color, #334155); font-size: 0.92rem; line-height: 1.6; text-align: justify;">
            ${contextBanner}

            <div style="background: rgba(15, 105, 180, 0.04); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(15, 105, 180, 0.12); margin-bottom: 16px;">
                <strong style="color: var(--minsal-blue-dark);"><i class="fa-solid fa-microscope" style="margin-right:6px;"></i>Marco Conceptual de Salud Pública</strong>
                <p style="margin: 8px 0 0 0;">La cobertura vacunal constituye el principal indicador trazador de protección profiláctica específica. Se define por la fracción de la población susceptible inmunizada en relación con los denominadores estandarizados del Programa Nacional de Inmunizaciones (PNI).</p>
                <p style="margin: 8px 0 0 0;">El <strong>umbral de contención del 85%</strong> obedece al principio de <em>inmunidad colectiva</em> (herd immunity): al alcanzar esta cota, las cadenas de transmisión viral se interrumpen sistemáticamente, confiriendo un escudo epidemiológico indirecto a los individuos no aptos para la vacunación o con respuestas inmunes subóptimas.</p>
            </div>

            <div style="background: rgba(100, 116, 139, 0.04); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(100, 116, 139, 0.12); margin-bottom: 16px;">
                <strong style="color: #475569;"><i class="fa-solid fa-database" style="margin-right:6px;"></i>Arquitectura del Indicador</strong>
                <p style="margin: 8px 0 0 0;"><strong>Origen de datos:</strong> Repositorio centralizado DEIS-MINSAL, consolidado por <strong>comuna de residencia habitual</strong> (Base Residencia ${year}).</p>
                <p style="margin: 6px 0 0 0;"><strong>Algoritmo de Cálculo:</strong></p>
                <div style="background: rgba(15, 105, 180, 0.06); padding: 10px 14px; border-radius: 6px; font-family: monospace; font-size: 0.85rem; margin: 6px 0; text-align: center; border: 1px dashed rgba(15, 105, 180, 0.2);">
                    Tasa de Cobertura = (Población Inmunizada Residente / Denominador Objetivo Ajustado) × 100
                </div>
                <p style="margin: 6px 0 0 0; font-size: 0.85rem; color: #64748b;"><em>Nota Analítica: El uso del criterio de residencia anula el sesgo de migración asistencial (personas vacunadas fuera de su jurisdicción), permitiendo estimar el riesgo endémico real del territorio.</em></p>
            </div>

            <div style="margin-bottom: 16px;">
                <strong><i class="fa-solid fa-eye" style="margin-right:6px; color: var(--minsal-blue);"></i>Interpretación del Modelo Proporcional (Gráfico de Dona)</strong>
                <ul style="padding-left: 20px; margin: 8px 0 0 0;">
                    <li style="margin-bottom: 8px;"><strong>🟦 Fracción Azul (Población Protegida):</strong> Refleja la proporción de la cohorte que ha adquirido inmunidad inducida. A mayor volumen, decrece exponencialmente el riesgo de un evento epidémico mayor.</li>
                    <li style="margin-bottom: 8px;"><strong>🟧 Fracción Naranja (Brecha Crítica de Susceptibles):</strong> Representa el remanente de población que debe ser intervenida obligatoriamente para lograr el umbral del 85%. Si este segmento es amplio en fases avanzadas de la curva epidémica, advierte una vulnerabilidad sistémica inminente.</li>
                    <li><strong>⬜ Fracción Gris (Margen Optimizador):</strong> Corresponde a la población objetivo restante entre el 85% y el 100%. Cubrir este margen fortalece la resiliencia comunitaria y compensa posibles fallos de seroconversión en pacientes senescentes.</li>
                </ul>
            </div>

            ${globalTactical}

            <div style="background: rgba(245, 158, 11, 0.06); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.15); margin-bottom: 16px;">
                <strong style="color: #92400e;"><i class="fa-solid fa-magnifying-glass-chart" style="margin-right:6px;"></i>Semiótica Epidemiológica del Riesgo</strong>
                <ul style="padding-left: 20px; margin: 8px 0 0 0; font-size: 0.88rem;">
                    <li style="margin-bottom: 6px;"><strong>Cobertura < 50% post-SE 20:</strong> Riesgo de Falla Programática Severa. La cinética de inoculación es insuficiente frente al inicio de la onda epidémica viral (alta probabilidad de endemia invernal descontrolada).</li>
                    <li style="margin-bottom: 6px;"><strong>Cobertura 50-70%:</strong> Ventana de vulnerabilidad moderada a alta. El pool de susceptibles es capaz de mantener la homeostasis viral en microclústeres. Exige intensificación logística extramural.</li>
                    <li><strong>Cobertura ≥ 85%:</strong> Éxito del escudo comunitario, condicionado a descartar la <em>paradoja de Simpson</em> (promedios altos que diluyen bajas coberturas en focos rurales o etarios de alto impacto).</li>
                </ul>
            </div>

            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #38bdf8; font-size: 0.85rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h4 style="margin-top: 0; color: #7dd3fc; margin-bottom: 8px;"><i class="fa-solid fa-briefcase-medical" style="margin-right:6px;"></i>Implicancias Directivas en Gestión de Salud</h4>
                <p style="margin: 0 0 8px 0;">Este instrumento otorga robustez argumentativa para la toma de decisiones de alto nivel:</p>
                <ul style="padding-left: 18px; margin: 0;">
                    <li style="margin-bottom: 5px;">Cuantificación precisa de requerimientos logísticos y biológicos para el cierre de brechas (déficit nominal).</li>
                    <li style="margin-bottom: 5px;">Apalancamiento de negociaciones ante autoridades de Salud (SEREMI/SS) para la inyección de RRHH extraordinario.</li>
                    <li style="margin-bottom: 5px;">Planificación prospectiva respecto a la capacidad de saturación de la Red de Urgencias (SAPU/SAR/UEH) en el periodo de máxima incidencia viral.</li>
                </ul>
            </div>
        </div>`
        },
        local: {
            title: `Estratificación de Riesgo Territorial — Análisis ${locNameAdjective} ${year}`,
            body: `<div style="color: var(--text-color, #334155); font-size: 0.92rem; line-height: 1.6; text-align: justify;">
            ${contextBanner}

            <div style="background: rgba(15, 105, 180, 0.04); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(15, 105, 180, 0.12); margin-bottom: 16px;">
                <strong style="color: var(--minsal-blue-dark);"><i class="fa-solid fa-microscope" style="margin-right:6px;"></i>Determinantes Geográficos de Inmunidad</strong>
                <p style="margin: 8px 0 0 0;">El análisis epidemiológico desagregado desvela posibles <strong>asimetrías en la penetración territorial del programa</strong>. Observar el promedio provincial per se expone a la <em>falacia ecológica</em>: ignorar focos locales hiper-susceptibles ocultos bajo una estadística macroscópica favorable.</p>
                <p style="margin: 8px 0 0 0;">Este diagrama permite mapear el gradiente de protección. Comunas rezagadas actúan como potenciales <em>zonas cero</em> para el inicio y amplificación de brotes, amenazando con desestabilizar colateralmente los nodos hospitalarios adyacentes.</p>
            </div>

            <div style="margin-bottom: 16px;">
                <strong><i class="fa-solid fa-eye" style="margin-right:6px; color: var(--minsal-blue);"></i>Exégesis del Ordenamiento Comunal</strong>
                <ul style="padding-left: 20px; margin: 8px 0 0 0;">
                    <li style="margin-bottom: 8px;"><strong>📊 Ordenamiento Jerárquico:</strong> Organiza las jurisdicciones sanitarias en función de su éxito operativo, separando comunas eficientes de aquellas con estrés logístico severo.</li>
                    <li style="margin-bottom: 8px;"><strong>🎯 Isolínea de Umbral Clínico (85%):</strong> Delimita el límite probabilístico del control epidémico. Comunas sub-umbral son focos de intervención clínica mandatoria.</li>
                    <li style="margin-bottom: 8px;"><strong>📌 Diferencial (pp):</strong> Refleja la distancia matemática absoluta hacia la meta. Un (-12,2 pp) indica que el territorio adeuda 12,2% de esfuerzo logístico para garantizar protección comunitaria.</li>
                </ul>
            </div>

            <div style="background: rgba(245, 158, 11, 0.06); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.15); margin-bottom: 16px;">
                <strong style="color: #92400e;"><i class="fa-solid fa-magnifying-glass-chart" style="margin-right:6px;"></i>Signos de Alarma Epidemiológica Espacial</strong>
                <ul style="padding-left: 20px; margin: 8px 0 0 0; font-size: 0.88rem;">
                    <li style="margin-bottom: 6px;"><strong>Disparidad Rural/Urbana:</strong> Las caídas de cobertura en entornos rurales sugieren fracaso de la oferta centralizada y urgen la activación de estrategias satelitales (Postas, operativos extramurales).</li>
                    <li style="margin-bottom: 6px;"><strong>Brecha Inter-jurisdiccional > 15 pp:</strong> Indica una fragmentación preocupante en el acceso a la salud. Los territorios rezagados concentrarán la casuística de morbilidad grave, congestionando asimétricamente el sistema prehospitalario.</li>
                    <li style="margin-bottom: 6px;"><strong>Déficit Crónico de Avance:</strong> Comunas que paralizan su incremento semanal (pp congelados) certifican el agotamiento de la captación pasiva.</li>
                </ul>
            </div>

            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444; font-size: 0.85rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h4 style="margin-top: 0; color: #fca5a5; margin-bottom: 8px;"><i class="fa-solid fa-truck-medical" style="margin-right:6px;"></i>Matriz de Respuesta Táctica Local</h4>
                <ul style="padding-left: 18px; margin: 0;">
                    <li style="margin-bottom: 6px;"><strong>Zonas Críticas (< 70%):</strong> Requieren shock logístico. Instruir rastreo domiciliario, involucrar referentes comunitarios, coordinar barridos epidemiológicos con Atención Primaria.</li>
                    <li style="margin-bottom: 6px;"><strong>Zonas en Transición (70-84%):</strong> Reforzamiento focalizado de la comunicación de riesgo y diversificación de puntos de atención (extensión horaria).</li>
                    <li><strong>Zonas Resilientes (≥ 85%):</strong> Fase de consolidación. Monitorear uniformidad intracomunal y preservar stock estratégico.</li>
                </ul>
            </div>
        </div>`
        },
        temporal: {
            title: `Cinética de Inmunización y Ventana de Oportunidad — ${year} vs ${prevYear}`,
            body: `<div style="font-size: 0.92rem; line-height: 1.6; color: var(--text-color, #334155); text-align: justify;">
            ${contextBanner}

            <div style="background: rgba(15, 105, 180, 0.04); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(15, 105, 180, 0.12); margin-bottom: 16px;">
                <strong style="color: var(--minsal-blue-dark);"><i class="fa-solid fa-microscope" style="margin-right:6px;"></i>Ventana Virológica Crítica</strong>
                <p style="margin: 8px 0 0 0;">El éxito de la inmunización profiláctica no depende sólo del volumen final, sino de su <strong>oportunidad de administración</strong>. Es imperativo alcanzar niveles altos de protección *antes* del incremento exponencial de circulación de virus respiratorios invernales (usualmente iniciada hacia las SE 21-25).</p>
                <p style="margin: 8px 0 0 0;">Esta gráfica modela la trayectoria temporal del programa, cruzando el esfuerzo longitudinal (barras de ocurrencia semanal) con el logro neto poblacional (curva acumulativa), permitiendo realizar proyecciones de impacto epidémico temprano.</p>
            </div>

            <div style="background: rgba(100, 116, 139, 0.04); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(100, 116, 139, 0.12); margin-bottom: 16px;">
                <strong style="color: #475569;"><i class="fa-solid fa-database" style="margin-right:6px;"></i>Perspectiva Metodológica</strong>
                <p style="margin: 8px 0 0 0;">Basado en <strong>Base Ocurrencia DEIS</strong>, que computa las dosis el día exacto de su administración, revelando la intensidad del flujo de trabajo real semana a semana.</p>
                <p style="margin: 6px 0 0 0; font-size: 0.85rem; color: #64748b;"><em>Nota: El estándar de visualización por Semanas Epidemiológicas (SE) garantiza una correlación directa con los reportes de vigilancia de circulación viral del ISP, posibilitando al epidemiólogo cruzar curvas de vacunación vs curvas de contagio.</em></p>
            </div>

            <div style="background: rgba(245, 158, 11, 0.06); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.15); margin-bottom: 16px;">
                <strong style="color: #92400e;"><i class="fa-solid fa-magnifying-glass-chart" style="margin-right:6px;"></i>Criterios de Inspección Morfológica de la Curva</strong>
                <ul style="padding-left: 20px; margin: 8px 0 0 0; font-size: 0.88rem;">
                    <li style="margin-bottom: 8px;"><strong>Cinética Gompertz/Logística (S-Shape):</strong> Perfil de eficacia óptima. Expansión rápida inicial y desaceleración asintótica al acercarse a la cota del 85-90%.</li>
                    <li style="margin-bottom: 8px;"><strong>Amesetamiento Precoz:</strong> Si la curva acumulativa pierde gradiente (se achata) bajo el 75% antes de SE 20, testifica el agotamiento absoluto de la accesibilidad pasiva y del interés poblacional espontáneo.</li>
                    <li style="margin-bottom: 8px;"><strong>Desfase de la Línea Base (vs ${prevYear}):</strong> Una curva rezagada consistentemente respecto al ciclo previo advierte posibles variables exógenas perjudiciales (rechazo vacunal, rupturas de cadena de suministros, crisis de RRHH) que requieren auditoría inmediata.</li>
                </ul>
            </div>

            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; font-size: 0.85rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h4 style="margin-top: 0; color: #fcd34d; margin-bottom: 8px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>Proyección Heurística de Manejo</h4>
                <p style="margin: 0 0 8px 0;">Reglas decisionales según umbrales temporales (Benchmarking SE 18):</p>
                <ul style="padding-left: 18px; margin: 0;">
                    <li style="margin-bottom: 5px;"><strong>≥ 60% en SE 18:</strong> Trayectoria pronosticada hacia el éxito sin alterar parámetros logísticos.</li>
                    <li style="margin-bottom: 5px;"><strong>40-60% en SE 18:</strong> Reestructuración mandatoria (campañas masivas y flexibilidad horaria extrema).</li>
                    <li style="margin-bottom: 5px;"><strong>< 40% en SE 18:</strong> Escenario de crisis de salud pública predictiva. Requerirá medidas extraordinarias (vacunación obligada en clusters, sinergia interministerial).</li>
                </ul>
            </div>
        </div>`
        },
        criterios: {
            title: `Vulnerabilidad Diferencial por Determinantes Clínicos (${year})`,
            body: `<div style="color: var(--text-color, #334155); font-size: 0.92rem; line-height: 1.6; text-align: justify;">
            ${contextBanner}

            <div style="background: rgba(15, 105, 180, 0.04); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(15, 105, 180, 0.12); margin-bottom: 16px;">
                <strong style="color: var(--minsal-blue-dark);"><i class="fa-solid fa-microscope" style="margin-right:6px;"></i>Fisiopatología del Riesgo y Efectividad Vacunal</strong>
                <p style="margin: 8px 0 0 0;">Desde el enfoque de la vigilancia de enfermedades inmunoprevenibles, la morbi-mortalidad se distribuye asimétricamente. Grupos como inmunosenescentes (Adultos Mayores), pacientes con enfermedades no transmisibles compensadas o lábiles (Crónicos), o individuos con inmunosupresión transitoria (Embarazadas), exhiben curvas de letalidad abismalmente distintas ante la infección silvestre por influenza.</p>
                <p style="margin: 10px 0 0 0;">Consecuentemente, asegurar coberturas globales aceptables no basta; es perentorio garantizar que el <strong>blindaje serológico</strong> sea estadísticamente robusto de manera estratificada en cada uno de estos clústeres de alta dependencia clínica.</p>
            </div>

            <div style="background: rgba(100, 116, 139, 0.04); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(100, 116, 139, 0.12); margin-bottom: 16px;">
                <strong style="color: #475569;"><i class="fa-solid fa-database" style="margin-right:6px;"></i>Consideraciones Estructurales de Datos</strong>
                <p style="margin: 8px 0 0 0;">Se utiliza base de residencia decantada por el atributo <em>CRITERIO_ELEGIBILIDAD</em>. Las brechas detectadas se contrastan frente a las asignaciones de PNI estipuladas.</p>
                <p style="margin: 6px 0 0 0; font-size: 0.85rem; color: #64748b;"><em>Nota Preventiva: En la interpretación del dato, considere que en ciertos grupos (como comorbilidades no GES) el denominador INE-MINSAL puede sufrir desviaciones muestrales. Todo valor límite debe cotejarse con el empadronamiento clínico local.</em></p>
            </div>

            ${generatePatronesRiesgo(criticalGroups)}

            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #38bdf8; font-size: 0.85rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h4 style="margin-top: 0; color: #7dd3fc; margin-bottom: 8px;"><i class="fa-solid fa-heart-pulse" style="margin-right:6px;"></i>Pronóstico en Tensión de Red Asistencial</h4>
                <p style="margin: 0 0 8px 0;">Evidencia documentada de fallas sectorizadas de inmunización y su repercusión sistémica:</p>
                <ul style="padding-left: 18px; margin: 0;">
                    <li style="margin-bottom: 5px;">Cobertura AM < 70% correlaciona directamente con colapso de dotación de Camas Críticas y Cuidados Intermedios, prolongando los tiempos de estadía media.</li>
                    <li style="margin-bottom: 5px;">Cobertura Pediátrica insuficiente se traduce en congestión fulminante de servicios SAPU y urgencias pediátricas.</li>
                    <li>La disfunción sincrónica en múltiples cohortes desencadenará escenarios previsibles de reconversión de camas y colapso de derivación inter-nodos.</li>
                </ul>
            </div>
        </div>`
        },
        comparativa: {
            title: `Análisis Comparado de Eficiencia Operativa (Benchmarking Interanual)`,
            body: `<div style="color: var(--text-color, #334155); font-size: 0.92rem; line-height: 1.6; text-align: justify;">
            ${contextBanner}

            <div style="background: rgba(15, 105, 180, 0.04); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(15, 105, 180, 0.12); margin-bottom: 16px;">
                <strong style="color: var(--minsal-blue-dark);"><i class="fa-solid fa-microscope" style="margin-right:6px;"></i>Auditoría del Ritmo Operacional Estratégico</strong>
                <p style="margin: 8px 0 0 0;">Esta matriz agrupa los microesfuerzos semanales en bloques calendáricos, permitiendo depurar la "varianza del ruido" semanal y establecer una <strong>comparativa sólida de efectividad (Year-Over-Year)</strong>. Constituye el principal indicador para evaluar si el ecosistema primario (APS) está sosteniendo un grado de penetración equivalente o superior a las iteraciones pasadas de la Campaña de Invierno.</p>
            </div>

            <div style="background: rgba(245, 158, 11, 0.06); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.15); margin-bottom: 16px;">
                <strong style="color: #92400e;"><i class="fa-solid fa-magnifying-glass-chart" style="margin-right:6px;"></i>Detección de Patrones Operativos Anómalos</strong>
                <ul style="padding-left: 20px; margin: 8px 0 0 0; font-size: 0.88rem;">
                    <li style="margin-bottom: 8px;"><strong>Arranque Explosivo con Agotamiento Precoz:</strong> Una hiper-producción marzal seguida de un cráter estadístico en mayo delinea que el sistema consumió velozmente a los pacientes proactivos, fracasando rotundamente en la captación de los rezagados estructurales o "hard-to-reach".</li>
                    <li style="margin-bottom: 8px;"><strong>Deficiencia Constante del Vector Azul (${year}):</strong> Si las barras del ejercicio actual no logran sobreponerse al perfil de sombra (gris) de manera sistémica, atestigua una merma de las capacidades de la red de salud. Factores a dilucidar: desgaste de los equipos (burnout clínico), fallas logísticas de frío o escasez de suministros.</li>
                    <li style="margin-bottom: 8px;"><strong>Tendencia de Colapso Súbito > 50%:</strong> Un desplome violento mes-a-mes sin haberse superado el umbral del 85% decreta formalmente la desactivación virtual de la campaña. Exige reactivación normativa perentoria.</li>
                </ul>
            </div>

            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #38bdf8; font-size: 0.85rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h4 style="margin-top: 0; color: #7dd3fc; margin-bottom: 8px;"><i class="fa-solid fa-briefcase-medical" style="margin-right:6px;"></i>Sustento para la Autoridad Sanitaria</h4>
                <p style="margin: 0 0 8px 0;">Resulta mandatorio utilizar esta evidencia objetiva para:</p>
                <ul style="padding-left: 18px; margin: 0;">
                    <li style="margin-bottom: 5px;">Rendir cuentas de productividad efectiva ante auditorías del nivel central (SEREMI / Subsecretaría).</li>
                    <li style="margin-bottom: 5px;">Efectuar ajustes presupuestarios tácticos en programas de reforzamiento invernal, demostrando carencia respecto de la rentabilidad del periodo precedente.</li>
                </ul>
            </div>
        </div>`
        }
        };
    } else {
        let cob = 0;
        let color = 'Rojo';
        let missingDoses = 0;
        let lowestGroup = { name: '', percent: 100 };
        let criticalGroups = [];
        try {
            const data_resi = dashboardData.data_residencia.filter(i => i.comuna === filter);
            const dosisTotal = data_resi.reduce((s, i) => s + i.total, 0);
            const metaTotal = getMetaTotal(filter);
            cob = metaTotal > 0 ? (dosisTotal / metaTotal) * 100 : 0;
            color = cob >= 85 ? 'Verde' : (cob >= 70 ? 'Amarillo' : 'Rojo');
            
            const targetDoses = Math.ceil(metaTotal * 0.85);
            missingDoses = Math.max(0, targetDoses - dosisTotal);
            
            if (data_resi.length > 0) {
                const groups = data_resi[0].datos;
                for (let gName in groups) {
                    if (gName.toLowerCase().includes('total')) continue;
                    const gDoses = groups[gName] || 0;
                    const gMeta = getMetaTotal(filter, gName);
                    if (gMeta > 0) {
                        const gCob = (gDoses / gMeta) * 100;
                        if (gCob < lowestGroup.percent) {
                            lowestGroup = { name: gName, percent: gCob };
                        }
                        if (gCob < 70) {
                            criticalGroups.push({ name: gName, percent: gCob });
                        }
                    }
                }
            }
        } catch(e) { console.error(e); }
        
        criticalGroups.sort((a,b) => a.percent - b.percent);
        
        let localAnalysis = '';
        const ppGap = cob - 85;
        const ppAbs = Math.abs(ppGap).toFixed(1).replace('.', ',');
        
        let tacticalText = '';
        if (missingDoses > 0) {
            if (criticalGroups.length > 0) {
                let groupsHtml = criticalGroups.map(g => `<strong>${g.name} (${g.percent.toFixed(1).replace('.', ',')}%)</strong>`).join(', ');
                tacticalText = `<br><br>🚨 <strong>Riesgo Biológico Extremo (< 70%):</strong> Cohortes altamente lábiles (${groupsHtml}) ostentan coberturas insostenibles. Se proyecta de manera inequívoca que su contagio generará picos severos de morbi-mortalidad, consumiendo de golpe los recursos de urgencia locales.`;
            } else if (lowestGroup.name) {
                tacticalText = `<br><br>⚠️ <strong>Falla Epidemiológica Menor:</strong> El subgrupo de <strong>${lowestGroup.name} (${lowestGroup.percent.toFixed(1).replace('.', ',')}%)</strong> lastra el promedio integral de la comuna, requiriendo direccionamiento de esfuerzos de campo.`;
            }
        }
        
        const localTacticalText = (missingDoses > 0) ? `
        <br><br>🎯 <strong>Imperativo Operacional:</strong> El centro de salud responsable de esta jurisdicción precisa materializar exactamente <strong>${missingDoses.toLocaleString('es-CL')} dosis</strong> para estabilizar matemáticamente el riesgo de brotes expansivos.${tacticalText}` : '';
        
        if (color === 'Verde') {
            const ppExtraText = ppGap >= 0 ? `(+${ppAbs} pp de superávit)` : '';
            localAnalysis = `
                <div style="background: rgba(16, 185, 129, 0.12); border-left: 4px solid #10b981; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
                    <strong style="color: #047857; font-size: 1.1rem;">🟢 Resiliencia Poblacional Confirmada: Inmunidad Alcanzada (${cob.toFixed(1).replace('.', ',')}%) ${ppExtraText}</strong>
                    <p style="margin: 8px 0 0 0; color: #064e3b;">El entorno comunal de ${filter} valida de facto un escudo inmunitario integral frente al virus de la influenza circulante. El riesgo de brotes comunitarios sostenidos se ha neutralizado. Corresponde fase de mantenimiento y documentación de procesos exitosos intra-extramurales.</p>
                </div>
            `;
        } else if (color === 'Amarillo') {
            localAnalysis = `
                <div style="background: rgba(245, 158, 11, 0.12); border-left: 4px solid #f59e0b; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
                    <strong style="color: #92400e; font-size: 1.1rem;">🟡 Vulnerabilidad Latente: Inmunización Parcial (${cob.toFixed(1).replace('.', ',')}%) (-${ppAbs} pp de déficit)</strong>
                    <p style="margin: 8px 0 0 0; color: #78350f;">La matriz local exhibe una penetración insuficiente, manteniendo <strong>${ppAbs} puntos de déficit</strong> sobre el nivel de seguridad. La red se halla susceptible a microbrotes estocásticos de diseminación barrial o institucional. Requiere activar fase de contención secundaria (despliegue en terreno).${localTacticalText}</p>
                </div>
            `;
        } else {
            localAnalysis = `
                <div style="background: rgba(239, 68, 68, 0.12); border-left: 4px solid #ef4444; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
                    <strong style="color: #991b1b; font-size: 1.1rem;">🔴 Crisis de Intervención: Fractura del Cerco Sanitario (${cob.toFixed(1).replace('.', ',')}%) (-${ppAbs} pp de déficit)</strong>
                    <p style="margin: 8px 0 0 0; color: #7f1d1d;">Estado de alarma de Salud Pública. Con una deficiencia severa (<strong>${ppAbs} pp faltantes</strong>), el virus encontrará una masa susceptible amplia y expedita. Urge declaración de emergencia logística a nivel local, intervención transversal por parte del nivel secundario y movilización incesante de unidades móviles hacia las comunidades afectadas.${localTacticalText}</p>
                </div>
            `;
        }
        
        return {
            global: {
                title: `Evaluación de Barreras Sanitarias Locales — ${filter} ${year}`,
                body: `${contextBanner}
                <div style="color: var(--text-color, #334155); font-size: 0.92rem; line-height: 1.6; text-align: justify;">
                    <p>El perfil de cobertura consolidado para el radio de acción de <strong>${filter}</strong> evidencia el actual estado de preparación territorial:</p>
                    ${localAnalysis}
                    <p>La amplitud del sector naranja define, sin ambigüedades, la masa crítica de residentes sin barrera profiláctica. Su minimización acelerada constituye la prioridad sanitaria inapelable previo a la fase de hipercirculación endémica.</p>
                </div>`
            },
            local: {
                title: `Microanálisis Epidemiológico del Riesgo Inmunológico — ${filter} ${year}`,
                body: `${contextBanner}
                <div style="color: var(--text-color, #334155); font-size: 0.92rem; line-height: 1.6; text-align: justify;">
                    <p>Focalizando el estudio a la granularidad municipal, el veredicto sanitario para la comuna de <strong>${filter}</strong> decreta lo siguiente:</p>
                    ${localAnalysis}
                    <div style="background: rgba(100, 116, 139, 0.04); padding: 14px 16px; border-radius: 8px; border: 1px solid rgba(100, 116, 139, 0.12); margin-top: 16px;">
                        <p style="margin: 0; font-size: 0.85rem; color: #475569;"><i class="fa-solid fa-circle-info" style="margin-right:6px;"></i>Protocolo Dictaminado: Contrastar empíricamente estos datos con registros nominalizados del centro de salud, con especial hincapié en detectar posibles desajustes demográficos (población transitoria o rural profunda no tabulada).</p>
                    </div>
                </div>`
            },
            temporal: {
                title: `Velocidad de Respuesta e Intercepción Viral — ${filter}`,
                body: `${contextBanner}
                <div style="color: var(--text-color, #334155); font-size: 0.92rem; line-height: 1.6; text-align: justify;">
                    <p>Trayectoria histórica de penetración inmunológica restringida a la demografía de <strong>${filter}</strong>.</p>
                    ${localAnalysis}
                    <p><strong>Inspección Diagnóstica de Extremo Rígido:</strong> Si la cola más reciente del gráfico se estabiliza de manera horizontal sin coronar el umbral clínico necesario, denota la paralización irrefutable de la demanda. Dicho escenario manda a transicionar toda la estructura pasiva de la red municipal hacia acciones asertivas invasivas (barridos poblacionales).</p>
                </div>`
            },
            criterios: {
                title: `Mapeo de Fragilidad por Diagnóstico Diferencial — ${filter}`,
                body: `${contextBanner}
                <div style="color: var(--text-color, #334155); font-size: 0.92rem; line-height: 1.6; text-align: justify;">
                    <p>Descomposición analítica del riesgo clínico inherente a los habitantes prioritarios asentados en <strong>${filter}</strong>.</p>
                    ${localAnalysis}
                    ${generatePatronesRiesgo(criticalGroups)}
                </div>`
            },
            comparativa: {
                title: `Evaluación de Desempeño Longitudinal Local — ${filter}`,
                body: `${contextBanner}
                <div style="color: var(--text-color, #334155); font-size: 0.92rem; line-height: 1.6; text-align: justify;">
                    <p>Contrastación del despliegue logístico circunscrito a <strong>${filter}</strong> frente al paradigma operacional histórico previo.</p>
                    ${localAnalysis}
                    <p>Variaciones negativas respecto al referente plomizo dictan un retroceso funcional en el despliegue local de este año; urgen escrutinios de gestión, evaluación de recursos logísticos e intervención resolutiva frente a barreras sociales emergentes (desinformación o falta de locomoción).</p>
                </div>`
            }
        };
    }
}"""
    
    modified_content = content[:start_idx] + new_function + "\n\n" + content[end_idx:]
    
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(modified_content)

    print("Success")

if __name__ == '__main__':
    update_script()
