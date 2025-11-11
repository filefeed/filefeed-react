export type CompatEvent = {
  topic: string;
  payload: any;
};

export type ListenerFilter = Record<string, any> | undefined;
export type ListenerHandler = (event: any) => void | Promise<void>;

type Sub = {
  topic: string;
  filter?: ListenerFilter;
  handler: ListenerHandler;
};

function matchesTopic(subTopic: string, emitTopic: string) {
  if (subTopic === "**") return true;
  return subTopic === emitTopic;
}

function matchesFilter(payload: any, filter?: ListenerFilter) {
  if (!filter) return true;
  if (typeof filter !== "object") return true;
  for (const [k, v] of Object.entries(filter)) {
    if ((payload as any)[k] !== v) return false;
  }
  return true;
}

export class FileFeedListener {
  private subs: Sub[] = [];

  static create(register: (listener: FileFeedListener) => void) {
    const l = new FileFeedListener();
    register(l);
    return l;
  }

  on(topic: string, handler: ListenerHandler): void;
  on(topic: string, filter: ListenerFilter, handler: ListenerHandler): void;
  on(topic: string, a: any, b?: any) {
    if (typeof a === "function") {
      this.subs.push({ topic, handler: a as ListenerHandler });
    } else {
      this.subs.push({ topic, filter: a as ListenerFilter, handler: b as ListenerHandler });
    }
  }

  async emit(topic: string, payload: any) {
    for (const sub of this.subs) {
      if (matchesTopic(sub.topic, topic) && matchesFilter(payload, sub.filter)) {
        await sub.handler({ topic, ...payload });
      }
    }
  }
}
