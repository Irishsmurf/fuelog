/**
 * A stand-in for `maplibre-gl` in tests: jsdom has no WebGL, so the real
 * library cannot construct a map. Use it with
 *
 *   vi.mock('maplibre-gl', () => import('../test/maplibreMock'));
 *
 * Every Map, Marker and Popup created is recorded so tests can drive events
 * (`map.fire('click', { lngLat })`, `marker.fire('dragend')`) and inspect what
 * the component asked MapLibre to do.
 */
import { vi } from 'vitest';

type Handler = (event: Record<string, unknown>) => unknown;

class Evented {
  private handlers: { type: string; layer?: string; fn: Handler }[] = [];

  on(type: string, layerOrFn: string | Handler, maybeFn?: Handler) {
    if (typeof layerOrFn === 'function') this.handlers.push({ type, fn: layerOrFn });
    else this.handlers.push({ type, layer: layerOrFn, fn: maybeFn! });
    return this;
  }

  off(type: string, layerOrFn: string | Handler, maybeFn?: Handler) {
    const layer = typeof layerOrFn === 'string' ? layerOrFn : undefined;
    const fn = typeof layerOrFn === 'function' ? layerOrFn : maybeFn;
    this.handlers = this.handlers.filter(h => !(h.type === type && h.layer === layer && h.fn === fn));
    return this;
  }

  /** Fires `type`, optionally only to listeners scoped to `layer`. Returns handler results. */
  fire(type: string, event: Record<string, unknown> = {}, layer?: string): unknown[] {
    return this.handlers
      .filter(h => h.type === type && h.layer === layer)
      .map(h => h.fn({ type, ...event }));
  }

  listenerCount(type: string, layer?: string): number {
    return this.handlers.filter(h => h.type === type && h.layer === layer).length;
  }
}

export class LngLatBounds {
  sw: [number, number];
  ne: [number, number];
  constructor(sw: [number, number], ne: [number, number]) {
    this.sw = [...sw];
    this.ne = [...ne];
  }
  extend([lng, lat]: [number, number]) {
    this.sw = [Math.min(this.sw[0], lng), Math.min(this.sw[1], lat)];
    this.ne = [Math.max(this.ne[0], lng), Math.max(this.ne[1], lat)];
    return this;
  }
  contains([lng, lat]: [number, number]) {
    return lng >= this.sw[0] && lng <= this.ne[0] && lat >= this.sw[1] && lat <= this.ne[1];
  }
}

export class GeoJSONSourceMock {
  spec: Record<string, unknown>;
  data: unknown;
  setData = vi.fn((data: unknown) => {
    this.data = data;
    return Promise.resolve();
  });
  getClusterExpansionZoom = vi.fn(() => Promise.resolve(12));
  constructor(spec: Record<string, unknown>) {
    this.spec = spec;
    this.data = spec.data;
  }
}

export const mapInstances: MockMap[] = [];
export const markerInstances: Marker[] = [];
export const popupInstances: Popup[] = [];

export class MockMap extends Evented {
  options: Record<string, unknown>;
  sources = new Map<string, GeoJSONSourceMock>();
  layers = new Map<string, Record<string, unknown>>();
  images = new Set<string>();
  controls: { control: unknown; position?: string }[] = [];
  /** The basemap's own layers, as getStyle() reports them. */
  styleLayers: Record<string, unknown>[] = [
    { id: 'place_label', type: 'symbol', layout: { 'text-font': ['Open Sans Regular'] } },
  ];
  removed = false;
  zoom: number;
  center: [number, number];
  /** What getBounds() reports as visible. */
  visibleBounds = new LngLatBounds([0, 0], [0, 0]);
  canvas = { style: {} as Record<string, string> };

  setStyle = vi.fn();
  fitBounds = vi.fn();
  easeTo = vi.fn();
  flyTo = vi.fn();
  jumpTo = vi.fn((opts: { center?: [number, number]; zoom?: number }) => {
    if (opts.center) this.center = opts.center;
    if (opts.zoom !== undefined) this.zoom = opts.zoom;
  });
  setLayoutProperty = vi.fn((id: string, name: string, value: unknown) => {
    const layer = this.layers.get(id);
    if (layer) layer.layout = { ...(layer.layout as object), [name]: value };
  });

  constructor(options: Record<string, unknown>) {
    super();
    this.options = options;
    this.zoom = options.zoom as number;
    this.center = options.center as [number, number];
    mapInstances.push(this);
  }

  addControl(control: unknown, position?: string) {
    this.controls.push({ control, position });
    return this;
  }
  removeControl(control: unknown) {
    this.controls = this.controls.filter(c => c.control !== control);
    return this;
  }
  addSource(id: string, spec: Record<string, unknown>) {
    this.sources.set(id, new GeoJSONSourceMock(spec));
    return this;
  }
  getSource(id: string) {
    return this.sources.get(id);
  }
  addLayer(layer: Record<string, unknown>) {
    this.layers.set(layer.id as string, layer);
    return this;
  }
  getLayer(id: string) {
    return this.layers.get(id);
  }
  getLayoutProperty(id: string, name: string) {
    return (this.layers.get(id)?.layout as Record<string, unknown> | undefined)?.[name];
  }
  hasImage(id: string) {
    return this.images.has(id);
  }
  addImage(id: string) {
    this.images.add(id);
  }
  getStyle() {
    return { layers: this.styleLayers };
  }
  getBounds() {
    return this.visibleBounds;
  }
  getZoom() {
    return this.zoom;
  }
  getCanvas() {
    return this.canvas;
  }
  remove() {
    this.removed = true;
  }

  /**
   * Simulates a basemap style finishing loading. A real style swap replaces
   * the whole style, so sources, layers and images go with it.
   */
  loadStyle({ replace = false } = {}) {
    if (replace) {
      this.sources.clear();
      this.layers.clear();
      this.images.clear();
    }
    return this.fire('style.load');
  }
}

export { MockMap as Map };

export class Marker extends Evented {
  options: Record<string, unknown>;
  lngLat: { lng: number; lat: number } | null = null;
  map: MockMap | null = null;
  popup: Popup | null = null;
  removed = false;

  constructor(options: Record<string, unknown> = {}) {
    super();
    this.options = options;
    markerInstances.push(this);
  }
  setLngLat([lng, lat]: [number, number]) {
    this.lngLat = { lng, lat };
    return this;
  }
  getLngLat() {
    return this.lngLat!;
  }
  addTo(map: MockMap) {
    this.map = map;
    this.removed = false;
    return this;
  }
  setPopup(popup: Popup) {
    this.popup = popup;
    return this;
  }
  togglePopup() {
    return this;
  }
  remove() {
    this.removed = true;
    this.map = null;
    return this;
  }
}

export class Popup extends Evented {
  options: Record<string, unknown>;
  lngLat: [number, number] | null = null;
  content: HTMLElement | null = null;
  text: string | null = null;
  isOpen = false;

  constructor(options: Record<string, unknown> = {}) {
    super();
    this.options = options;
    popupInstances.push(this);
  }
  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat;
    return this;
  }
  setDOMContent(el: HTMLElement) {
    this.content = el;
    return this;
  }
  setText(text: string) {
    this.text = text;
    return this;
  }
  addTo() {
    this.isOpen = true;
    // Mounted in the document so tests can query what renders inside it.
    if (this.content) document.body.appendChild(this.content);
    return this;
  }
  remove() {
    if (!this.isOpen) return this;
    this.isOpen = false;
    this.content?.remove();
    this.fire('close');
    return this;
  }
}

export class NavigationControl {
  options: Record<string, unknown>;
  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
  }
}

/**
 * Worker URLs maplibre was pointed at. A plain array rather than a vi.fn():
 * the call happens at module evaluation, before the test runner clears mocks.
 */
export const workerUrls: string[] = [];
export const setWorkerUrl = (url: string) => {
  workerUrls.push(url);
};

/** Forget every recorded instance; call from beforeEach. */
export function resetMapLibreMock() {
  mapInstances.length = 0;
  markerInstances.length = 0;
  popupInstances.length = 0;
}
