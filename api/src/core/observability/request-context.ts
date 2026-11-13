import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  reqId: string;
  method?: string;
  path?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(
  store: RequestContextStore,
  callback: () => T,
): T {
  return requestContextStorage.run(store, callback);
}

export function getRequestContext(): RequestContextStore | undefined {
  return requestContextStorage.getStore();
}

export function getRequestId(): string {
  return requestContextStorage.getStore()?.reqId || '-';
}

export function formatLogPrefix(explicitReqId?: string): string {
  const id = explicitReqId && explicitReqId.trim() ? explicitReqId.trim() : getRequestId();
  return `[req:${id}]`;
}
