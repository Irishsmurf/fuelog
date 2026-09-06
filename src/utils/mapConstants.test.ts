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
    it('appends the key to the raster tile URLs as ?key=', async () => {
      const { MAP_TILES } = await loadWithKey('test-key-123');

      expect(MAP_TILES.light).toBe(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=test-key-123'
      );
      expect(MAP_TILES.dark).toBe(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=test-key-123'
      );
    });

    it('leaves Leaflet URL placeholders unescaped', async () => {
      const { MAP_TILES } = await loadWithKey('test-key-123');

      // A URL-encoding pass would turn these into %7Bs%7D and silently break
      // subdomain sharding and tile addressing.
      expect(MAP_TILES.light).toContain('{s}');
      expect(MAP_TILES.light).toContain('{z}/{x}/{y}{r}');
    });

    it('escapes characters that would otherwise break the query string', async () => {
      const { MAP_TILES } = await loadWithKey('a key&b=c');

      expect(MAP_TILES.light).toContain('?key=a%20key%26b%3Dc');
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
  });

  describe('without an API key', () => {
    it('falls back to the keyless raster URLs', async () => {
      const { MAP_TILES } = await loadWithKey(undefined);

      expect(MAP_TILES.light).toBe(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      );
      expect(MAP_TILES.light).not.toContain('key=');
    });

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
    const { MAP_ATTRIBUTION, MAP_TILES } = await loadWithKey('test-key-123');

    expect(MAP_ATTRIBUTION).toContain('OpenStreetMap');
    expect(MAP_ATTRIBUTION).toContain('CARTO');
    expect(MAP_TILES.attribution).toBe(MAP_ATTRIBUTION);
  });
});
