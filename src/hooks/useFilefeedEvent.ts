import { useEffect } from "react";
import { eventBus, matchesFilter } from "../internal/eventBus";

export function useFilefeedEvent(
  eventName: string,
  filter: Record<string, any> | undefined,
  handler: (event: any) => void
) {
  useEffect(() => {
    const off = eventBus.on(eventName, (payload) => {
      if (matchesFilter(payload, filter)) {
        handler(payload);
      }
    });
    return off;
  }, [eventName, JSON.stringify(filter)]);
}


