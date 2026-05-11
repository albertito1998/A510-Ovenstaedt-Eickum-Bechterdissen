# A510 Ovenstaedt-Eickum-Bechterdissen WebGIS

## 1. Descripcion del proyecto
Visor WebGIS estatico para seguimiento de Wegebau, Arbeitsflaechen, parcelas afectadas y accesos temporales del proyecto A510 Ovenstaedt-Eickum-Bechterdissen. El visor esta pensado para uso interno de equipo, obra y gestion documental, sin backend y con despliegue directo en GitHub Pages.

## 2. Estructura de carpetas
```text
A510_OVENSTAEDT_EICKUM_BECHTERDISSEN_WEBGIS/
|
|-- 01_QGIS/
|   `-- a510_ovenstaedt_eickum_bechterdissen_wegebau.qgz
|
|-- 02_CAD/
|   `-- export_autocad.dxf
|
|-- 03_DATA/
|   `-- wegebau_status.geojson
|
|-- 04_PERMITS/
|   |-- M001/
|   |-- M002/
|   `-- M003/
|
`-- 05_WEB/
    |-- index.html
    |-- app.js
    |-- style.css
    |-- README.md
    `-- data/
        |-- project_dxf_lineas.geojson
        |-- project_dxf_poligonos.geojson
        `-- wegebau_status.geojson
```

## 3. Flujo AutoCAD -> QGIS -> GeoJSON -> Web
1. Preparar geometria base en AutoCAD y exportar a `02_CAD/export_autocad.dxf`.
2. Abrir en QGIS el proyecto `01_QGIS/a510_ovenstaedt_eickum_bechterdissen_wegebau.qgz`, que referencia el DXF georreferenciado de `02_CAD/export_autocad.dxf` en `EPSG:25832`.
3. Validar atributos, geometria y estados de permiso en QGIS.
4. Exportar la capa final a GeoJSON web.
5. Exportar tambien las capas del DXF del proyecto QGIS a GeoJSON web si deben visualizarse en el visor.
6. Guardar los archivos finales en `05_WEB/data/wegebau_status.geojson`, `05_WEB/data/project_dxf_lineas.geojson` y `05_WEB/data/project_dxf_poligonos.geojson`.
7. Publicar la carpeta `05_WEB` como visor estatico.

## 4. Explicacion CRS
- CAD/QGIS: `EPSG:25832` (`ETRS89 / UTM Zone 32N`).
- Web/Leaflet: `EPSG:4326` (`WGS84 lat/lon`).
- El trabajo tecnico se mantiene en `EPSG:25832`.
- El archivo web final `05_WEB/data/wegebau_status.geojson` debe exportarse desde QGIS en `EPSG:4326`.
- No reproyectar en JavaScript. Leaflet consumira directamente el GeoJSON ya exportado en `EPSG:4326`.

## 5. Como exportar desde QGIS
1. Right click layer.
2. Export.
3. Save Features As.
4. Format: `GeoJSON`.
5. CRS: `EPSG:4326`.
6. File: `05_WEB/data/wegebau_status.geojson`.

## 6. Campos obligatorios
Cada feature debe incluir:

```json
{
  "uid": "A510_M001_001",
  "project": "A510 Ovenstaedt-Eickum-Bechterdissen",
  "section": "Ovenstaedt-Eickum",
  "mast": "M001",
  "parcel_id": "TEST-001",
  "type": "WEG",
  "status": "PENDING",
  "owner_ref": "OWNER-001",
  "permit_ref": "",
  "date_req": "2026-05-11",
  "date_ok": "",
  "comment": "Test polygon only"
}
```

## 7. Valores validos de status
- `APPROVED`
- `PENDING`
- `REJECTED`
- `CONDITIONAL`
- `UNKNOWN`

## 8. Valores validos de type
- `WEG`
- `ARBEITSFLAECHE`
- `PARZELLE`
- `LAGER`
- `TROMMELPLATZ`
- `MASCHINENPLATZ`

## 9. Como probar con Live Server
1. Abrir la carpeta `A510_OVENSTAEDT_EICKUM_BECHTERDISSEN_WEBGIS/05_WEB` en Visual Studio Code.
2. Instalar la extension `Live Server` si no esta instalada.
3. Hacer clic derecho sobre `index.html`.
4. Seleccionar `Open with Live Server`.
5. Verificar que el navegador carga `index.html`, `app.js`, `style.css` y `data/wegebau_status.geojson`.

## 10. Como publicar en GitHub Pages
1. Subir el proyecto a un repositorio GitHub.
2. Este repositorio incluye el workflow `.github/workflows/deploy-pages.yml` para publicar automaticamente la carpeta `05_WEB`.
3. En GitHub: `Settings -> Pages`.
4. En `Source`, seleccionar `GitHub Actions`.
5. Hacer push a `main` o lanzar manualmente el workflow `Deploy GitHub Pages`.
6. Esperar la URL de publicacion y confirmar que la ruta relativa `./data/wegebau_status.geojson` sigue siendo valida tras publicar.

## 11. Checklist QA/QC semanal
- Todos los poligonos tienen `uid`.
- `uid` unico.
- Todos tienen `status`.
- `status` valido.
- `type` valido.
- Geometria valida.
- GeoJSON final exportado en `EPSG:4326`.
- `permit_ref` informado si `status` es `APPROVED` o `CONDITIONAL`.
- No incluir nombres reales de propietarios si no es necesario.
- Backup de `01_QGIS` y `03_DATA` en Google Drive.

## Notas operativas
- La capa WMS de catastro se configura en `app.js` mediante `WMS_URL` y `WMS_LAYER_NAME`.
- El visor web incluye dos mapas base conmutables: `OpenStreetMap` y `Esri Satélite`.
- El visor `ELECNORGIS` carga tambien las capas del proyecto QGIS exportadas desde el DXF en formato GeoJSON web (`EPSG:4326`).
- El GeoJSON incluido es un ejemplo ficticio en `EPSG:4326`, sin datos reales de propietarios ni parcelas.
- La carpeta documental oficial puede mantenerse en Google Drive y referenciarse desde `permit_ref` mediante URL.
