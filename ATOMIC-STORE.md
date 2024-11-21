Here's an updated spec/README — I'm trying out some nomenclature (atomic store, computeds => derived state) to see if it makes it easier/simpler.

It struck me that it is presumably possible to make this atomic store completely Zustand compatible, and it would probably be possible to wrap a Zustand store to make it an atomic store — it wouldn't have derived state, but you could add that if you wanted to.

# Atomic Store

An atomic store is a type inferred central store defined using a `State` object with properties of these types:

- actions that update the state (defined using methods)
- derived state (defined using getters)
- basic state (all other properties)

The store exposes each of the properties as an appropriate Jotai atom which you can then consume/use to interact with the state in the store.

This way you can benefit from both the conciseness and simplicity of a central Zustand-ish store definition syntax, and the Jotai atom benefits such as cached, auto-updating derived values, and direct subscriptions that doesn't require selectors.

## Definition

```tsx
import { createAtomicStore } from 'jotai-zustand';

const atomicStore = createAtomicStore({
  a: 1,
  b: 2,

  // derived state defined using getters
  get sum() {
    return this.a + this.b;
  },
  get sum2() {
    return this.sum * 2;
  },

  // actions return Partial<State> or mutate state directly
  adda(n: number) {
    return { a: this.a + n };
  },
  addb(n: number) {
    this.b += n;
  },
});
// => {
//   a: PrimitiveAtom<number>
//   b: PrimitiveAtom<number>
//   sum: Atom<number>
//   sum2: Atom<number>
//   adda: WritableAtom<null, [number], void>
//   addb: WritableAtom<null, [number], void>
// };
```

All method properties on the state object are considered to be actions, and they must either mutate the state in the `this` object directly, or return `Partial<State>`, which will then be merged with the existing state.

Derived state (aka computeds or computed values) are defined using getters, and are automatically updated when the state they depend on changes. Be careful not to create circular dependencies.

## Usage

The store can be consumed as a set of atoms:

```tsx
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

export default function MyComponent() {
  const a = useAtomValue(atomicStore.a); // number
  const sum2x = useAtomValue(atomicStore.sum2); // number
  const adda = useSetAtom(atomicStore.adda); // (n: number) => void

  return (
    <div>
      <div>a: {a}</div>
      <div>sum2x: {sum2x}</div>
      <button onClick={() => adda(5)}>Add 5 to a</button>
    </div>
  );
}
```

Or through `useStore` and selectors, similarly to how Zustand works:

```tsx
import { useStore } from 'jotai-zustand';
const sum = useStore(atomicStore, (state) => state.sum);
const state = useStore(atomicStore);
```

Using selectors is not quite as performant as using atoms. Each `useStore` call in each component instance will register a selector that is called on every store update. This can be expensive if you render many components that use selectors.

Component instances that use atoms has no performance penalty unless the atom they depend on changes value.

## Craz idea: Generalization

The state definition object above could actually connect to and bridge to other state systems, e.g.,

```tsx
import { fromZustand, fromSignal, type State } from 'jotai-zustand';
const store = create({
  zustand: fromZustand(zustandStore), // composable
  signal: fromSignal(signal$), // maybe auto-detect type
  a: 1,
  b: 2,
  get sum() {
    return this.zustand.var + this.signal;
  },
});
// => State<{
//   zustand: State<...zustandStore>,
//   signal: number,
//   a: number,
//   b: number,
//   sum: readonly number
// }>
fromAtomic(store, {
  // extensible
  get sum2() {
    return this.sum * 2;
  },
});
// => State<{
//   zustand: State<...zustandStore>,
//   signal: number,
//   a: number,
//   b: number,
//   sum: number,
//   sum2: number
// }>

toSignals(store);
// => {
//   zustand: { var: Signal<number> },
//   a: Signal<number>,
//   b: Signal<number>,
//   signal: Signal<number>,
//   sum: Signal<number>
// }
toAtoms(store);
// => {
//   zustand: { var: atom<...> },
//   signal: atom<number>,
//   a: atom<number>,
//   b: atom<number>,
//   sum: atom<number>
// }
```

## To do

Must explore:

- [ ] Best way to track dependencies and create atoms
- [ ] Add tests for types
- [ ] Naming :)

Also likely explore:

- [ ] Generalization to other state systems
- [ ] Zustand compatibility
  - [ ] Also return `useStore` hook
  - [ ] Consume store using selectors — ideate API (the above Zustand one looks good to me, but not clear how to deal with setting basic state)
  - [ ] Also offer a setState / getState API
  - [ ] Create atomic store from a Zustand store (and allow easy addition of derived state)
- [ ] Dealing with async (state, computeds, actions, selectors)
- [ ] Allow property setters in addition to property getters

Perhaps out of scope:

- [ ] Dealing with nested stores/state (I think this would be very useful)

Out of scope:

- [ ] Also allow using atoms within the store
