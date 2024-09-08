import { atom } from 'jotai/vanilla';

export function atomWithActions<State extends object, Actions extends object>(
  initialState: State,
  createActions: (
    set: (
      partial: Partial<State> | ((prev: State) => Partial<State>),
      replace?: boolean,
    ) => void,
    get: () => State,
  ) => Actions,
) {
  const stateAtom = atom(initialState);
  if (process.env.NODE_ENV !== 'production') {
    stateAtom.debugPrivate = true;
  }
  const actionsAtom = atom(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_get, { setSelf }: any) => {
      const actions = createActions(
        (partial, replace) => setSelf({ type: 'set', partial, replace }),
        () => setSelf({ type: 'get' }),
      );
      return actions;
    },
    (
      get,
      set,
      arg:
        | { type: 'get' }
        | {
            type: 'set';
            partial: Partial<State> | ((prev: State) => Partial<State>);
            replace: boolean | undefined;
          },
    ) => {
      const state = get(stateAtom);
      if (arg.type === 'get') {
        return state;
      }
      const { partial, replace } = arg;
      const nextState =
        typeof partial === 'function' ? partial(state) : partial;
      if (!Object.is(nextState, state)) {
        set(
          stateAtom,
          replace ? (nextState as State) : Object.assign({}, state, nextState),
        );
      }
    },
  );
  if (process.env.NODE_ENV !== 'production') {
    actionsAtom.debugPrivate = true;
  }
  const derivedAtom = atom((get) => ({
    ...get(stateAtom),
    ...get(actionsAtom),
  }));
  return derivedAtom;
}
