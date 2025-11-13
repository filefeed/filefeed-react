export type GlobalPortalState = {
  open: boolean;
  portalContainer: HTMLDivElement | null;
};

let state: GlobalPortalState = {
  open: false,
  portalContainer: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function ensureContainer(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (!state.portalContainer) {
    const el = document.createElement("div");
    el.setAttribute("data-filefeed-portal", "true");
    document.body.appendChild(el);
    state = { ...state, portalContainer: el };
  }
  return state.portalContainer;
}

export function openPortal() {
  ensureContainer();
  if (!state.open) {
    state = { ...state, open: true };
    emit();
  } else {
    emit();
  }
}

export function closePortal() {
  if (state.open) {
    state = { ...state, open: false };
    emit();
  }
}

export function getSnapshot(): GlobalPortalState {
  return state;
}

export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
