import { expect, test, describe } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useAtomValue, useSetAtom, Provider } from 'jotai';
import { atomicStoreFromZustand } from '../src/atomicStoreFromZustand.js';
import type { PrimitiveAtom, WritableAtom } from 'jotai';
import { createStore } from 'jotai/vanilla';

// Define interfaces for store states
interface CounterState {
  count: number;
  increment: (n?: number) => void;
}

interface MultiState {
  count: number;
  total: number;
  updateBoth: (n?: number) => void;
}

interface ItemsState {
  items: string[];
  count: number;
  addItem: (item: string) => void;
}

describe('zustandToAtomic', () => {
  describe('Basic Conversion', () => {
    test('converts basic zustand store', () => {
      const store = atomicStoreFromZustand<CounterState>((set, get) => ({
        count: 0,
        increment: (n = 1) => set({ count: get().count + n }),
      }));

      const jotaiStore = createStore();
      jotaiStore.set(store.count, 0);
      expect(jotaiStore.get(store.count)).toBe(0);

      jotaiStore.set(store.increment, 1);
      expect(jotaiStore.get(store.count)).toBe(1);
    });

    test('handles multiple state updates', () => {
      const store = atomicStoreFromZustand<MultiState>((set, get) => ({
        count: 2,
        total: 10,
        updateBoth: (n = 1) =>
          set({
            count: get().count + n,
            total: get().total + n * 2,
          }),
      }));

      const jotaiStore = createStore();

      expect(jotaiStore.get(store.count)).toBe(2);
      expect(jotaiStore.get(store.total)).toBe(10);

      jotaiStore.set(store.updateBoth, 5);
      expect(jotaiStore.get(store.count)).toBe(7);
      expect(jotaiStore.get(store.total)).toBe(20);
    });

    test('handles array state', () => {
      const store = atomicStoreFromZustand<ItemsState>((set, get) => ({
        items: [],
        count: 0,
        addItem: (item) =>
          set({
            items: [...get().items, item],
            count: get().count + 1,
          }),
      }));

      const jotaiStore = createStore();
      jotaiStore.set(store.items, []);
      jotaiStore.set(store.count, 0);

      expect(jotaiStore.get(store.items)).toEqual([]);
      expect(jotaiStore.get(store.count)).toBe(0);

      jotaiStore.set(store.addItem, 'test');
      expect(jotaiStore.get(store.items)).toEqual(['test']);
      expect(jotaiStore.get(store.count)).toBe(1);
    });

    test('handles undefined return values', () => {
      interface VoidState {
        value: string;
        clear: () => void;
      }

      const store = atomicStoreFromZustand<VoidState>((set) => ({
        value: 'initial',
        clear: () => set({ value: '' }),
      }));

      const jotaiStore = createStore();
      jotaiStore.set(store.value, 'initial');
      expect(jotaiStore.get(store.value)).toBe('initial');

      jotaiStore.set(store.clear);
      expect(jotaiStore.get(store.value)).toBe('');
    });
  });

  describe('React Integration', () => {
    test('works with React components', () => {
      const store = atomicStoreFromZustand<CounterState>((set, get) => ({
        count: 0,
        increment: (n = 1) => set({ count: get().count + n }),
      }));

      const Counter = () => {
        const count = useAtomValue(store.count as PrimitiveAtom<number>);
        const increment = useSetAtom(
          store.increment as WritableAtom<void, [number?], void>,
        );

        return (
          <div>
            <p>Count: {count}</p>
            <button onClick={() => increment()}>+1</button>
            <button onClick={() => increment(5)}>+5</button>
          </div>
        );
      };

      const { getByText } = render(
        <Provider>
          <Counter />
        </Provider>,
      );

      expect(getByText('Count: 0'));
      fireEvent.click(getByText('+1'));
      expect(getByText('Count: 1'));
      fireEvent.click(getByText('+5'));
      expect(getByText('Count: 6'));
    });

    test('works with complex React components', () => {
      const store = atomicStoreFromZustand<ItemsState>((set, get) => ({
        items: [],
        count: 0,
        addItem: (item) =>
          set({
            items: [...get().items, item],
            count: get().count + 1,
          }),
      }));

      const ItemList = () => {
        const items = useAtomValue(store.items as PrimitiveAtom<string[]>);
        const count = useAtomValue(store.count as PrimitiveAtom<number>);
        const addItem = useSetAtom(
          store.addItem as WritableAtom<void, [string], void>,
        );

        return (
          <div>
            <p>Count: {count}</p>
            <button onClick={() => addItem('test')}>Add Item</button>
            <ul>
              {items.length === 0 ? (
                <li>No items</li>
              ) : (
                items.map((item, i) => <li key={i}>{item}</li>)
              )}
            </ul>
          </div>
        );
      };

      const { getByText } = render(
        <Provider>
          <ItemList />
        </Provider>,
      );

      // Test initial state
      expect(getByText('No items'));
      expect(getByText('Count: 0'));

      // Test after adding an item
      fireEvent.click(getByText('Add Item'));
      expect(getByText('test'));
      expect(getByText('Count: 1'));
    });
  });
});
