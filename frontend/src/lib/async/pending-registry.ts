import { useCallback, useRef, useState } from "react";

import type { ActionKey } from "./action-key";

export class PendingRegistry<Key extends string = ActionKey> {
  private readonly counts = new Map<Key, number>();

  begin(key: Key): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  finish(key: Key): void {
    const current = this.counts.get(key) ?? 0;
    if (current <= 1) {
      this.counts.delete(key);
      return;
    }
    this.counts.set(key, current - 1);
  }

  isPending(key: Key): boolean {
    return this.counts.has(key);
  }

  hasAnyPending(): boolean {
    return this.counts.size > 0;
  }

  snapshot(): ReadonlySet<Key> {
    return new Set(this.counts.keys());
  }
}

export interface PendingRegistryHandle<Key extends string = ActionKey> {
  pendingKeys: ReadonlySet<Key>;
  hasPending: boolean;
  isPending: (key: Key) => boolean;
  begin: (key: Key) => void;
  finish: (key: Key) => void;
  run: <T>(key: Key, action: () => Promise<T>) => Promise<T>;
}

export function usePendingRegistry<Key extends string = ActionKey>(): PendingRegistryHandle<Key> {
  const registryRef = useRef(new PendingRegistry<Key>());
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<Key>>(() => registryRef.current.snapshot());

  const syncSnapshot = useCallback(() => {
    setPendingKeys(registryRef.current.snapshot());
  }, []);

  const begin = useCallback((key: Key) => {
    registryRef.current.begin(key);
    syncSnapshot();
  }, [syncSnapshot]);

  const finish = useCallback((key: Key) => {
    registryRef.current.finish(key);
    syncSnapshot();
  }, [syncSnapshot]);

  const isPending = useCallback((key: Key) => pendingKeys.has(key), [pendingKeys]);

  const run = useCallback(async <T,>(key: Key, action: () => Promise<T>): Promise<T> => {
    begin(key);
    try {
      return await action();
    } finally {
      finish(key);
    }
  }, [begin, finish]);

  return {
    pendingKeys,
    hasPending: pendingKeys.size > 0,
    isPending,
    begin,
    finish,
    run,
  };
}
