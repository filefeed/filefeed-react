import { useContext, useSyncExternalStore } from "react";
import { FilefeedContext } from "../provider/FilefeedProvider";
import {
  subscribe as subscribeGlobal,
  getSnapshot as getGlobalSnapshot,
  openPortal as openGlobalPortal,
  closePortal as closeGlobalPortal,
  getServerSnapshot as getGlobalServerSnapshot,
} from "../provider/globalPortal";

export function useFilefeed() {
  const ctx = useContext(FilefeedContext);
  if (ctx) return ctx;

  const snapshot = useSyncExternalStore(
    subscribeGlobal,
    getGlobalSnapshot,
    getGlobalServerSnapshot
  );

  return {
    open: snapshot.open,
    openPortal: openGlobalPortal,
    closePortal: closeGlobalPortal,
    portalContainer: snapshot.portalContainer,
  } as const;
}


