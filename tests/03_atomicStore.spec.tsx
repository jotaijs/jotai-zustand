import React from 'react';
import { expect, test, describe } from 'vitest';
import { atom, createStore } from 'jotai';
import { render, fireEvent } from '@testing-library/react';
import { useAtomValue, useSetAtom, Provider } from 'jotai';
import { createAtomicStore } from '../src/atomicStore.js';
import type { Atom, WritableAtom, PrimitiveAtom } from 'jotai';

// Define the utility types
type ReadOnlyAtom<Value> = Atom<Value> & { write?: never };

type ReadWriteAtom<Value> = PrimitiveAtom<Value>;

type WriteOnlyAtom<Args extends unknown[]> = Omit<
  WritableAtom<unknown, Args, void>,
  'read'
>;

describe('AtomicStore', () => {
  describe('Basic Functionality', () => {
    test('creating store does not trigger computations', () => {
      const computeCount = { value: 0 };
      const store = createAtomicStore({
        base: 0,
        get value() {
          computeCount.value++;
          return this.base * 2;
        },
      });
      expect(computeCount.value).toBe(0); // Should be 0 because 'value' was not computed
    });

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

      // Initial read
      expect(jotai.get(store.value)).toBe(0);
      expect(computeCount.value).toBe(1); // Computed once upon first access

      // Subsequent read should use cached value
      expect(jotai.get(store.value)).toBe(0);
      expect(computeCount.value).toBe(1); // Still 1, no recomputation

      // Update base value should trigger recomputation
      jotai.set(store.base, 1);
      expect(jotai.get(store.value)).toBe(2);
      expect(computeCount.value).toBe(2); // Computed again after base change

      // Subsequent reads should use cached value
      expect(jotai.get(store.value)).toBe(2);
      expect(computeCount.value).toBe(2); // Still 2, no recomputation
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

      // No computations yet
      expect(computeCount).toEqual({ a: 0, b: 0 });

      // Access 'a' and 'b' for the first time
      expect(jotai.get(store.a)).toBe(0);
      expect(jotai.get(store.b)).toBe(0);
      expect(computeCount).toEqual({ a: 1, b: 1 });

      // Update only 'valueA'
      jotai.set(store.valueA, 1);
      expect(jotai.get(store.a)).toBe(2); // 'a' recomputed
      expect(jotai.get(store.b)).toBe(0); // 'b' remains the same
      expect(computeCount).toEqual({ a: 2, b: 1 });
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

      // No computations yet
      expect(computeCount).toEqual({ double: 0, quad: 0 });

      // Access 'quad' for the first time
      expect(jotai.get(store.quad)).toBe(0);
      expect(computeCount).toEqual({ double: 1, quad: 1 });

      // Update 'base'
      jotai.set(store.base, 1);
      expect(jotai.get(store.quad)).toBe(4);
      expect(computeCount).toEqual({ double: 2, quad: 2 });
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

      // Access 'sum' for the first time
      expect(jotai.get(store.sum)).toBe(0);
      expect(computeCount).toEqual({ a: 1, b: 1, sum: 1 });

      // Update 'x' only
      jotai.set(store.x, 1);
      expect(jotai.get(store.sum)).toBe(2);
      expect(computeCount).toEqual({
        a: 2, // Recomputed because 'x' changed
        b: 1, // Not recomputed
        sum: 2, // Recomputed because 'a' changed
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

      // Access 'sum' for the first time
      expect(jotai.get(store.sum)).toBe(6); // (1*2) + (1*3) + 1
      expect(computeCount).toEqual({ a: 1, b: 1, sum: 1 });

      // Update 'x'
      jotai.set(store.x, 2);
      expect(jotai.get(store.sum)).toBe(12); // (2*2) + (2*3) + 2
      expect(computeCount).toEqual({ a: 2, b: 2, sum: 2 });
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

      // Access 'd' for the first time
      expect(jotai.get(store.d)).toBe(6); // ((0 + 1) * 2 + (0 + 1)) * 2
      expect(computeCount).toEqual({ a: 1, b: 1, c: 1, d: 1 });

      // Update 'base'
      jotai.set(store.base, 1);
      expect(jotai.get(store.d)).toBe(12); // ((1 + 1) * 2 + (1 + 1)) * 2
      expect(computeCount).toEqual({ a: 2, b: 2, c: 2, d: 2 });
    });

    test('circular dependencies are detected', () => {
      const store = createAtomicStore({
        x: 0,
        get y() {
          return this.z + 1;
        },
        get z() {
          return this.y + 1;
        },
      });

      const jotai = createStore();

      // Accessing 'y' or 'z' should throw an error due to circular dependency
      expect(() => jotai.get(store.y)).toThrowError(/stack size exceeded/i);
      expect(() => jotai.get(store.z)).toThrowError(/stack size exceeded/i);
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

      // Update y while x is 0
      jotai.set(store.y, 1);
      expect(jotai.get(store.a)).toBe(0);
      expect(computeCount).toEqual({ a: 1, b: 1 });
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
      const store = createAtomicStore({
        get a() {
          return this.b;
        },
        get b() {
          return this.a;
        },
      });

      const jotai = createStore();

      // Accessing 'a' or 'b' should throw an error due to circular dependency
      expect(() => jotai.get(store.a)).toThrowError(/stack size exceeded/i);
      expect(() => jotai.get(store.b)).toThrowError(/stack size exceeded/i);
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

      // Initialize
      jotai.get(store.sum);
      expect(computeCount.sum).toBe(1);

      // Update both 'a' and 'b' atomically
      jotai.set(store.updateValues, 3, 4);
      expect(jotai.get(store.sum)).toBe(7);
      expect(computeCount.sum).toBe(2); // Should only recompute once
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

  describe('Type Safety', () => {
    test('store definition types', () => {
      // Valid store definitions - these should compile
      const validStore = createAtomicStore({
        count: 0,
        text: 'hello',
        items: [] as string[],
        get double() {
          return this.count * 2;
        },
        increment(n = 1) {
          return { count: this.count + n };
        },
        reset() {
          return { count: 0, text: '' };
        },
      });

      // Invalid action return - returning an invalid state key
      createAtomicStore({
        count: 0,
        // @ts-expect-error - Should error because 'invalid' is not a valid state key
        invalid() {
          return { invalid: 123 };
        },
      });

      // Invalid action return - returning non-partial state
      createAtomicStore({
        count: 0,
        // FIXME: DOESN'T WORK - @ts-expect-error - Should error because 'extra' is not a valid state key
        invalid() {
          return { extra: '', count: 0 };
        },
      });

      // Invalid derived state - accessing invalid property
      createAtomicStore({
        count: 0,
        get invalid(): number {
          // @ts-expect-error - Should error because 'missing' does not exist on state
          return this.missing;
        },
      });
    });

    test('returned atom types', () => {
      const store = createAtomicStore({
        count: 0,
        text: '',
        get double() {
          return this.count * 2;
        },
        increment(n = 1) {
          return { count: this.count + n };
        },
        setText(s: string) {
          return { text: s };
        },
      });

      // Type assertions for returned atoms
      const countAtom: ReadWriteAtom<number> = store.count;
      const textAtom: ReadWriteAtom<string> = store.text;
      const doubleAtom: ReadOnlyAtom<number> = store.double;
      const incrementAtom: WriteOnlyAtom<[number?]> = store.increment;
      const setTextAtom: WritableAtom<void, [string], void> = store.setText;

      // @ts-expect-error - `store.text` is a PrimitiveAtom<string>, not a ReadOnlyAtom<string>
      const invalidTextAtom: ReadOnlyAtom<string> = store.text;

      // @ts-expect-error - `store.increment` is a writable atom, not a ReadOnlyAtom<void>
      const invalidIncrementAtom: ReadOnlyAtom<void> = store.increment;
    });

    test('action return type safety', () => {
      // Valid action returns
      createAtomicStore({
        count: 0,
        nested: { value: '' },
        items: [] as string[],
        validAction1() {
          return { count: 1 };
        },
        validAction2() {
          return { nested: { value: 'new' } };
        },
        validAction3() {
          return { items: ['new'] };
        },
        validAction4() {
          /* no return */
        },
      });

      // Invalid action returns
      createAtomicStore({
        count: 0,
        nested: { value: '' },
        items: [] as string[],
        // @ts-expect-error - Cannot partially update nested objects with invalid keys
        invalid() {
          return { nested: { invalid: true } };
        },
      });

      createAtomicStore({
        count: 0,
        nested: { value: '' },
        items: [] as string[],
        // @ts-expect-error - Cannot return non-existent state keys
        invalid() {
          return { extra: 123 };
        },
      });
    });
  });
});
