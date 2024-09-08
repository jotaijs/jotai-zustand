import { useMemo } from 'react';
import { atom, createStore } from 'jotai/vanilla';
import { useAtomValue } from 'jotai/react';

import { atomWithActions } from './atomWithActions.js';

export function create<State, Actions>(
  initialState: State,
  createActions: (
    set: (partial: Partial<State> | ((prev: State) => Partial<State>)) => void,
    get: () => State,
  ) => Actions,
) {
  const store = createStore();
  const theAtom = atomWithActions(initialState, createActions);
  return <Slice>(selector: (state: State & Actions) => Slice) => {
    const derivedAtom = useMemo(
      () => atom((get) => selector(get(theAtom))),
      [selector],
    );
    return useAtomValue(derivedAtom, { store });
  };
}
