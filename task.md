# Tareas de Implementación: Mejoras Autoconsulta

- [x] **1. Analítica de Establecimientos (Mini-Informe)**
  - [x] Actualizar lógica en  utoconsulta.js para detectar columnas NOMBRE_COMUNA / NOMBRE_CENTRO### Fase 5: VPH (Observatorio y Ocurrencia)
- [ ] Ejecutar `procesar_ocurrencia_vph.py` para bases de ocurrencia
- [/] Ejecutar `procesar_observatorio_vph.py` para construir cohorte 15 años
- [ ] Ejecutar `integrar_ocurrencia.py`
- [x] Ejecutar `generar_indice_vph.py` (Autoconsulta)

### Fase 6: Influenza y COVID-19
- [x] Procesar bases Influenza 2026 manteniendo mejoras UX/UI y concentración acumulada.
- [x] Ejecutar `generar_indice_influenza.py` (Autoconsulta)
- [x] Procesar bases COVID-19 2026.
- [x] Ejecutar `generar_indice_covid.py` (Autoconsulta)-results-table para que "Resultado" tenga más espacio.
- [x] **3. Optimización de Descarga (Rendimiento)**
  - [x] Implementar un loader visual (modal o spinner sobre el botón) para el proceso de descarga.
  - [x] Envolver la generación de SheetJS (XLSX.write) en un setTimeout o Worker para liberar el UI thread temporalmente.
- [x] **4. Aplicación Global**
  - [x] Replicar o inyectar cambios en las 4 plataformas (Influenza, Covid, VRS, VPH).
