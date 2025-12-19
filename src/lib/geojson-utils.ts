
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.heat";

export function geoJsonToLeafletLayer(
  geojson: GeoJSON.FeatureCollection,
  options?: {
    colorByConfidence?: boolean;
    onClick?: (props: any) => void;
  }
) {
  return L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      const confidence = feature.properties?.confidence ?? 0;

      let color = "#2ecc71"; // green
      if (options?.colorByConfidence) {
          if (confidence > 0.8) color = "#e74c3c"; // red
          else if (confidence > 0.6) color = "#f1c40f"; // yellow
      } else {
        color = "#3498db"; // blue
      }

      return L.circleMarker(latlng, {
        radius: 8,
        fillColor: color,
        color: "#333",
        weight: 1,
        fillOpacity: 0.85,
      });
    },
    onEachFeature: (feature, layer) => {
      if (options?.onClick) {
        layer.on("click", () => options.onClick!(feature.properties));
      }

      let popupContent = "<strong>Properties:</strong><br/>";
      for (const key in feature.properties) {
          popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br/>`;
      }
      layer.bindPopup(popupContent);
    },
  });
}

export function createHeatmapLayer(features: any[]) {
  const points = features.map(f => [
    f.geometry.coordinates[1], // lat
    f.geometry.coordinates[0], // lng
    f.properties.confidence ?? 0.5
  ]);

  return (L as any).heatLayer(points, {
    radius: 25,
    blur: 20,
    maxZoom: 10,
  });
}

export function createClusterLayer(features: any[]) {
  const clusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 40,
  });

  features.forEach(f => {
    const [lng, lat] = f.geometry.coordinates;
    const marker = L.circleMarker([lat, lng], {
      radius: 7,
      fillColor: "#2980b9",
      fillOpacity: 0.85,
      color: "#fff",
      weight: 1,
    });

    marker.bindPopup(`
      <strong>Cluster:</strong> ${f.properties.clusterId}<br/>
      <strong>Confidence:</strong> ${(f.properties.confidence * 100).toFixed(1)}%
    `);

    clusterGroup.addLayer(marker);
  });

  return clusterGroup;
}
