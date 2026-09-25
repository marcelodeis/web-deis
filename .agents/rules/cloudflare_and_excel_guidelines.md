# Reglas y Lecciones Aprendidas para el Despliegue en Cloudflare y Exportación de Datos

Estas reglas documentan las inconsistencias resueltas el 25 de septiembre de 2026 para prevenir que los mismos errores vuelvan a ocurrir en futuras actualizaciones.

## 1. Despliegue a Cloudflare (Script `construir_cloudflare.py`)

*   **Evitar Carpetas Basura/Desactualizadas:**
    *   **Problema Histórico:** El script antiguo de empaquetado tomaba copias viejas de archivos desde subcarpetas abandonadas (como `Directorio_Cloudflare` o `Cloudflare_FINAL_Subir`) ubicadas dentro de los módulos web. Esto causaba que, al subir a Cloudflare, el código viejo sobrescribiera las versiones recientes.
    *   **Solución Permanente:** El script `construir_cloudflare.py` **debe** iterar solo sobre las carpetas principales vivas (`Covid_Web`, `Influenza_Web`, `Portal_Web`, `Programáticas_Web`, `VPH_Web`, `VRS`) y **debe ignorar estrictamente** cualquier subcarpeta basura (`node_modules`, `__pycache__`, `Cloudflare_FINAL_Subir`, `_backup*`, etc.) a cualquier nivel de profundidad.
    
*   **Redireccionador Raíz (`index.html` en la raíz):**
    *   **Problema Histórico:** Al empaquetar desde los directorios individuales, se omitió un `index.html` en la raíz del proyecto. Como resultado, al entrar a `rni.cl` (la raíz del dominio) Cloudflare arrojaba un Error 404 porque no había índice.
    *   **Solución Permanente:** Todo paquete de despliegue para Cloudflare **debe incluir** un archivo `index.html` en su carpeta raíz que contenga la redirección automática a `Portal_Web/index.html`. El script `construir_cloudflare.py` ya está programado para copiar automáticamente el `index.html` que está en `C:\Antigravity IDE\WEB DEIS\` hacia la raíz del nuevo empaquetado. **No borrar el `index.html` ubicado en `WEB DEIS`.**

## 2. Exportación a Excel y Archivos JSON de Base de Datos

*   **Fechas de Bases de Datos Correctas en Excel:**
    *   **Problema Histórico:** Al descargar los Excel desde la matriz de Programáticas Web, la fila superior indicaba "Fecha de Actualización: Actual" en lugar de mostrar la fecha específica extraída de la base de datos (ej. "23-09-2026"). Esto se debía a que el código en JavaScript (`app_v9.js`) intentaba llamar a la propiedad `DATA.last_update` la cual no existía en los objetos JSON generados.
    *   **Solución Permanente:** Siempre usar la propiedad correcta generada por los scripts de Python: **`DATA.fecha_actualizacion`** o **`DATA.datos_disponibles_hasta`**. Nunca usar nombres inventados como `last_update` para los encabezados de los Excel que se autogeneran en el frontend. Todos los módulos (Influenza, Covid, VRS, VPH y Programáticas) deben extraer esta variable correctamente para inyectarla en la primera hoja de los archivos Excel.
