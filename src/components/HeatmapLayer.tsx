import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

interface HeatmapLayerProps {
  points: Array<[number, number, number]>;
  options?: L.HeatMapOptions;
}

const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ points, options }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const defaultOptions: L.HeatMapOptions = { radius: 25, blur: 15, maxZoom: 14, ...options };
    
    const heatLayer = L.heatLayer(points, defaultOptions).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points, options]);

  return null;
};

export default HeatmapLayer;
