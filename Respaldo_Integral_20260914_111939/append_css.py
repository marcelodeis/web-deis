import codecs

css_content = """
/* =========================================
   REDISEÑO UX AUTOCONSULTA
   ========================================= */

/* 1. Guía Visual de 3 Pasos */
.autoconsulta-steps-container {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    margin-top: 1.5rem;
    margin-bottom: 2rem;
}
.autoconsulta-step {
    flex: 1;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(15, 105, 180, 0.15);
    border-radius: 12px;
    padding: 1.2rem;
    position: relative;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    display: flex;
    flex-direction: column;
}
.autoconsulta-step:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(15, 105, 180, 0.15);
}
.step-number {
    position: absolute;
    top: -15px;
    left: 20px;
    background: var(--minsal-blue, #0f69b4);
    color: white;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1rem;
    box-shadow: 0 4px 10px rgba(15, 105, 180, 0.4);
    border: 2px solid white;
}
.step-title {
    font-weight: 700;
    color: #1e293b;
    font-size: 0.95rem;
    margin-bottom: 0.5rem;
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    gap: 8px;
}
.step-desc {
    color: #64748b;
    font-size: 0.8rem;
    line-height: 1.4;
}

/* 2. Botones Especiales de Autoconsulta */
.autoconsulta-actions {
    display: flex;
    gap: 10px;
    margin-top: 15px;
    justify-content: center;
}
.btn-primary-action {
    background: var(--minsal-blue, #0f69b4);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(15, 105, 180, 0.3);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
}
.btn-primary-action:hover {
    background: #0c5798;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(15, 105, 180, 0.4);
}
.btn-secondary-action {
    background: white;
    color: var(--minsal-blue, #0f69b4);
    border: 1px solid var(--minsal-blue, #0f69b4);
    padding: 10px 20px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
}
.btn-secondary-action:hover {
    background: rgba(15, 105, 180, 0.05);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}

/* 3. Rediseño Drop Zone */
.autoconsulta-drop-zone {
    border: 2px dashed rgba(15, 105, 180, 0.4);
    background: rgba(255, 255, 255, 0.6);
    padding: 3rem 2rem;
    border-radius: 16px;
    text-align: center;
    transition: all 0.3s ease;
    cursor: pointer;
    margin-bottom: 2rem;
    position: relative;
    overflow: hidden;
}
.autoconsulta-drop-zone:hover {
    background: rgba(255, 255, 255, 0.9);
    border-color: var(--minsal-blue, #0f69b4);
    box-shadow: 0 10px 30px rgba(15, 105, 180, 0.1);
}
.autoconsulta-drop-zone.dragover {
    background: rgba(15, 105, 180, 0.05);
    border-color: var(--minsal-blue, #0f69b4);
    transform: scale(1.02);
}
.autoconsulta-drop-icon i {
    font-size: 3.5rem;
    color: var(--minsal-blue, #0f69b4);
    opacity: 0.8;
    margin-bottom: 1rem;
    transition: transform 0.3s ease;
}
.autoconsulta-drop-zone:hover .autoconsulta-drop-icon i {
    transform: translateY(-5px);
}
.autoconsulta-drop-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: #1e293b;
    margin-bottom: 0.5rem;
}
.autoconsulta-drop-subtitle {
    color: #64748b;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
}

/* 4. Bloque Antes de Comenzar (Info simplificada) */
.autoconsulta-info-compact {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    margin-bottom: 2rem;
    background: rgba(255,255,255,0.7);
    border-radius: 12px;
    padding: 1.2rem;
    border: 1px solid rgba(0,0,0,0.05);
}
.info-compact-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}
.info-compact-icon {
    background: rgba(15, 105, 180, 0.1);
    color: var(--minsal-blue, #0f69b4);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    flex-shrink: 0;
}
.info-compact-text {
    font-size: 0.75rem;
    line-height: 1.4;
    color: #475569;
}
.info-compact-text strong {
    color: #1e293b;
    display: block;
    margin-bottom: 2px;
}
"""

with codecs.open(r'c:\Antigravity IDE\WEB DEIS\shared\global_premium.css', 'a', 'utf-8') as f:
    f.write(css_content)

print("CSS appended to global_premium.css")
