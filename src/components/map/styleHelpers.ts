import type { Map as MapLibreMap } from 'maplibre-gl';
import { STATION_MARKER_SIZE, stationMarkerSvg } from '../../utils/mapConstants';

export const STATION_IMAGE = 'fuelog-station';
export const UNASSIGNED_STATION_IMAGE = 'fuelog-station-unassigned';

const IMAGE_PIXEL_RATIO = 2;

const loadSvg = (svg: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode station marker image'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

/**
 * Registers the station marker icons as style images, for use as a symbol
 * layer's `icon-image`. Rendered at 2x so they stay crisp on high-DPI screens.
 * Images belong to the style, so this has to run again after a style swap.
 */
export async function addStationImages(map: MapLibreMap): Promise<void> {
  const size = STATION_MARKER_SIZE * IMAGE_PIXEL_RATIO;
  const [assigned, unassigned] = await Promise.all([
    loadSvg(stationMarkerSvg(false, size)),
    loadSvg(stationMarkerSvg(true, size)),
  ]);
  if (!map.hasImage(STATION_IMAGE)) map.addImage(STATION_IMAGE, assigned, { pixelRatio: IMAGE_PIXEL_RATIO });
  if (!map.hasImage(UNASSIGNED_STATION_IMAGE)) {
    map.addImage(UNASSIGNED_STATION_IMAGE, unassigned, { pixelRatio: IMAGE_PIXEL_RATIO });
  }
}

const EXPRESSION_OPERATORS = new Set(['literal', 'get', 'case', 'match', 'step', 'coalesce', 'interpolate', 'to-string']);

/**
 * A font stack the basemap's glyph server is known to serve, taken from one of
 * the style's own symbol layers. Text in a layer we add has to name a font the
 * style's `glyphs` endpoint has, and hard-coding one would break silently the
 * day CARTO renames its fonts. Undefined when the style has no usable label.
 */
export function findStyleFont(map: MapLibreMap): string[] | undefined {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const font = layer.layout?.['text-font'];
    // A plain array of names, not an expression such as ["get", "font"].
    if (
      Array.isArray(font) && font.length > 0 &&
      font.every((f) => typeof f === 'string') &&
      !EXPRESSION_OPERATORS.has(font[0] as string)
    ) {
      return font as string[];
    }
  }
  return undefined;
}
