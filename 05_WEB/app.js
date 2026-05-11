const CATASTRO_WMS_URL = "";
const CATASTRO_WMS_LAYER_NAME = "";
const NATURSCHUTZ_WMS_URL = "";
const NATURSCHUTZ_WMS_LAYER_NAMES = "";

const STATUS_COLORS = {
  APPROVED: "#2ecc71",
  PENDING: "#f1c40f",
  REJECTED: "#e74c3c",
  CONDITIONAL: "#e67e22",
  UNKNOWN: "#95a5a6"
};

const VALID_STATUSES = ["APPROVED", "PENDING", "REJECTED", "CONDITIONAL", "UNKNOWN"];
const GEOJSON_PATH = "./data/wegebau_status.geojson";
const PROJECT_DXF_LINES_PATH = "./data/project_dxf_lineas.geojson";
const PROJECT_DXF_POLYGONS_PATH = "./data/project_dxf_poligonos.geojson";
const TRASSENACHSE_PATH = "./data/trassenachse_gesamt.geojson";
const TRASSENACHSE_BUFFER_PATH = "./data/trassenachse_gesamt_buffer_500m.geojson";

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
  APPROVED: document.getElementById("countApproved"),
  PENDING: document.getElementById("countPending"),
  REJECTED: document.getElementById("countRejected"),
  CONDITIONAL: document.getElementById("countConditional"),
  UNKNOWN: document.getElementById("countUnknown")
};

const map = L.map("map", {
  zoomControl: true
}).setView([52.05, 8.65], 11);

const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const satelliteLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 20,
    attribution: "Tiles &copy; Esri"
  }
);

function createWmsLayer(url, layerNames, attribution, opacity = 0.55) {
  if (!url || !layerNames) {
    return null;
  }

  return L.tileLayer.wms(url, {
    layers: layerNames,
    format: "image/png",
    transparent: true,
    opacity,
    attribution
  });
}

const cadastralWmsLayer = createWmsLayer(
  CATASTRO_WMS_URL,
  CATASTRO_WMS_LAYER_NAME,
  "WMS Catastro",
  0.58
);
const naturschutzWmsLayer = createWmsLayer(
  NATURSCHUTZ_WMS_URL,
  NATURSCHUTZ_WMS_LAYER_NAMES,
  "WMS Naturschutz",
  0.62
);

const overlayLayers = {};
if (cadastralWmsLayer) {
  cadastralWmsLayer.addTo(map);
  overlayLayers["Catastro corredor 500m"] = cadastralWmsLayer;
}
if (naturschutzWmsLayer) {
  naturschutzWmsLayer.addTo(map);
  overlayLayers["Naturschutz corredor 500m"] = naturschutzWmsLayer;
}

const overlayControl = L.control.layers(
  {
    OpenStreetMap: osmLayer,
    "Esri Satelite": satelliteLayer
  },
  overlayLayers,
  { collapsed: false }
).addTo(map);

let sourceFeatures = [];
let currentLayer = null;
let currentVisibleFeatures = [];
let trassenachseLayer = null;
let trassenachseBufferLayer = null;
let projectLinesLayer = null;
let projectPolygonsLayer = null;
let projectGroup = null;

function showMessage(message, isVisible = true) {
  mapMessage.textContent = message;
  mapMessage.hidden = !isVisible;
}

function normalizeStatus(status) {
  return VALID_STATUSES.includes(status) ? status : "UNKNOWN";
}

function getFeatureColor(feature) {
  return STATUS_COLORS[normalizeStatus(feature.properties?.status)];
}

function createPopupValue(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function createPermitLink(permitRef) {
  const value = createPopupValue(permitRef);
  if (value === "-") {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return `<a href="${value}" target="_blank" rel="noopener noreferrer">Abrir documento de permiso</a>`;
  }

  return value;
}

function buildPopupContent(properties) {
  const popupFields = [
    ["uid", createPopupValue(properties.uid)],
    ["project", createPopupValue(properties.project)],
    ["section", createPopupValue(properties.section)],
    ["mast", createPopupValue(properties.mast)],
    ["parcel_id", createPopupValue(properties.parcel_id)],
    ["type", createPopupValue(properties.type)],
    ["status", createPopupValue(properties.status)],
    ["owner_ref", createPopupValue(properties.owner_ref)],
    ["permit_ref", createPermitLink(properties.permit_ref)],
    ["date_req", createPopupValue(properties.date_req)],
    ["date_ok", createPopupValue(properties.date_ok)],
    ["comment", createPopupValue(properties.comment)]
  ];

  return `
    <div class="popup-grid">
      ${popupFields
        .map(([label, value]) => `<div><strong>${label}</strong><span>${value}</span></div>`)
        .join("")}
    </div>
  `;
}

function styleFeature(feature) {
  return {
    color: "#4c5d68",
    weight: 1.4,
    fillColor: getFeatureColor(feature),
    fillOpacity: 0.65
  };
}

function onEachFeature(feature, layer) {
  layer.bindPopup(buildPopupContent(feature.properties || {}));
}

function extractUniqueValues(features, key) {
  return [...new Set(features.map((feature) => createPopupValue(feature.properties?.[key])).filter((value) => value !== "-"))]
    .sort((a, b) => a.localeCompare(b, "es"));
}

function populateSelect(selectElement, values) {
  const selectedValue = selectElement.value || "ALL";
  selectElement.innerHTML = '<option value="ALL">Todos</option>';

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });

  if ([...selectElement.options].some((option) => option.value === selectedValue)) {
    selectElement.value = selectedValue;
  }
}

function populateFilters(features) {
  populateSelect(statusFilter, VALID_STATUSES);
  populateSelect(sectionFilter, extractUniqueValues(features, "section"));
  populateSelect(mastFilter, extractUniqueValues(features, "mast"));
}

function featureMatchesFilters(feature) {
  const properties = feature.properties || {};
  const status = normalizeStatus(properties.status);
  const section = createPopupValue(properties.section);
  const mast = createPopupValue(properties.mast);
  const searchTerm = searchInput.value.trim().toLowerCase();

  const matchesStatus = statusFilter.value === "ALL" || status === statusFilter.value;
  const matchesSection = sectionFilter.value === "ALL" || section === sectionFilter.value;
  const matchesMast = mastFilter.value === "ALL" || mast === mastFilter.value;

  const searchableFields = [
    createPopupValue(properties.uid),
    createPopupValue(properties.parcel_id),
    createPopupValue(properties.comment)
  ].join(" ").toLowerCase();

  const matchesSearch = !searchTerm || searchableFields.includes(searchTerm);

  return matchesStatus && matchesSection && matchesMast && matchesSearch;
}

function updateCounters(features) {
  const counts = {
    total: features.length,
    APPROVED: 0,
    PENDING: 0,
    REJECTED: 0,
    CONDITIONAL: 0,
    UNKNOWN: 0
  };

  features.forEach((feature) => {
    counts[normalizeStatus(feature.properties?.status)] += 1;
  });

  counters.total.textContent = counts.total;
  VALID_STATUSES.forEach((status) => {
    counters[status].textContent = counts[status];
  });
}

function fitToLayerBounds(layer) {
  const bounds = layer.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [20, 20] });
  }
}

function axisStyle() {
  return {
    color: "#1f4e79",
    weight: 3.4,
    opacity: 1
  };
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
  return {
    color: "#154360",
    weight: 1.7,
    opacity: 0.9
  };
}

function projectPolygonStyle() {
  return {
    color: "#d35400",
    weight: 1.1,
    fillColor: "#f39c12",
    fillOpacity: 0.18
  };
}

function bindProjectPopup(feature, layer, label) {
  const properties = feature.properties || {};
  const propertyEntries = Object.entries(properties).slice(0, 8);
  const detailHtml = propertyEntries.length
    ? propertyEntries
        .map(([key, value]) => `<div><strong>${key}</strong><span>${createPopupValue(value)}</span></div>`)
        .join("")
    : '<div><strong>detalle</strong><span>Sin atributos relevantes</span></div>';

  layer.bindPopup(`
    <div class="popup-grid">
      <div><strong>capa</strong><span>${label}</span></div>
      ${detailHtml}
    </div>
  `);
}

async function loadProjectLayers() {
  const [linesResponse, polygonsResponse, axisResponse, bufferResponse] = await Promise.all([
    fetch(PROJECT_DXF_LINES_PATH),
    fetch(PROJECT_DXF_POLYGONS_PATH),
    fetch(TRASSENACHSE_PATH),
    fetch(TRASSENACHSE_BUFFER_PATH)
  ]);

  if (!linesResponse.ok || !polygonsResponse.ok || !axisResponse.ok || !bufferResponse.ok) {
    throw new Error("No se pudieron cargar las capas exportadas del proyecto QGIS.");
  }

  const [linesGeoJson, polygonsGeoJson, axisGeoJson, bufferGeoJson] = await Promise.all([
    linesResponse.json(),
    polygonsResponse.json(),
    axisResponse.json(),
    bufferResponse.json()
  ]);

  trassenachseBufferLayer = L.geoJSON(bufferGeoJson, {
    style: bufferStyle,
    onEachFeature: (feature, layer) => bindProjectPopup(feature, layer, "Trassenachse Buffer 500m")
  }).addTo(map);

  trassenachseLayer = L.geoJSON(axisGeoJson, {
    style: axisStyle,
    onEachFeature: (feature, layer) => bindProjectPopup(feature, layer, "Trassenachse Gesamt")
  }).addTo(map);

  projectLinesLayer = L.geoJSON(linesGeoJson, {
    style: projectLineStyle,
    onEachFeature: (feature, layer) => bindProjectPopup(feature, layer, "DXF lineas")
  }).addTo(map);

  projectPolygonsLayer = L.geoJSON(polygonsGeoJson, {
    style: projectPolygonStyle,
    onEachFeature: (feature, layer) => bindProjectPopup(feature, layer, "DXF poligonos")
  }).addTo(map);

  projectGroup = L.featureGroup([
    trassenachseBufferLayer,
    trassenachseLayer,
    projectLinesLayer,
    projectPolygonsLayer
  ]);

  overlayControl.addOverlay(trassenachseBufferLayer, "Corredor 500m");
  overlayControl.addOverlay(trassenachseLayer, "Trassenachse Gesamt");
  overlayControl.addOverlay(projectLinesLayer, "Proyecto QGIS - DXF lineas");
  overlayControl.addOverlay(projectPolygonsLayer, "Proyecto QGIS - DXF poligonos");
}

function renderFeatures(features, shouldFitBounds = false) {
  currentVisibleFeatures = features;

  if (currentLayer) {
    overlayControl.removeLayer(currentLayer);
    map.removeLayer(currentLayer);
  }

  currentLayer = L.geoJSON(features, {
    style: styleFeature,
    onEachFeature
  }).addTo(map);

  overlayControl.addOverlay(currentLayer, "Wegebau / Permisos");
  updateCounters(features);

  if (features.length > 0) {
    showMessage(`Mostrando ${features.length} poligonos.`, true);
    window.setTimeout(() => showMessage("", false), 1800);
    if (shouldFitBounds) {
      fitToLayerBounds(currentLayer);
    }
  } else {
    showMessage("No hay poligonos que cumplan los filtros.", true);
  }
}

function applyFilters(shouldFitBounds = false) {
  const filteredFeatures = sourceFeatures.filter(featureMatchesFilters);
  renderFeatures(filteredFeatures, shouldFitBounds);
}

function resetFilters() {
  statusFilter.value = "ALL";
  sectionFilter.value = "ALL";
  mastFilter.value = "ALL";
  searchInput.value = "";
  applyFilters(true);
}

async function loadGeoJson() {
  showMessage("Cargando datos GIS...", true);

  try {
    const response = await fetch(GEOJSON_PATH);
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${GEOJSON_PATH}: ${response.status}`);
    }

    const geojson = await response.json();
    sourceFeatures = Array.isArray(geojson.features) ? geojson.features : [];

    await loadProjectLayers();
    populateFilters(sourceFeatures);
    applyFilters(true);
  } catch (error) {
    console.error(error);
    showMessage("Error al cargar el GeoJSON. Revisa Live Server y la ruta de datos.", true);
  }
}

statusFilter.addEventListener("change", () => applyFilters());
sectionFilter.addEventListener("change", () => applyFilters());
mastFilter.addEventListener("change", () => applyFilters());
searchInput.addEventListener("input", () => applyFilters());
resetFiltersBtn.addEventListener("click", resetFilters);
zoomAllBtn.addEventListener("click", () => {
  if (currentLayer && currentVisibleFeatures.length > 0) {
    fitToLayerBounds(currentLayer);
  }
});
zoomProjectBtn.addEventListener("click", () => {
  if (trassenachseBufferLayer) {
    fitToLayerBounds(trassenachseBufferLayer);
  } else if (projectGroup) {
    fitToLayerBounds(projectGroup);
  }
});

loadGeoJson();
