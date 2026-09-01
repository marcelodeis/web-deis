<?php
// api/establecimientos.php
// Endpoint que sirve el GeoJSON de la Provincia de Osorno

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$archivo = __DIR__ . '/../Establecimientos_Provincia_Osorno.geojson';

if (!file_exists($archivo)) {
    http_response_code(404);
    echo json_encode(['error' => 'Archivo GeoJSON no encontrado']);
    exit;
}

// Leer y validar que sea JSON válido
$contenido = file_get_contents($archivo);
$data = json_decode($contenido, true);

if ($data === null) {
    http_response_code(500);
    echo json_encode(['error' => 'El archivo GeoJSON no es válido']);
    exit;
}

// Emitir directamente el contenido ya validado (más rápido que re-encodificar)
echo $contenido;
