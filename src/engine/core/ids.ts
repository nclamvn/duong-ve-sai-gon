/** Entity ID có brand để không trộn với string thường. Factory reset được khi game.reset(). */
export type EntityId = string & { readonly __brand: 'EntityId' };

export interface IdFactory {
  next(): EntityId;
  reset(): void;
  readonly count: number;
}

export function makeIdFactory(prefix: string): IdFactory {
  let n = 0;
  return {
    next: () => `${prefix}_${(n++).toString(36)}` as EntityId,
    reset: () => {
      n = 0;
    },
    get count() {
      return n;
    },
  };
}
