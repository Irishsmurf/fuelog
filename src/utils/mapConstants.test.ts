import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * mapConstants reads VITE_CARTO_API_KEY at module scope, so each test has to
 * stub the env and then re-import the module to observe the effect.
 */
const loadWithKey = async (key?: string) => {
  vi.resetModules();
  vi.stubEnv('VITE_CARTO_API_KEY', key ?? '');
  return import('./mapConstants');
};

describe('mapConstants', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('with an API key configured', () => {
    it('escapes characters that would otherwise break the query string', async () => {
      const { cartoTransformRequest } = await loadWithKey('a key&b=c');

      const result = cartoTransformRequest('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json');

      expect(new URL(result!.url).searchParams.get('key')).toBe('a key&b=c');
      expect(result?.url).not.toContain('&b=c');
    });

    it('adds the key to CARTO requests via transformRequest', async () => {
      const { cartoTransformRequest } = await loadWithKey('test-key-123');

      const result = cartoTransformRequest(
        'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json'
      );

      expect(result?.url).toBe(
        'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json?key=test-key-123'
      );
    });

    it('preserves existing query params when adding the key', async () => {
      const { cartoTransformRequest } = await loadWithKey('test-key-123');

      const result = cartoTransformRequest(
        'https://tiles.basemaps.cartocdn.com/fonts/Open%20Sans/0-255.pbf?v=2'
      );

      expect(result?.url).toContain('v=2');
      expect(result?.url).toContain('key=test-key-123');
    });

    it('leaves non-CARTO requests untouched', async () => {
      const { cartoTransformRequest } = await loadWithKey('test-key-123');

      expect(cartoTransformRequest('https://example.com/tiles/1.png')).toBeUndefined();
    });

    // The style document is fetched remotely and dictates the source, glyph and
    // sprite URLs, so a host that merely mentions CARTO must not be handed the
    // key. A substring test on the whole URL would leak it to all of these.
    it.each([
      'https://evil.example/?redirect=cartocdn.com',
      'https://evil.example/cartocdn.com/tile.png',
      'https://cartocdn.com.evil.example/tile.png',
      'https://notcartocdn.com/tile.png',
      'https://evil.example/#cartocdn.com',
    ])('does not attach the key to %s', async (url) => {
      const { cartoTransformRequest } = await loadWithKey('test-key-123');

      expect(cartoTransformRequest(url)).toBeUndefined();
    });

    it('keys CARTO subdomains', async () => {
      const { cartoTransformRequest } = await loadWithKey('test-key-123');

      expect(cartoTransformRequest('https://tiles-a.basemaps.cartocdn.com/x.mvt')?.url).toContain(
        'key=test-key-123'
      );
    });

    it('ignores malformed URLs rather than throwing', async () => {
      const { cartoTransformRequest } = await loadWithKey('test-key-123');

      expect(() => cartoTransformRequest('not a url')).not.toThrow();
      expect(cartoTransformRequest('not a url')).toBeUndefined();
    });
  });

  describe('without an API key', () => {
    it('leaves CARTO requests untouched so vector still renders', async () => {
      const { cartoTransformRequest } = await loadWithKey(undefined);

      expect(
        cartoTransformRequest('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json')
      ).toBeUndefined();
    });
  });

  it('points the vector styles at Positron and Dark Matter', async () => {
    const { MAP_STYLES } = await loadWithKey('test-key-123');

    expect(MAP_STYLES.light).toBe('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json');
    expect(MAP_STYLES.dark).toBe('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json');
  });

  it('credits both OpenStreetMap and CARTO, as the free tier requires', async () => {
    const { MAP_ATTRIBUTION } = await loadWithKey('test-key-123');

    expect(MAP_ATTRIBUTION).toContain('OpenStreetMap');
    expect(MAP_ATTRIBUTION).toContain('CARTO');
  });

  describe('station markers', () => {
    it('renders an amber marker for a known station and grey for an unassigned one', async () => {
      const { stationMarkerSvg, STATION_COLOR, UNASSIGNED_STATION_COLOR } = await loadWithKey(undefined);

      expect(stationMarkerSvg(false)).toContain(`fill="${STATION_COLOR}"`);
      expect(stationMarkerSvg(true)).toContain(`fill="${UNASSIGNED_STATION_COLOR}"`);
    });

    it('declares the requested pixel size, for high-DPI style images', async () => {
      const { stationMarkerSvg, STATION_MARKER_SIZE } = await loadWithKey(undefined);

      expect(stationMarkerSvg(false)).toContain(`width="${STATION_MARKER_SIZE}"`);
      expect(stationMarkerSvg(false, 56)).toContain('width="56" height="56"');
    });

    it('builds a DOM element holding the marker SVG', async () => {
      const { createStationMarkerElement, STATION_MARKER_SIZE } = await loadWithKey(undefined);

      const el = createStationMarkerElement();
      expect(el.className).toBe('fuelog-station-marker');
      expect(el.style.width).toBe(`${STATION_MARKER_SIZE}px`);
      expect(el.querySelector('svg')).not.toBeNull();
    });
  });
});
