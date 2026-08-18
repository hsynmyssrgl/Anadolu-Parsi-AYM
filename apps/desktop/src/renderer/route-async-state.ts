import { PRODUCT_NAVIGATION_ROUTES } from '@ppt/domain/renderer';

export type ProductNavigationRouteId = (typeof PRODUCT_NAVIGATION_ROUTES)[number]['id'];

export type RouteAsyncStateKind = 'empty' | 'loading' | 'offline' | 'error' | 'retry';

export interface RouteAsyncStateDescriptor {
  readonly routeId: ProductNavigationRouteId;
  readonly state: RouteAsyncStateKind;
  readonly panelState: 'empty' | 'loading' | 'offline' | 'error';
  readonly title: string;
  readonly message: string;
  readonly announce: 'polite' | 'assertive';
  readonly busy: boolean;
  readonly retry: { readonly visible: boolean; readonly label?: 'Yeniden dene'; readonly returnFocusToMain: boolean };
}

const routeLabels = new Map(PRODUCT_NAVIGATION_ROUTES.map((route) => [route.id, route.label] as const));

export const ROUTE_ASYNC_STATE_KINDS: readonly RouteAsyncStateKind[] = Object.freeze(['empty', 'loading', 'offline', 'error', 'retry']);

export function resolveRouteAsyncState(routeId: ProductNavigationRouteId, state: RouteAsyncStateKind): RouteAsyncStateDescriptor {
  const label = routeLabels.get(routeId);
  if (!label) throw new Error(`B7-15 bilinmeyen rota: ${routeId}`);
  switch (state) {
    case 'empty': return Object.freeze({ routeId, state, panelState: 'empty', title: `${label} henüz boş`, message: `${label} için gösterilecek kayıt bulunmuyor. İlk kaydı ekleyerek başlayabilirsiniz.`, announce: 'polite', busy: false, retry: Object.freeze({ visible: false, returnFocusToMain: false }) });
    case 'loading': return Object.freeze({ routeId, state, panelState: 'loading', title: `${label} yükleniyor`, message: `${label} verileri güvenli kaynaktan hazırlanıyor.`, announce: 'polite', busy: true, retry: Object.freeze({ visible: false, returnFocusToMain: false }) });
    case 'offline': return Object.freeze({ routeId, state, panelState: 'offline', title: `${label} çevrimdışı`, message: `${label} verilerine şu anda çevrimdışı olduğunuz için erişilemiyor. Bağlantı geldiğinde yeniden deneyin.`, announce: 'assertive', busy: false, retry: Object.freeze({ visible: true, label: 'Yeniden dene', returnFocusToMain: true }) });
    case 'error': return Object.freeze({ routeId, state, panelState: 'error', title: `${label} yüklenemedi`, message: `${label} verileri güvenli biçimde alınamadı. Girdileriniz değiştirilmedi; yeniden deneyebilirsiniz.`, announce: 'assertive', busy: false, retry: Object.freeze({ visible: true, label: 'Yeniden dene', returnFocusToMain: true }) });
    case 'retry': return Object.freeze({ routeId, state, panelState: 'loading', title: `${label} yeniden deneniyor`, message: `${label} verileri yeniden isteniyor; işlem tamamlandığında odak ana içeriğe döner.`, announce: 'polite', busy: true, retry: Object.freeze({ visible: false, returnFocusToMain: true }) });
  }
}

export const ROUTE_ASYNC_STATE_CATALOG: readonly RouteAsyncStateDescriptor[] = Object.freeze(
  PRODUCT_NAVIGATION_ROUTES.flatMap((route) => ROUTE_ASYNC_STATE_KINDS.map((state) => resolveRouteAsyncState(route.id, state)))
);
