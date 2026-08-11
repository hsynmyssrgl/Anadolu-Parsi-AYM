export interface NavigationState {
  readonly active: string;
  readonly previous?: string;
  readonly history: readonly string[];
}

export type NavigationAction =
  | { readonly type: 'navigate'; readonly screen: string }
  | { readonly type: 'back' }
  | { readonly type: 'reset'; readonly screen: string };

export const createNavigationState = (initial: string): NavigationState => ({ active: initial, history: [initial] });

export const navigationReducer = (state: NavigationState, action: NavigationAction): NavigationState => {
  if (action.type === 'reset') return createNavigationState(action.screen);
  if (action.type === 'back') {
    if (state.history.length < 2) return state;
    const history = state.history.slice(0, -1);
    return { active: history.at(-1) ?? state.active, previous: state.active, history };
  }
  if (action.screen === state.active) return state;
  return {
    active: action.screen,
    previous: state.active,
    history: [...state.history, action.screen].slice(-12)
  };
};

export const readNavigationState = (fallback: string, allowed: readonly string[]): NavigationState => {
  try {
    const value = window.sessionStorage.getItem('ppt.navigation.active');
    return createNavigationState(value && allowed.includes(value) ? value : fallback);
  } catch { return createNavigationState(fallback); }
};

export const persistNavigationState = (state: NavigationState): void => {
  try { window.sessionStorage.setItem('ppt.navigation.active', state.active); } catch { /* session storage isteğe bağlıdır */ }
};
