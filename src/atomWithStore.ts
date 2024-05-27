import { atom } from 'jotai/vanilla';
import type { SetStateAction } from 'jotai/vanilla';
import type { StoreApi } from 'zustand/vanilla';

export function atomWithStore<T>(store: StoreApi<T>) {
  const baseAtom = atom(store.getState());
  if (process.env.NODE_ENV !== 'production') {
    baseAtom.debugPrivate = true;
  }

  baseAtom.onMount = (setValue) => {
    const callback = () => {
      setValue(store.getState());
    };
    const unsub = store.subscribe(callback);
    callback();
    return unsub;
  };
  const derivedAtom = atom(
    (get) => get(baseAtom),
    (get, _set, update: SetStateAction<T>) => {
      const newState =
        typeof update === 'function'
          ? (update as (prev: T) => T)(get(baseAtom))
          : update;
      store.setState(newState, true /* replace */);
    },
  );
  return derivedAtom;
}
