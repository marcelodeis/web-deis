# 📘 Guía de Actualización — Dashboard Influenza 2026
## Servicio de Salud Osorno

Este dashboard se alimenta de datos oficiales del MINSAL y metas provinciales. Sigue estos pasos para actualizar la información cada semana:

### 1. Preparación de Archivos
Asegúrate de tener los siguientes archivos en la carpeta raíz:
*   **`BASE DATOS MINSAL/INFLUENZA/Influenza.csv`**: El reporte crudo descargado del sistema oficial.
*   **`Metas_Influenza_2026.xlsx`**: El archivo con las metas por comuna y grupo de riesgo.

### 2. Ejecución del Pipeline (Actualización de Datos)
Para procesar los nuevos datos y generar el archivo que lee la web, ejecuta el siguiente comando en la terminal:

```powershell
python parse_influenza.py
```

Al finalizar, verás un resumen en consola con el total de vacunas procesadas y la confirmación de la generación de `dashboard_data.json`.

### 3. Visualización
Simplemente abre o refresca el archivo `index.html` en tu navegador. El dashboard detectará automáticamente los nuevos datos procesados.

---

### Notas Técnicas:
*   **Filtros automáticos**: El script filtra automáticamente solo las 7 comunas de la Provincia de Osorno.
*   **Interculturalidad**: Los datos de pueblos originarios se extraen automáticamente de la columna correspondiente en el CSV de Minsal.
*   **Mapa**: Los colores se ajustan dinámicamente según la cobertura lograda respecto a las metas cargadas en el Excel.

---
*Desarrollado para el Servicio de Salud Osorno — 2026*
