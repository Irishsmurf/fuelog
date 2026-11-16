import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

// maplibre-gl derives its worker URL at runtime by string-manipulating
// import.meta.url into a sibling "maplibre-gl-worker.mjs". No bundler can see
// that statically, so the file is never emitted and the request 404s — which
// this app's SPA rewrite answers with index.html, failing the module's MIME
// check (#247). Point maplibre at a worker Vite actually bundles instead.
//
// Every map component imports maplibre through this module so the worker is
// configured before the first `new maplibregl.Map`.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

export default maplibregl;
