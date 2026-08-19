import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { PMTiles, Protocol, TileType } from 'pmtiles';
import type { FamilyLocationView } from '@ppt/domain';
import 'maplibre-gl/dist/maplibre-gl.css';

const OFFLINE_MAP_URL = 'pardus-app://renderer/offline-map/turkiye.pmtiles';
const DEFAULT_CENTER: [number, number] = [35.2, 39.0];
const offlineProtocol = new Protocol({ metadata: true, errorOnMissingTile: false });
let protocolConfigured = false;

function configureMapRuntime(): void {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
  if (!protocolConfigured) {
    maplibregl.addProtocol('pmtiles', offlineProtocol.tile);
    protocolConfigured = true;
  }
}

function isMappable(location: FamilyLocationView): location is FamilyLocationView & { latitude: number; longitude: number } {
  return Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && (location.latitude as number) >= -90
    && (location.latitude as number) <= 90
    && (location.longitude as number) >= -180
    && (location.longitude as number) <= 180;
}

function coordinateGrid() {
  const features: Array<{ type: 'Feature'; properties: Record<string, never>; geometry: { type: 'LineString'; coordinates: number[][] } }> = [];
  for (let longitude = 24; longitude <= 46; longitude += 2) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[longitude, 34], [longitude, 44]] } });
  }
  for (let latitude = 34; latitude <= 44; latitude += 2) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[24, latitude], [46, latitude]] } });
  }
  return { type: 'FeatureCollection', features };
}

function baseStyle(packageKind: 'vector' | 'raster' | 'none'): StyleSpecification {
  const sources: StyleSpecification['sources'] = {
    'coordinate-grid': { type: 'geojson', data: coordinateGrid() }
  };
  const layers: StyleSpecification['layers'] = [
    { id: 'local-background', type: 'background', paint: { 'background-color': '#ede7dd' } }
  ];
  if (packageKind !== 'none') {
    sources['offline-turkiye'] = packageKind === 'vector'
      ? { type: 'vector', url: `pmtiles://${OFFLINE_MAP_URL}`, attribution: '© OpenStreetMap katkıda bulunanlar' }
      : { type: 'raster', url: `pmtiles://${OFFLINE_MAP_URL}`, tileSize: 256, attribution: '© OpenStreetMap katkıda bulunanlar' };
    if (packageKind === 'raster') {
      layers.push({ id: 'offline-raster', type: 'raster', source: 'offline-turkiye' });
    } else {
      layers.push(
        { id: 'offline-earth', type: 'fill', source: 'offline-turkiye', 'source-layer': 'earth', paint: { 'fill-color': '#e9e0d2' } },
        { id: 'offline-landuse', type: 'fill', source: 'offline-turkiye', 'source-layer': 'landuse', paint: { 'fill-color': '#dce4d1', 'fill-opacity': 0.72 } },
        { id: 'offline-water', type: 'fill', source: 'offline-turkiye', 'source-layer': 'water', paint: { 'fill-color': '#a9c9d8' } },
        { id: 'offline-boundaries', type: 'line', source: 'offline-turkiye', 'source-layer': 'boundaries', paint: { 'line-color': '#a48c74', 'line-width': 0.8, 'line-opacity': 0.65 } },
        { id: 'offline-roads', type: 'line', source: 'offline-turkiye', 'source-layer': 'roads', paint: { 'line-color': '#ffffff', 'line-width': 1.25, 'line-opacity': 0.86 } }
      );
    }
  }
  layers.push({
    id: 'coordinate-grid-lines',
    type: 'line',
    source: 'coordinate-grid',
    paint: { 'line-color': '#9c7a58', 'line-width': 0.7, 'line-opacity': packageKind === 'none' ? 0.34 : 0.12 }
  });
  return { version: 8, sources, layers };
}

type MapStatus = 'loading' | 'offline-package' | 'coordinate-fallback' | 'unavailable';

export function FamilyLocationMap({ locations }: { readonly locations: readonly FamilyLocationView[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<MapStatus>('loading');
  const mappableLocations = useMemo(() => locations.filter(isMappable), [locations]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let map: maplibregl.Map | undefined;

    const start = async (): Promise<void> => {
      configureMapRuntime();
      let packageKind: 'vector' | 'raster' | 'none' = 'none';
      try {
        const packageFile = new PMTiles(OFFLINE_MAP_URL);
        const header = await packageFile.getHeader();
        if (cancelled) return;
        if (header.tileType === TileType.Mvt) packageKind = 'vector';
        else if ([TileType.Png, TileType.Jpeg, TileType.Webp, TileType.Avif].includes(header.tileType)) packageKind = 'raster';
        else throw new Error('Desteklenmeyen çevrimdışı harita paket türü.');
        offlineProtocol.add(packageFile);
      } catch {
        packageKind = 'none';
      }

      try {
        map = new maplibregl.Map({
          container,
          style: baseStyle(packageKind),
          center: DEFAULT_CENTER,
          zoom: 4.4,
          minZoom: 2.5,
          maxZoom: 18,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        const bounds = new maplibregl.LngLatBounds();
        for (const location of mappableLocations) {
          const markerElement = document.createElement('button');
          markerElement.type = 'button';
          markerElement.className = 'family-map-marker';
          markerElement.setAttribute('aria-label', `${location.label} konumunu göster`);
          const markerGlyph = document.createElement('span');
          markerGlyph.textContent = '⌖';
          markerElement.append(markerGlyph);
          const popupBody = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = location.label;
          const detail = document.createElement('span');
          detail.textContent = location.address ?? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
          popupBody.append(title, detail);
          const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setDOMContent(popupBody);
          new maplibregl.Marker({ element: markerElement, anchor: 'bottom' })
            .setLngLat([location.longitude, location.latitude])
            .setPopup(popup)
            .addTo(map);
          bounds.extend([location.longitude, location.latitude]);
        }
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 54, maxZoom: 13, duration: 0 });
        }
        setStatus(packageKind === 'none' ? 'coordinate-fallback' : 'offline-package');
      } catch {
        setStatus('unavailable');
      }
    };

    void start();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [mappableLocations]);

  const statusText = status === 'loading'
    ? 'Yerel harita hazırlanıyor.'
    : status === 'offline-package'
      ? 'Çevrimdışı Türkiye harita paketi kullanılıyor. Ağ ve bulut kullanılmadı.'
      : status === 'coordinate-fallback'
        ? 'Çevrimdışı harita paketi bulunamadı; koordinat ızgarası ve kayıtlı işaretler gösteriliyor. Ağ kullanılmadı.'
        : 'Bu cihazda görsel harita başlatılamadı. Kayıtlı konum listesi kullanılabilir.';

  return (
    <article className="panel family-location-map-card">
      <div className="family-location-map-heading">
        <div>
          <span className="eyebrow">Yerel ve çevrimdışı</span>
          <h2>Aile konum haritası</h2>
        </div>
        <span className={`family-location-map-state is-${status}`} role="status">{statusText}</span>
      </div>
      <div className="family-location-map-canvas" ref={containerRef} aria-label="Aile konumlarının çevrimdışı haritası" />
      <p className="family-location-map-truth">
        Konumlar yalnız bu cihazda işlenir. Harita, rota takibi veya arka planda canlı konum gönderimi yapmaz.
      </p>
    </article>
  );
}
