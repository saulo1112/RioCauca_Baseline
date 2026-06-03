/* Definición de mapas base — intercambiables sin recargar capas temáticas */

export const BASEMAPS = {
  positron: {
    label: 'Claro',
    type: 'raster',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 19,
    attribution: '© <a href="https://osm.org/copyright">OpenStreetMap contributors</a>',
  },
  satellite: {
    label: 'Satélite',
    type: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Tiles © Esri — Esri, DigitalGlobe, GeoEye, USDA, USGS',
  },
};

export const DEFAULT_BASEMAP = 'positron';
