import { createAtomicStore } from '../../../src/index.js';
import { useAtomValue, useSetAtom } from 'jotai/react';

const store = createAtomicStore({
  count: 0,
  get half() {
    return this.count / 2;
  },
  get dbl() {
    console.log('dbl - count=', this.count);
    return this.half * 4;
  },
  inc(n = 1) {
    return { count: this.count + n };
  },
});

const Counter = () => {
  const count = useAtomValue(store.count);
  const half = useAtomValue(store.half);
  const dbl = useAtomValue(store.dbl);
  const inc = useSetAtom(store.inc);

  return (
    <>
      <div>count: {count}</div>
      <div>half: {half}</div>
      <div>dbl: {dbl}</div>
      <button onClick={() => inc()}>inc</button>
    </>
  );
};

export default function App() {
  return (
    <div className="App">
      <Counter />
    </div>
  );
}
