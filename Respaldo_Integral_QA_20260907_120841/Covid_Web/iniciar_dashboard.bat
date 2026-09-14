@echo off
echo Iniciando el servidor local para el Dashboard...
echo Se abrira una ventana en tu navegador web en un momento.
start http://localhost:8000
python -m http.server 8000
