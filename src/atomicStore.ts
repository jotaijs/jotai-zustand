import { atom } from 'jotai';
import type { Atom, WritableAtom, PrimitiveAtom } from 'jotai';

// Helper type to detect if two types are exactly equal
type IfEquals<X, Y, A = X, B = never> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;

// Helper type to get writable keys of an object
type WritableKeys<T> = {
  [P in keyof T]: IfEquals<
    { [Q in P]: T[P] },
    { -readonly [Q in P]: T[P] },
    P,
    never
  >;
}[keyof T];

/**
 * Get state keys (non-function properties)
 */
type StateKeys<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

/**
 * Valid state update type that enforces exact object literal checking
 */
type StateUpdate<T> = {
  [K in StateKeys<T>]?: T[K];
} & {}; // The intersection with empty object helps preserve literal type checking

/**
 * Valid return types for store actions
 */
type ValidActionReturn<T> = void | StateUpdate<T>;

/**
 * Store definition type
 */
export type AtomicState<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => any
    ? (...args: Args) => ValidActionReturn<T>
    : T[K];
};

/**
 * Generated store type where each property becomes a Jotai atom
 */
type AtomicStore<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? WritableAtom<void, Parameters<T[K]>, void>
    : K extends WritableKeys<T>
      ? PrimitiveAtom<T[K]>
      : Atom<T[K]>;
};

/**
 * Creates an atomic store that combines Zustand-like state definition with Jotai atoms.
 *
 * The state definition object passed to this function can consist of three kinds of properties:
 *
 * **Base State**
 *    - Regular properties (not functions or getters)
 *    - Stored in a single root atom for efficient updates
 *    - Becomes a `PrimitiveAtom<Value>` in the store
 *
 * **Derived State**
 *    - Defined using property getters
 *    - Auto-updates when dependencies change
 *    - Cached by Jotai to prevent unnecessary recomputation
 *    - Becomes a read-only `Atom<Value>` in the store
 *
 * **Actions**
 *    - Regular functions that can update state
 *    - Can return partial `Partial<State>` updates or modify state via `this`
 *    - Becomes a `WritableAtom<void, Args, void>` in the store
 *
 * @returns An object where each property is converted to a Jotai atom:
 *    - Base state becomes a primitive atom: `PrimitiveAtom<Value>`
 *    - Derived state becomes a read-only atom: `Atom<Value>`
 *    - Actions become writable atoms: `WritableAtom<void, Args, void>`
 *
 * @example Basic store definition
 * ```ts
 * const store = createAtomicStore({
 *   count: 0,
 *   get double() { return this.count * 2 },
 *   increment(n = 1) { return { count: this.count + n } }
 * })
 * ```
 *
 * @example Usage with React hooks
 * ```tsx
 * function Counter() {
 *   // Read base or derived state with useAtomValue
 *   const count = useAtomValue(store.count)
 *   const double = useAtomValue(store.double)
 *
 *   // Get action setter with useSetAtom
 *   const increment = useSetAtom(store.increment)
 *
 *   return (
 *     <div>
 *       <p>Count: {count}</p>
 *       <p>Double: {double}</p>
 *       <button onClick={() => increment()}>+1</button>
 *       <button onClick={() => increment(5)}>+5</button>
 *     </div>
 *   )
 * }
 * ```
 *
 * @example Direct usage with Jotai store
 * ```ts
 * const jotai = createStore()
 *
 * // Read values
 * const count = jotai.get(store.count)
 * const double = jotai.get(store.double)
 *
 * // Update base state
 * jotai.set(store.count, 42)
 *
 * // Call actions
 * jotai.set(store.increment)
 * ```
 *
 * @template State - Type of the state definition object
 */
export function createAtomicStore<State extends object>(
  initial: AtomicState<State>,
): AtomicStore<State> {
  const store = {} as AtomicStore<State>;
  const baseAtoms = new Map<keyof State, PrimitiveAtom<any>>();

  // Create a single root atom for all base state values
  const baseValues = {} as Record<keyof State, any>;
  for (const [key, value] of Object.entries(initial)) {
    const k = key as keyof State;
    const desc = Object.getOwnPropertyDescriptor(initial, k);
    if (
      typeof value !== 'function' && // Not an action
      !desc?.get // Not derived state
    )
      baseValues[k] = value;
  }
  const rootAtom = atom(baseValues);

  // Create atoms for each base state property
  for (const key of Object.keys(baseValues)) {
    const k = key as keyof State;
    const baseAtom = atom(
      (get) => get(rootAtom)[k],
      (get, set, update: State[typeof k]) => {
        const current = get(rootAtom);
        set(rootAtom, { ...current, [k]: update });
      },
    ) as PrimitiveAtom<State[typeof k]>;
    baseAtoms.set(k, baseAtom);
    store[k] = baseAtom as AtomicStore<State>[typeof k];
  }

  // Create derived state atoms
  for (const [key, desc] of Object.entries(
    Object.getOwnPropertyDescriptors(initial),
  )) {
    if (!desc.get) continue;

    const k = key as keyof State;
    store[k] = createDerivedAtom(
      k,
      desc.get!,
      store,
      baseAtoms,
      initial,
    ) as AtomicStore<State>[typeof k];
  }

  // Create action atoms
  for (const [key, value] of Object.entries(initial)) {
    const k = key as keyof State;
    const desc = Object.getOwnPropertyDescriptor(initial, k);
    if (
      typeof value !== 'function' || // Not an action
      desc?.get // Skip getters (derived state)
    )
      continue;

    store[k] = createActionAtom(
      k,
      value,
      store,
      baseAtoms,
      initial,
    ) as AtomicStore<State>[typeof k];
  }

  return store;
}

/**
 * Creates a derived state atom that automatically updates when its dependencies change.
 *
 * @template T - The type of the atomic state definition object.
 * @param key - The key of the derived state property.
 * @param getFn - The getter function for the derived state.
 * @param store - The atomic store.
 * @param baseAtoms - Map of base atoms.
 * @param initial - The initial atomic state definition.
 * @returns An atom representing the derived state.
 */
function createDerivedAtom<T>(
  key: keyof T,
  getFn: () => any,
  store: AtomicStore<T>,
  baseAtoms: Map<keyof T, PrimitiveAtom<any>>,
  initial: AtomicState<T>,
): Atom<any> {
  return atom((get) => {
    const state = createStateGetter(get, store, baseAtoms, initial);
    return getFn.call(state);
  });
}

/**
 * Creates an action atom that can update multiple base state values atomically.
 *
 * @template T - The type of the atomic state definition object.
 * @param key - The key of the action property.
 * @param actionFn - The function representing the action.
 * @param store - The atomic store.
 * @param baseAtoms - Map of base atoms.
 * @param initial - The initial atomic state definition.
 * @returns A writable atom representing the action.
 */
function createActionAtom<T>(
  key: keyof T,
  actionFn: Function,
  store: AtomicStore<T>,
  baseAtoms: Map<keyof T, PrimitiveAtom<any>>,
  initial: AtomicState<T>,
): WritableAtom<void, any[], void> {
  type Args = T[typeof key] extends (...args: infer P) => any ? P : never;

  return atom(null, (get, set, ...args: Args) => {
    const state = createStateGetter(get, store, baseAtoms, initial);
    const result = actionFn.apply(state, args);
    if (result) {
      for (const [k, v] of Object.entries(result)) {
        if (baseAtoms.has(k as keyof T)) set(baseAtoms.get(k as keyof T)!, v);
      }
    }
  }) as unknown as WritableAtom<void, Args, void>;
}

/**
 * Creates an object with getters that access the latest atom values.
 * Used to provide the `this` context in derived state and actions.
 *
 * @template T - The type of the atomic state definition object.
 * @param get - The 'get' function provided by Jotai atoms.
 * @param store - The atomic store.
 * @param baseAtoms - Map of base atoms.
 * @param initial - The initial atomic state definition.
 * @returns An object with getters for each property.
 */
function createStateGetter<T>(
  get: any,
  store: AtomicStore<T>,
  baseAtoms: Map<keyof T, PrimitiveAtom<any>>,
  initial: AtomicState<T>,
) {
  const state = Object.create(null);
  for (const propKey of Object.keys(initial)) {
    const pk = propKey as keyof T;
    Object.defineProperty(state, pk, {
      get() {
        if (baseAtoms.has(pk)) return get(baseAtoms.get(pk)!);
        return get(store[pk] as Atom<any>);
      },
      enumerable: true,
    });
  }
  return state;
}
