import { atomWithActions } from './atomWithActions.js';
import { useSelector } from './useSelector.js';

export function create<State extends object, Actions extends object>(
  initialState: State,
  createActions: (
    set: (partial: Partial<State> | ((prev: State) => Partial<State>)) => void,
    get: () => State,
  ) => Actions,
) {
  const theAtom = atomWithActions(initialState, createActions);
  return <Slice>(
    selector: (state: State & Actions) => Slice,
    equalityFn?: (a: Slice, b: Slice) => boolean,
  ) => useSelector(theAtom, selector, equalityFn);
}
