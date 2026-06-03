/* Inicialización del mapa MapLibre GL JS */

import { BASEMAPS, DEFAULT_BASEMAP } from './basemaps.js';

/* maplibregl viene del script global cargado en index.html */
/* global maplibregl */

export function initMap() {
  const map = new maplibregl.Map({
    container: 'map',
    style: buildBaseStyle(DEFAULT_BASEMAP),
    center: [-76.10, 3.85],
    zoom: 9,
    maxZoom: 18,
    minZoom: 7,
    attributionControl: false,
    pitchWithRotate: false,
    dragRotate: false,
  });

  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    'bottom-right'
  );

  map.addControl(
    new maplibregl.AttributionControl({ compact: true }),
    'bottom-right'
  );

  return map;
}

export function buildBaseStyle(basemapKey) {
  const bm = BASEMAPS[basemapKey] ?? BASEMAPS[DEFAULT_BASEMAP];

  if (bm.type === 'color') {
    /* Fondo de color sólido — sin tiles externos, sin CORS */
    return {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sprite: '',
      sources: {},
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': bm.color } },
      ],
    };
  }

  /* Basemap raster (OSM, Esri, etc.) */
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sprite: '',
    sources: {
      basemap: {
        type: 'raster',
        tiles: bm.tiles,
        tileSize: bm.tileSize,
        maxzoom: bm.maxzoom,
        attribution: bm.attribution,
      },
    },
    layers: [
      { id: 'basemap-raster', type: 'raster', source: 'basemap' },
    ],
  };
}

export function switchBasemap(map, basemapKey) {
  const bm = BASEMAPS[basemapKey];
  if (!bm) return;

  if (bm.type === 'color') {
    /* Quitar raster si existía, cambiar a fondo de color */
    if (map.getLayer('basemap-raster')) map.removeLayer('basemap-raster');
    if (map.getSource('basemap'))       map.removeSource('basemap');
    if (!map.getLayer('background')) {
      map.addLayer(
        { id: 'background', type: 'background', paint: { 'background-color': bm.color } },
        map.getStyle().layers[0]?.id   // insertar al fondo
      );
    } else {
      map.setPaintProperty('background', 'background-color', bm.color);
    }
    return;
  }

  /* Raster → raster: actualizar o crear fuente */
  if (map.getLayer('background')) map.removeLayer('background');
  if (map.getSource('basemap')) {
    map.getSource('basemap').setTiles(bm.tiles);
  } else {
    map.addSource('basemap', {
      type: 'raster', tiles: bm.tiles, tileSize: bm.tileSize, maxzoom: bm.maxzoom,
    });
    map.addLayer(
      { id: 'basemap-raster', type: 'raster', source: 'basemap' },
      map.getStyle().layers[0]?.id
    );
  }
}
