import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { MockMap } from '../../test/maplibreMock';
import { STATION_IMAGE, UNASSIGNED_STATION_IMAGE, addStationImages, findStyleFont } from './styleHelpers';

const asMap = (m: MockMap) => m as unknown as MapLibreMap;

describe('findStyleFont', () => {
  it("returns the first literal font stack among the basemap's symbol layers", () => {
    const map = new MockMap({});
    map.styleLayers = [
      { id: 'water', type: 'fill' },
      { id: 'expr', type: 'symbol', layout: { 'text-font': ['get', 'font'] } },
      { id: 'roads', type: 'symbol', layout: { 'text-font': ['Montserrat Medium', 'Open Sans Bold'] } },
      { id: 'places', type: 'symbol', layout: { 'text-font': ['Open Sans Regular'] } },
    ];
    expect(findStyleFont(asMap(map))).toEqual(['Montserrat Medium', 'Open Sans Bold']);
  });

  it('returns undefined when no layer names a font', () => {
    const map = new MockMap({});
    map.styleLayers = [{ id: 'water', type: 'fill' }, { id: 'icons', type: 'symbol', layout: {} }];
    expect(findStyleFont(asMap(map))).toBeUndefined();
  });
});

describe('addStationImages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('decodes both marker variants and registers them at 2x', async () => {
    const sources: string[] = [];
    // jsdom never decodes images; complete the load as soon as src is set.
    class LoadingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        sources.push(value);
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', LoadingImage);
    const map = new MockMap({});
    const addImage = vi.spyOn(map, 'addImage');

    await addStationImages(asMap(map));

    expect(sources).toHaveLength(2);
    expect(sources.every((s) => s.startsWith('data:image/svg+xml'))).toBe(true);
    expect(decodeURIComponent(sources[0])).toContain('width="56"');
    expect(addImage).toHaveBeenCalledWith(STATION_IMAGE, expect.any(LoadingImage), { pixelRatio: 2 });
    expect(addImage).toHaveBeenCalledWith(UNASSIGNED_STATION_IMAGE, expect.any(LoadingImage), { pixelRatio: 2 });
  });

  it('does not re-register images the style already has', async () => {
    class LoadingImage {
      onload: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', LoadingImage);
    const map = new MockMap({});
    map.addImage(STATION_IMAGE);
    map.addImage(UNASSIGNED_STATION_IMAGE);
    const addImage = vi.spyOn(map, 'addImage');

    await addStationImages(asMap(map));

    expect(addImage).not.toHaveBeenCalled();
  });
});
