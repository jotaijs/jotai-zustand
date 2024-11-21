import React from 'react';
import { expect, test, describe } from 'vitest';
import { atom, createStore } from 'jotai';
import { render, fireEvent } from '@testing-library/react';
import { useAtomValue, useSetAtom, Provider } from 'jotai';
import { createAtomicStore } from '../src/index.js';

describe('AtomicStore', () => {
  describe('Basic Functionality', () => {
    test('basic value caching', () => {
      const computeCount = { value: 0 };
      const store = createAtomicStore({
        base: 0,
        get value() {
          computeCount.value++;
          return this.base * 2;
        },
      });

      const jotai = createStore();

      // Initial read and reset counter
      jotai.get(store.value);
      computeCount.value = 0;

      // First read should use cached value from initial read
      expect(jotai.get(store.value)).toBe(0);
      expect(computeCount.value).toBe(0); // Should be 0 because value was cached

      // Update base value should trigger recomputation
      jotai.set(store.base, 1);
      expect(jotai.get(store.value)).toBe(2);
      expect(computeCount.value).toBe(1); // Should compute once after base changed

      // Subsequent reads should use cached value
      expect(jotai.get(store.value)).toBe(2);
      expect(computeCount.value).toBe(1); // Should still be 1 (using cache)
    });

    test('independent chains', () => {
      const computeCount = { a: 0, b: 0 };
      const store = createAtomicStore({
        valueA: 0,
        valueB: 0,
        get a() {
          computeCount.a++;
          return this.valueA * 2;
        },
        get b() {
          computeCount.b++;
          return this.valueB * 2;
        },
      });

      const jotai = createStore();

      // Initialize and reset counters
      jotai.get(store.a);
      jotai.get(store.b);
      computeCount.a = 0;
      computeCount.b = 0;

      // Update only A
      jotai.set(store.valueA, 1);
      expect(jotai.get(store.a)).toBe(2);
      expect(jotai.get(store.b)).toBe(0);
      expect(computeCount).toEqual({ a: 1, b: 0 });
    });

    test('dependency chain', () => {
      const computeCount = { double: 0, quad: 0 };
      const store = createAtomicStore({
        base: 0,
        get double() {
          computeCount.double++;
          return this.base * 2;
        },
        get quad() {
          computeCount.quad++;
          return this.double * 2;
        },
      });

      const jotai = createStore();

      // Initialize and reset counters
      jotai.get(store.quad);
      computeCount.double = 0;
      computeCount.quad = 0;

      // Update base
      jotai.set(store.base, 1);
      expect(jotai.get(store.quad)).toBe(4);
      expect(computeCount).toEqual({ double: 1, quad: 1 });
    });

    test('partial chain updates', () => {
      const computeCount = { a: 0, b: 0, sum: 0 };
      const store = createAtomicStore({
        x: 0,
        y: 0,
        get a() {
          computeCount.a++;
          return this.x * 2;
        },
        get b() {
          computeCount.b++;
          return this.y * 2;
        },
        get sum() {
          computeCount.sum++;
          return this.a + this.b;
        },
      });

      const jotai = createStore();

      // Initialize and reset computation counters
      jotai.get(store.sum);
      computeCount.a = 0;
      computeCount.b = 0;
      computeCount.sum = 0;

      // Update x only - this should only trigger recomputation of 'a' and 'sum'
      // 'b' should not recompute since its dependency (y) hasn't changed
      jotai.set(store.x, 1);
      expect(jotai.get(store.sum)).toBe(2);
      expect(computeCount).toEqual({
        a: 1, // Recomputed because x changed
        b: 0, // Not recomputed because y didn't change
        sum: 1, // Recomputed because 'a' changed
      });
    });

    test('multiple dependencies on same value', () => {
      const computeCount = { a: 0, b: 0, sum: 0 };
      const store = createAtomicStore({
        x: 1,
        get a() {
          computeCount.a++;
          return this.x * 2;
        },
        get b() {
          computeCount.b++;
          return this.x * 3;
        },
        get sum() {
          computeCount.sum++;
          return this.a + this.b + this.x;
        },
      });

      const jotai = createStore();

      // Initialize by reading each value individually
      const initialA = jotai.get(store.a);
      const initialB = jotai.get(store.b);
      const initialSum = jotai.get(store.sum);
      expect(initialSum).toBe(6); // (1*2) + (1*3) + 1

      // Reset counters
      computeCount.a = 0;
      computeCount.b = 0;
      computeCount.sum = 0;

      // Read again to verify caching
      expect(jotai.get(store.sum)).toBe(6);
      expect(computeCount).toEqual({ a: 0, b: 0, sum: 0 });

      // Update x
      jotai.set(store.x, 2);
      expect(jotai.get(store.sum)).toBe(12); // (2*2) + (2*3) + 2
      expect(computeCount).toEqual({ a: 1, b: 1, sum: 1 });
    });
  });

  describe('Advanced Dependency Chains', () => {
    test('deep dependency chain', () => {
      const computeCount = { a: 0, b: 0, c: 0, d: 0 };
      const store = createAtomicStore({
        base: 0,
        get a() {
          computeCount.a++;
          return this.base + 1;
        },
        get b() {
          computeCount.b++;
          return this.a * 2;
        },
        get c() {
          computeCount.c++;
          return this.b + this.a;
        },
        get d() {
          computeCount.d++;
          return this.c * 2;
        },
      });

      const jotai = createStore();

      // Initialize and reset
      jotai.get(store.d);
      computeCount.a = computeCount.b = computeCount.c = computeCount.d = 0;

      // Update base
      jotai.set(store.base, 1);
      expect(jotai.get(store.d)).toBe(12); // ((1 + 1) * 2 + (1 + 1)) * 2
      expect(computeCount).toEqual({ a: 1, b: 1, c: 1, d: 1 });
    });

    test('deep dependency chain updates', () => {
      const computeCount = { a: 0, b: 0, c: 0, d: 0 };
      const store = createAtomicStore({
        base: 1,
        get a() {
          computeCount.a++;
          return this.base + 1;
        },
        get b() {
          computeCount.b++;
          return this.a * 2;
        },
        get c() {
          computeCount.c++;
          return this.b + this.a;
        },
        get d() {
          computeCount.d++;
          return this.c * 2;
        },
      });

      const jotai = createStore();

      // Initialize and reset counters
      expect(jotai.get(store.d)).toBe(12);
      computeCount.a = computeCount.b = computeCount.c = computeCount.d = 0;

      // Update base
      jotai.set(store.base, 2);
      expect(jotai.get(store.d)).toBe(18);
      expect(computeCount).toEqual({ a: 1, b: 1, c: 1, d: 1 });
    });
  });

  describe('Conditional Dependencies', () => {
    test('conditional dependency access', () => {
      const computeCount = { a: 0, b: 0 };
      const store = createAtomicStore({
        x: 0,
        y: 0,
        get a() {
          computeCount.a++;
          // Only access b when x > 0
          return this.x > 0 ? this.b : 0;
        },
        get b() {
          computeCount.b++;
          return this.y * 2;
        },
      });

      const jotai = createStore();

      // Initialize by reading both values
      const initialA = jotai.get(store.a);
      const initialB = jotai.get(store.b);
      expect(initialA).toBe(0);
      expect(initialB).toBe(0);

      // Reset counters
      computeCount.a = 0;
      computeCount.b = 0;

      // Update y while x is 0
      jotai.set(store.y, 1);
      expect(jotai.get(store.a)).toBe(0);
      expect(computeCount).toEqual({ a: 0, b: 0 });
    });
  });

  describe('Error Handling', () => {
    test('method error propagation', () => {
      const store = createAtomicStore({
        value: 1,
        faultyMethod() {
          throw new Error('Intentional Error');
        },
      });

      const jotai = createStore();

      expect(() => jotai.set(store.faultyMethod)).toThrow('Intentional Error');
      expect(jotai.get(store.value)).toBe(1); // State should remain unchanged
    });

    test('cyclic dependency detection', () => {
      expect(() => {
        const store = createAtomicStore({
          get a() {
            return this.b;
          },
          get b() {
            return this.a;
          },
        });
      }).toThrowError(
        /Cyclic dependency detected|Maximum call stack size exceeded/i,
      );
    });
  });

  describe('Miscellaneous', () => {
    test('dynamic atom addition', () => {
      const initialStore = { value: 1 };
      const store = createAtomicStore(initialStore) as any;
      const jotai = createStore();

      // Dynamically add a new base atom
      const newBaseAtom = atom(2);
      store.newValue = newBaseAtom;

      // Update and verify the new atom
      jotai.set(store.newValue, 5);
      expect(jotai.get(store.newValue)).toBe(5);
    });

    test('state serialization and restoration', () => {
      const store = createAtomicStore({ count: 0 });
      const jotai = createStore();

      jotai.set(store.count, 42);

      // Serialize state
      const serializedState = JSON.stringify({ count: jotai.get(store.count) });

      // Restore state in a new store
      const newStore = createAtomicStore({ count: 0 });
      const newJotai = createStore();
      const restoredState = JSON.parse(serializedState);
      newJotai.set(newStore.count, restoredState.count);

      expect(newJotai.get(newStore.count)).toBe(42);
    });

    test('atomicity of multi-value updates', () => {
      const computeCount = { sum: 0 };
      const store = createAtomicStore({
        a: 1,
        b: 2,
        get sum() {
          computeCount.sum++;
          return this.a + this.b;
        },
        updateValues(newA: number, newB: number) {
          return { a: newA, b: newB };
        },
      });

      const jotai = createStore();

      // Initialize and reset compute count
      jotai.get(store.sum);
      computeCount.sum = 0;

      // Update both 'a' and 'b' atomically
      jotai.set(store.updateValues, 3, 4);
      expect(jotai.get(store.sum)).toBe(7);
      expect(computeCount.sum).toBe(1); // Should only recompute once
    });
  });

  describe('React Integration', () => {
    test('React component usage with atomicStore', () => {
      // Define the store
      const store = createAtomicStore({
        count: 0,
        get doubleCount() {
          return this.count * 2;
        },
        increment() {
          return { count: this.count + 1 };
        },
      });

      // Define the component
      const CounterComponent = () => {
        const count = useAtomValue(store.count);
        const doubleCount = useAtomValue(store.doubleCount);
        const increment = useSetAtom(store.increment);

        return (
          <div>
            <p>Count: {count}</p>
            <p>Double Count: {doubleCount}</p>
            <button onClick={() => increment()}>Increment</button>
          </div>
        );
      };

      // Render the component within Jotai's Provider
      const { getByText } = render(
        <Provider>
          <CounterComponent />
        </Provider>,
      );

      // Verify initial state
      expect(getByText('Count: 0'));
      expect(getByText('Double Count: 0'));

      // Trigger the action
      fireEvent.click(getByText('Increment'));

      // Verify updated state
      expect(getByText('Count: 1'));
      expect(getByText('Double Count: 2'));
    });
  });
});
