import { createAtomicStore } from './atomicStore.js';
import type { AtomicDefinition } from './atomicStore.js';

/** Convert Zustand store definition to atomic store definition */
export function atomicStoreFromZustand<T extends object>(
  definition: (set: (partial: Partial<T>) => void, get: () => T) => T,
) {
  const state = {} as T;

  const get = () => state;
  const set = (partial: Partial<T>) => Object.assign(state, partial);

  const zustandDefinition = definition(set, get);
  const atomicDefinition = {} as AtomicDefinition<T>;

  for (const key in zustandDefinition) {
    const value = zustandDefinition[key];
    const typedKey = key as keyof T;

    if (typeof value === 'function') {
      atomicDefinition[typedKey] = ((...args: any[]) => {
        const result = (value as Function).apply(state, args);
        return result === undefined ? void 0 : result;
      }) as any;
    } else {
      state[typedKey] = value;
      atomicDefinition[typedKey] = value as any;
    }
  }

  return createAtomicStore(atomicDefinition);
}
