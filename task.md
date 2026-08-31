# Tareas de Implementación: Mejoras Autoconsulta

- [x] **1. Analítica de Establecimientos (Mini-Informe)**
  - [x] Actualizar lógica en utoconsulta.js para detectar columnas NOMBRE_COMUNA / NOMBRE_CENTRO o similares.
  - [x] Implementar función para agregar conteo de Vacunados/No Vacunados por Centro y Comuna.
  - [x] Generar UI dinámica para mostrar el mini-informe (Grid de Tarjetas por Comuna).
- [x] **2. Mejoras UI y Ancho de Tabla**
  - [x] Modificar ancho máximo en styles.css (max-width: 1400px o fluido).
  - [x] Ajustar proporciones de .autoconsulta-results-table para que "Resultado" tenga más espacio.
- [x] **3. Optimización de Descarga (Rendimiento)**
  - [x] Implementar un loader visual (modal o spinner sobre el botón) para el proceso de descarga.
  - [x] Envolver la generación de SheetJS (XLSX.write) en un setTimeout o Worker para liberar el UI thread temporalmente.
- [x] **4. Aplicación Global**
  - [x] Replicar o inyectar cambios en las 4 plataformas (Influenza, Covid, VRS, VPH).
