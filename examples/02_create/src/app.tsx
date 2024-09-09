import { create } from 'jotai-zustand';

const useCountStore = create(
  {
    count: 0,
  },
  (set) => ({
    inc: () => set((prev) => ({ count: prev.count + 1 })),
  }),
);

const Counter = () => {
  const count = useCountStore((state) => state.count);
  const inc = useCountStore((state) => state.inc);

  return (
    <>
      count: {count}
      <button onClick={inc}>inc</button>
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
