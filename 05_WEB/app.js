const PROJECT_DXF_LINES_PATH = "./data/project_dxf_lineas.geojson";
const PROJECT_DXF_POLYGONS_PATH = "./data/project_dxf_poligonos.geojson";
const TRASSENACHSE_PATH = "./data/trassenachse_gesamt.geojson";
const TRASSENACHSE_BUFFER_PATH = "./data/trassenachse_gesamt_buffer_500m.geojson";
const PARCEL_PERMITS_GEOJSON_PATH = "./data/parcel_permits_example.geojson";
const PARCEL_PERMITS_CSV_PATH = "./data/parcel_permits_status.csv";

const PERMIT_STATUS_COLORS = {
  OBTAINED: "#2ecc71",
  CONTACTED: "#f1c40f",
  NOT_STARTED: "#e74c3c",
  NO_DATA: "#95a5a6"
};

const WMS_CATALOG = [
  {
    key: "catastro",
    label: "Catastro NRW - Flurstuecke",
    url: "https://www.wms.nrw.de/geobasis/wms_nw_alkis",
    layers: "adv_alkis_flurstuecke",
    styles: "Gelb",
    opacity: 0.88,
    attribution: "Geobasis NRW ALKIS"
  },
  {
    key: "rios",
    label: "Rios y cauces NRW",
    url: "https://www.wms.nrw.de/umwelt/gsk3e",
    layers: "5,8,9,10",
    opacity: 0.78,
    attribution: "GSK3E NRW"
  },
  {
    key: "inundables",
    label: "Zonas inundables NRW",
    url: "https://www.wms.nrw.de/umwelt/wasser/uesg",
    layers: "3,5,6",
    opacity: 0.5,
    attribution: "UESG NRW"
  },
  {
    key: "hq100",
    label: "Hochwasser HQ100",
    url: "https://www.wms.nrw.de/umwelt/HW_Gefahrenkarte",
    layers: "Grenze_der_ueberfluteten_Gebiete_mw,Tiefen_Ueberflutungsgebiet_mw",
    opacity: 0.52,
    attribution: "HW Gefahrenkarte NRW"
  },
  {
    key: "naturschutz",
    label: "Naturschutzgebiete",
    url: "https://www.wms.nrw.de/umwelt/linfos",
    layers: "Naturschutzgebiete",
    opacity: 0.62,
    attribution: "LINFOS NRW"
  },
  {
    key: "ffh",
    label: "FFH-Gebiete",
    url: "https://www.wms.nrw.de/umwelt/linfos",
    layers: "FFH-Gebiete",
    opacity: 0.58,
    attribution: "LINFOS NRW"
  },
  {
    key: "vogelschutz",
    label: "Vogelschutzgebiete",
    url: "https://www.wms.nrw.de/umwelt/linfos",
    layers: "Vogelschutzgebiete",
    opacity: 0.58,
    attribution: "LINFOS NRW"
  },
  {
    key: "lsg",
    label: "Landschaftsschutz",
    url: "https://www.wms.nrw.de/umwelt/linfos",
    layers: "Landschaftsschutzgebiet",
    opacity: 0.45,
    attribution: "LINFOS NRW"
  },
  {
    key: "biotop",
    label: "Biotopkataster",
    url: "https://www.wms.nrw.de/umwelt/linfos",
    layers: "Biotopkataster_Flaeche",
    opacity: 0.52,
    attribution: "LINFOS NRW"
  }
];

const mapMessage = document.getElementById("mapMessage");
const statusFilter = document.getElementById("statusFilter");
const sectionFilter = document.getElementById("sectionFilter");
const mastFilter = document.getElementById("mastFilter");
const searchInput = document.getElementById("searchInput");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const zoomAllBtn = document.getElementById("zoomAllBtn");
const zoomProjectBtn = document.getElementById("zoomProjectBtn");

const counters = {
  total: document.getElementById("countTotal"),
  OBTAINED: document.getElementById("countApproved"),
  CONTACTED: document.getElementById("countPending"),
  NOT_STARTED: document.getElementById("countRejected"),
  csv: document.getElementById("countConditional"),
  NO_DATA: document.getElementById("countUnknown")
};

const IS_MOBILE = window.matchMedia("(max-width: 768px)").matches;
const DEFAULT_WMS_KEYS = IS_MOBILE ? ["catastro"] : ["catastro", "rios"];

const map = L.map("map", { zoomControl: true }).setView([52.05, 8.65], 11);

const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

const satelliteLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  { maxZoom: 20, attribution: "Tiles &copy; Esri" }
);

const overlayLayers = {};
WMS_CATALOG.forEach((entry) => {
  const layer = L.tileLayer.wms(entry.url, {
    layers: entry.layers,
    styles: entry.styles || "",
    format: "image/png",
    transparent: true,
    opacity: entry.opacity,
    attribution: entry.attribution
  });
  entry.layer = layer;
  overlayLayers[entry.label] = layer;
});

const overlayControl = L.control.layers(
  {
    OpenStreetMap: osmLayer,
    "Esri Satelite": satelliteLayer
  },
  overlayLayers,
  { collapsed: false }
).addTo(map);

satelliteLayer.addTo(map);
WMS_CATALOG.filter((entry) => DEFAULT_WMS_KEYS.includes(entry.key)).forEach((entry) => {
  entry.layer.addTo(map);
});

let trassenachseLayer = null;
let trassenachseBufferLayer = null;
let projectLinesLayer = null;
let projectPolygonsLayer = null;
let parcelPermitsLayer = null;
let dxfLinesLoaded = false;
let dxfPolygonsLoaded = false;
let projectGroup = null;
let permitParcelFeatures = [];
let permitStatusByParcel = {};

function showMessage(message, isVisible = true) {
  mapMessage.textContent = message;
  mapMessage.hidden = !isVisible;
}

function disableUnusedFilters() {
  [statusFilter, sectionFilter, mastFilter, searchInput, resetFiltersBtn].forEach((el) => {
    el.disabled = true;
  });
}

function resetCounters() {
  counters.total.textContent = "0";
  counters.OBTAINED.textContent = "0";
  counters.CONTACTED.textContent = "0";
  counters.NOT_STARTED.textContent = "0";
  counters.csv.textContent = "0";
  counters.NO_DATA.textContent = "0";
}

function fitToLayerBounds(layer) {
  const bounds = layer.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [20, 20] });
  }
}

function axisStyle() {
  return { color: "#1f4e79", weight: 3.4, opacity: 1 };
}

function bufferStyle() {
  return {
    color: "#16a085",
    weight: 2,
    dashArray: "10 6",
    fillColor: "#48c9b0",
    fillOpacity: 0.09
  };
}

function projectLineStyle() {
  return { color: "#154360", weight: 1.7, opacity: 0.9 };
}

function projectPolygonStyle() {
  return {
    color: "#d35400",
    weight: 1.1,
    fillColor: "#f39c12",
    fillOpacity: 0.12
  };
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((item) => item.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(",");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || "").trim();
    });
    return row;
  });
}

function getParcelStatus(parcelId) {
  return permitStatusByParcel[parcelId]?.permit_status || "NO_DATA";
}

function getParcelStyle(feature) {
  const parcelId = feature.properties?.parcel_id;
  const status = getParcelStatus(parcelId);
  return {
    color: "#1f2933",
    weight: 2.2,
    fillColor: PERMIT_STATUS_COLORS[status] || PERMIT_STATUS_COLORS.NO_DATA,
    fillOpacity: 0.42
  };
}

function createParcelPopup(feature) {
  const properties = feature.properties || {};
  const parcelId = properties.parcel_id || "-";
  const csv = permitStatusByParcel[parcelId] || {};
  return `
    <div class="popup-grid">
      <div><strong>parcel_id</strong><span>${parcelId}</span></div>
      <div><strong>gemarkung</strong><span>${properties.gemarkung || "-"}</span></div>
      <div><strong>flur</strong><span>${properties.flur || "-"}</span></div>
      <div><strong>status</strong><span>${csv.permit_status || "NO_DATA"}</span></div>
      <div><strong>fase</strong><span>${csv.permit_phase || "-"}</span></div>
      <div><strong>owner_ref</strong><span>${csv.owner_ref || "-"}</span></div>
      <div><strong>contact_date</strong><span>${csv.contact_date || "-"}</span></div>
      <div><strong>permit_date</strong><span>${csv.permit_date || "-"}</span></div>
      <div><strong>comment</strong><span>${csv.comment || properties.note || "-"}</span></div>
    </div>
  `;
}

function updatePermitCounters(features) {
  const counts = {
    total: features.length,
    OBTAINED: 0,
    CONTACTED: 0,
    NOT_STARTED: 0,
    NO_DATA: 0
  };

  features.forEach((feature) => {
    counts[getParcelStatus(feature.properties?.parcel_id)] += 1;
  });

  counters.total.textContent = String(counts.total);
  counters.OBTAINED.textContent = String(counts.OBTAINED);
  counters.CONTACTED.textContent = String(counts.CONTACTED);
  counters.NOT_STARTED.textContent = String(counts.NOT_STARTED);
  counters.csv.textContent = String(features.filter((feature) => permitStatusByParcel[feature.properties?.parcel_id]).length);
  counters.NO_DATA.textContent = String(counts.NO_DATA);
}

function bindProjectPopup(feature, layer, label) {
  const properties = feature.properties || {};
  const propertyEntries = Object.entries(properties).slice(0, 8);
  const detailHtml = propertyEntries.length
    ? propertyEntries.map(([key, value]) => `<div><strong>${key}</strong><span>${String(value)}</span></div>`).join("")
    : '<div><strong>detalle</strong><span>Sin atributos relevantes</span></div>';

  layer.bindPopup(`
    <div class="popup-grid">
      <div><strong>capa</strong><span>${label}</span></div>
      ${detailHtml}
    </div>
  `);
}

async function loadProjectLayers() {
  const [axisGeoJson, bufferGeoJson] = await Promise.all([
    fetch(TRASSENACHSE_PATH).then((r) => r.json()),
    fetch(TRASSENACHSE_BUFFER_PATH).then((r) => r.json())
  ]);

  trassenachseBufferLayer = L.geoJSON(bufferGeoJson, {
    style: bufferStyle,
    onEachFeature: (feature, layer) => bindProjectPopup(feature, layer, "Trassenachse Buffer 500m")
  }).addTo(map);

  trassenachseLayer = L.geoJSON(axisGeoJson, {
    style: axisStyle,
    onEachFeature: (feature, layer) => bindProjectPopup(feature, layer, "Trassenachse Gesamt")
  }).addTo(map);
  projectLinesLayer = L.layerGroup();
  projectPolygonsLayer = L.layerGroup();
  projectGroup = L.featureGroup([trassenachseBufferLayer, trassenachseLayer]);

  overlayControl.addOverlay(trassenachseBufferLayer, "Corredor 500m");
  overlayControl.addOverlay(trassenachseLayer, "Trassenachse Gesamt");
  overlayControl.addOverlay(projectLinesLayer, "Proyecto QGIS - DXF lineas");
  overlayControl.addOverlay(projectPolygonsLayer, "Proyecto QGIS - DXF poligonos");
}

async function ensureDxfLinesLoaded() {
  if (dxfLinesLoaded) {
    return;
  }

  const geojson = await fetch(PROJECT_DXF_LINES_PATH).then((r) => r.json());
  const loadedLayer = L.geoJSON(geojson, {
    style: projectLineStyle,
    onEachFeature: (feature, layer) => bindProjectPopup(feature, layer, "DXF lineas")
  });
  projectLinesLayer.addLayer(loadedLayer);
  dxfLinesLoaded = true;
}

async function ensureDxfPolygonsLoaded() {
  if (dxfPolygonsLoaded) {
    return;
  }

  const geojson = await fetch(PROJECT_DXF_POLYGONS_PATH).then((r) => r.json());
  const loadedLayer = L.geoJSON(geojson, {
    style: projectPolygonStyle,
    onEachFeature: (feature, layer) => bindProjectPopup(feature, layer, "DXF poligonos")
  });
  projectPolygonsLayer.addLayer(loadedLayer);
  dxfPolygonsLoaded = true;
}

async function loadParcelPermits() {
  const [parcelGeoJson, csvText] = await Promise.all([
    fetch(PARCEL_PERMITS_GEOJSON_PATH).then((r) => r.json()),
    fetch(PARCEL_PERMITS_CSV_PATH).then((r) => r.text())
  ]);

  permitParcelFeatures = Array.isArray(parcelGeoJson.features) ? parcelGeoJson.features : [];
  permitStatusByParcel = {};

  parseCsv(csvText).forEach((row) => {
    if (row.parcel_id) {
      permitStatusByParcel[row.parcel_id] = row;
    }
  });

  parcelPermitsLayer = L.geoJSON(permitParcelFeatures, {
    style: getParcelStyle,
    onEachFeature: (feature, layer) => {
      layer.bindPopup(createParcelPopup(feature));
    }
  }).addTo(map);

  overlayControl.addOverlay(parcelPermitsLayer, "Control permisos CSV");
  updatePermitCounters(permitParcelFeatures);
}

async function initializeMap() {
  showMessage("Cargando capas del proyecto y control de permisos CSV...", true);
  disableUnusedFilters();
  resetCounters();

  try {
    await loadProjectLayers();
    await loadParcelPermits();

    const zoomLayer = parcelPermitsLayer || trassenachseBufferLayer || projectGroup;
    if (zoomLayer) {
      fitToLayerBounds(zoomLayer);
    }

    showMessage("Control de permisos cargado desde CSV.", true);
    window.setTimeout(() => showMessage("", false), 2200);
  } catch (error) {
    console.error(error);
    showMessage("Error al cargar el control de permisos CSV o las capas del proyecto.", true);
  }
}

zoomAllBtn.addEventListener("click", () => {
  if (parcelPermitsLayer) {
    fitToLayerBounds(parcelPermitsLayer);
  } else if (projectGroup) {
    fitToLayerBounds(projectGroup);
  }
});

zoomProjectBtn.addEventListener("click", () => {
  if (trassenachseBufferLayer) {
    fitToLayerBounds(trassenachseBufferLayer);
  } else if (projectGroup) {
    fitToLayerBounds(projectGroup);
  }
});

map.on("overlayadd", async (event) => {
  try {
    if (event.layer === projectLinesLayer) {
      showMessage("Cargando DXF lineas...", true);
      await ensureDxfLinesLoaded();
      showMessage("", false);
    }
    if (event.layer === projectPolygonsLayer) {
      showMessage("Cargando DXF poligonos...", true);
      await ensureDxfPolygonsLoaded();
      showMessage("", false);
    }
  } catch (error) {
    console.error(error);
    showMessage("Error al cargar capas DXF pesadas.", true);
  }
});

initializeMap();
