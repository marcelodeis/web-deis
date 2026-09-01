# Reglas Generales para Bases de Datos de Vacunas (MINSAL / DEIS)

Siempre que se trabaje con archivos CSV o bases de datos de vacunas (ej. Programáticas, Influenza_Web, etc.) y se deba extraer o procesar la información, es **OBLIGATORIO** aplicar los siguientes filtros en el código:

1. **VACUNA_ADMINISTRADA**: Debe ser igual a "SI".
2. **REGISTRO_ELIMINADO**: Debe ser distinto de "SI" (o igual a "NO").
3. **CRITERIO_ELEGIBILIDAD**: Se deben excluir los registros donde el valor sea "EPRO".
4. **DOSIS**: Se deben excluir los registros donde el valor sea "EPRO".

## Ejemplo en Python:
```python
if row.get("VACUNA_ADMINISTRADA", "").strip().upper() != "SI":
    continue
if row.get("REGISTRO_ELIMINADO", "").strip().upper() != "NO":
    continue
if row.get("CRITERIO_ELEGIBILIDAD", "").strip().upper() == "EPRO":
    continue
if row.get("DOSIS", "").strip().upper() == "EPRO":
    continue
```
