import { useContext, useSyncExternalStore } from "react";
import { FilefeedContext } from "../provider/FilefeedProvider";
import {
  subscribe as subscribeGlobal,
  getSnapshot as getGlobalSnapshot,
  openPortal as openGlobalPortal,
  closePortal as closeGlobalPortal,
} from "../provider/globalPortal";

export function useFilefeed() {
  const ctx = useContext(FilefeedContext);
  if (ctx) return ctx;

  // Fallback to global portal manager when no Provider is present
  const snapshot = useSyncExternalStore(
    subscribeGlobal,
    getGlobalSnapshot,
    () => ({ open: false, portalContainer: null })
  );

  return {
    open: snapshot.open,
    openPortal: openGlobalPortal,
    closePortal: closeGlobalPortal,
    portalContainer: snapshot.portalContainer,
  } as const;
}


