---
name: Cloudflare Upload Rules
description: Reglas estrictas para preparar y copiar archivos para subir a Cloudflare Pages.
---

# Reglas para Despliegues en Cloudflare Pages

Siempre que el usuario pida preparar, copiar o actualizar la carpeta `Cloudflare_FINAL_Subir` (o cualquier despliegue para Cloudflare), debes aplicar OBLIGATORIAMENTE los siguientes filtros para cumplir con las estrictas limitaciones técnicas de la plataforma y evitar errores de subida.

## 1. Límite de Tamaño de Archivo
- **REGLA ABSOLUTA:** Ningún archivo debe pesar más de **24 MB** (25165824 bytes). Cloudflare rechaza archivos que superen los 25 MB.

## 2. Exclusión de Formatos No Web y Bases de Datos
- **NO INCLUIR** archivos de datos pesados ni fuentes no procesadas, a menos que se haya explícitamente confirmado que son parte de la web.
- Excluir explícitamente extensiones como: `.zip`, `.xlsx`, `.csv`, `.ts`, `.pyc`, `.pdf` (a menos que el PDF deba ser accesible).

## 3. Exclusión de Directorios de Sistema y Entornos
- **NUNCA INCLUIR** carpetas ocultas o de configuración:
  - `.git`
  - `.venv`, `venv`, `env`
  - `.trunk`
  - `.claude`, `.cursor`, `.vibecheck`, `.agents`
  - `node_modules`, `__pycache__`
- **NUNCA INCLUIR** carpetas de respaldo: `cloudflare`, `cloudflare_deploy`, `Respaldos`, `Archivos_Excel`, `Documentos_PDF`, `Scripts_Procesamiento`, `workflows`.

## Comando PowerShell Recomendado para la Copia:
Usa siempre una estructura similar a la siguiente para garantizar el cumplimiento de las reglas:

```powershell
$folders = "Covid_Web", "Influenza_Web", "Portal_Web", "Programáticas_Web", "shared", "VPH_Web", "VRS"
foreach ($folder in $folders) {
    robocopy "C:\ruta\origen\$folder" "C:\ruta\destino\$folder" /MIR /MAX:25165824 /XF "*.zip" "*.xlsx" "*.csv" "*.ts" "*.pyc" /XD ".git" ".venv" ".trunk" ".claude" ".cursor" "cloudflare" "cloudflare_deploy" "Respaldos" "Archivos_Excel" "Documentos_PDF" "Scripts_Procesamiento" "__pycache__" "workflows" ".agents" ".vibecheck" "venv" "env" "node_modules" /NJH /NJS /NDL /NC /NS | Out-Null
}
```

## 4. Archivo index.html Ra�z
- **OBLIGATORIO:** Aseg�rate SIEMPRE de que exista un archivo index.html en la ra�z de la carpeta de despliegue (Cloudflare_FINAL_Subir\index.html) que contenga un redireccionamiento a /Portal_Web/index.html, ya que Cloudflare exige un index.html en el directorio base para no devolver un error 404.
