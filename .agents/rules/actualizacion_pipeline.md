# Reglas Críticas del Pipeline de Actualización (actualizar_todo.py)

## Incidente 2026-10-01: Lecciones aprendidas

### 1. NUNCA modificar `update_dates.py` con inyección de código duplicado
El script `update_dates.py` reemplaza la función `formatHeaderDate()` en los archivos JS de cada vacuna.
**PELIGRO**: Si el reemplazo se hace mal (regex defectuoso, inyección doble), se **CORROMPE la sintaxis JavaScript** de TODOS los dashboards simultáneamente, dejando la web completamente en blanco (los gráficos no cargan porque el JS se rompe antes de ejecutarse).

- Siempre verificar que el bloque inyectado cierra correctamente las llaves `{}`.
- Después de ejecutar `update_dates.py`, abrir al menos UN archivo JS afectado y verificar que NO haya código duplicado ni llaves sobrantes.

### 2. El script `parse_influenza.py` se ejecuta desde `Scripts_Procesamiento/`
- El working directory (cwd) es `Influenza_Web/Scripts_Procesamiento/`.
- Las rutas relativas dentro del script DEBEN considerar este cwd.
- `METAS_PATH` debe apuntar a `../Archivos_Excel/Metas_Influenza_{YEAR}.xlsx` (con `..` porque sale de Scripts_Procesamiento).
- `OUTPUT_PATH` y `JS_OUTPUT_PATH` ya usan `..` correctamente para escribir en `Influenza_Web/`.

### 3. El `actualizar_todo.py` DEBE incluir estos scripts en orden:
```
# Influenza
Influenza_Web/Scripts_Procesamiento/parse_influenza.py
generar_rescates_influenza.py
generar_rechazos_influenza.py

# Programáticas (¡LOS 3 SCRIPTS, no solo rescates!)
Programáticas_Web/generar_rescates_v5.py
Programáticas_Web/generate_data_2026.py          ← NO OMITIR
Programáticas_Web/generate_autoconsulta_index.py  ← NO OMITIR

# VRS
VRS/Scripts_Procesamiento/parse_vrs.py
VRS/scripts/generar_indice_vrs.py

# VPH
VPH_Web/procesar_observatorio_vph.py
VPH_Web/procesar_ocurrencia_vph.py
VPH_Web/integrar_ocurrencia.py
VPH_Web/scripts/generar_indice_vph.py

# Post-procesamiento (¡AMBOS!)
update_dates.py          ← NO OMITIR (actualiza fechas en headers JS)
update_cache_busters.py  ← NO OMITIR (evita caché del navegador)

# Empaquetado final
construir_cloudflare.py
```

### 4. Cálculo del cwd en `actualizar_todo.py`
- Cada script hijo se ejecuta usando `os.path.dirname(os.path.abspath(script_path))` como cwd.
- Se invoca con `os.path.basename(script_path)` (solo el nombre del archivo).
- **NUNCA** calcular el cwd tomando solo el primer segmento del path (`parts[0]`), porque falla con rutas de 3+ niveles como `VRS/Scripts_Procesamiento/parse_vrs.py`.

### 5. Archivo de Metas de Influenza
- El archivo `Metas_Influenza_2026.xlsx` DEBE existir en `Influenza_Web/Archivos_Excel/`.
- Si no existe, `parse_influenza.py` genera un JSON con `"metas": {}` (vacío), lo que causa que la web muestre 0% de cobertura y "N/D" en todos los grupos objetivo.
- Verificar SIEMPRE que el campo `metas` del JSON generado NO esté vacío.

### 6. Verificación post-actualización obligatoria
Después de ejecutar `actualizar_todo.py`, verificar:
1. ✅ `fecha_procesamiento` en cada `dashboard_data_*.json` tiene la fecha de HOY
2. ✅ `metas` en `Influenza_Web/dashboard_data_2026.json` NO está vacío `{}`
3. ✅ Los archivos JS de cada vacuna NO tienen sintaxis duplicada/rota
4. ✅ Los archivos `index.html` tienen cache busters actualizados
