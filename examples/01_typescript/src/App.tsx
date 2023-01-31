import React from 'react'
import { useAtom } from 'jotai/react'
import { atomWithStore } from 'jotai/zustand'
import create from 'zustand/vanilla'

const store = create(() => ({ count: 0 }))
store.subscribe(() => {
  console.log('new count', store.getState().count)
})

const stateAtom = atomWithStore(store)

const Counter = () => {
  const [state, setState] = useAtom(stateAtom)

  return (
    <>
      count: {state.count}
      <button
        onClick={() =>
          setState((prev) => ({ ...prev, count: prev.count + 1 }))
        }>
        inc atom
      </button>
    </>
  )
}

export default function App() {
  return (
    <div className="App">
      <h1>Hello CodeSandbox</h1>
      <h2>Start editing to see some magic happen!</h2>
      <Counter />
      <button
        onClick={() => store.setState((prev) => ({ count: prev.count + 1 }))}>
        inc store
      </button>
    </div>
  )
}
