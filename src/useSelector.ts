import { useEffect, useReducer } from 'react';
import type { Atom, ExtractAtomValue } from 'jotai/vanilla';
import { useStore } from 'jotai/react';

type Store = ReturnType<typeof useStore>;

type Options = Parameters<typeof useStore>[0];

export function useSelector<Value, Slice>(
  atom: Atom<Value>,
  selector: (value: Value) => Slice,
  equalityFn?: (a: Slice, b: Slice) => boolean,
  options?: Options,
): Awaited<Slice>;

export function useSelector<AtomType extends Atom<unknown>, Slice>(
  atom: AtomType,
  selector: (value: ExtractAtomValue<AtomType>) => Slice,
  equalityFn?: (a: Slice, b: Slice) => boolean,
  options?: Options,
): Awaited<Slice>;

export function useSelector<Value, Slice>(
  atom: Atom<Value>,
  selector: (value: Value) => Slice,
  equalityFn: (a: Slice, b: Slice) => boolean = Object.is,
  options?: Options,
) {
  const store = useStore(options);

  const [[sliceFromReducer, storeFromReducer, atomFromReducer], rerender] =
    useReducer<readonly [Slice, Store, typeof atom], undefined, []>(
      (prev) => {
        const nextSlice = selector(store.get(atom));
        if (
          equalityFn(prev[0], nextSlice) &&
          prev[1] === store &&
          prev[2] === atom
        ) {
          return prev;
        }
        return [nextSlice, store, atom];
      },
      undefined,
      () => [selector(store.get(atom)), store, atom],
    );

  let slice = sliceFromReducer;
  if (storeFromReducer !== store || atomFromReducer !== atom) {
    rerender();
    slice = selector(store.get(atom));
  }

  useEffect(() => {
    const unsub = store.sub(atom, () => rerender());
    rerender();
    return unsub;
  }, [store, atom]);

  return slice;
}
