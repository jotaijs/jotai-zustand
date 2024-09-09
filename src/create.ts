import { useMemo } from 'react';
import { atom, createStore } from 'jotai/vanilla';
import { useAtomValue } from 'jotai/react';

import { atomWithActions } from './atomWithActions.js';

export function create<State extends object, Actions extends object>(
  initialState: State,
  createActions: (
    set: (partial: Partial<State> | ((prev: State) => Partial<State>)) => void,
    get: () => State,
  ) => Actions,
) {
  const store = createStore();
  const theAtom = atomWithActions(initialState, createActions);
  const useStore = <Slice>(selector: (state: State & Actions) => Slice) => {
    const derivedAtom = useMemo(
      () => atom((get) => selector(get(theAtom))),
      [selector],
    );
    return useAtomValue(derivedAtom, { store });
  };
  const useStoreWithGetState = useStore as typeof useStore & {
    getState: () => State & Actions;
  };
  useStoreWithGetState.getState = () => store.get(theAtom);
  return useStoreWithGetState;
}
