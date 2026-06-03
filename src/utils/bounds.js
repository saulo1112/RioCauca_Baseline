/* Utilidades de bounding box para GeoJSON */

export function geojsonBbox(geojson) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  function walk(coords) {
    if (typeof coords[0] === 'number') {
      if (coords[0] < minX) minX = coords[0];
      if (coords[0] > maxX) maxX = coords[0];
      if (coords[1] < minY) minY = coords[1];
      if (coords[1] > maxY) maxY = coords[1];
    } else {
      coords.forEach(walk);
    }
  }

  const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
  features.forEach(f => {
    if (f.geometry?.coordinates) walk(f.geometry.coordinates);
  });

  return [minX, minY, maxX, maxY]; // [west, south, east, north]
}

export function mergeBboxes(bboxes) {
  return bboxes.reduce(
    ([w, s, e, n], [bw, bs, be, bn]) => [
      Math.min(w, bw), Math.min(s, bs),
      Math.max(e, be), Math.max(n, bn),
    ],
    [Infinity, Infinity, -Infinity, -Infinity]
  );
}
