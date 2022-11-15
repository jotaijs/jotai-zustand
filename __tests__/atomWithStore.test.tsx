import React, { StrictMode } from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { useAtom } from 'jotai'
import { atomWithStore } from 'jotai/zustand'
import create from 'zustand/vanilla'

it('count state', async () => {
  const store = create(() => ({ count: 0 }))
  const stateAtom = atomWithStore(store)
  store.setState((prev) => ({ count: prev.count + 1 }))

  const Counter = () => {
    const [state, setState] = useAtom(stateAtom)

    return (
      <>
        count: {state.count}
        <button
          onClick={() =>
            setState((prev) => ({ ...prev, count: prev.count + 1 }))
          }>
          button
        </button>
      </>
    )
  }

  const { findByText, getByText } = render(
    <StrictMode>
      <Counter />
    </StrictMode>
  )

  await findByText('count: 1')

  fireEvent.click(getByText('button'))
  await findByText('count: 2')
  expect(store.getState().count).toBe(2)

  act(() => {
    store.setState((prev) => ({ count: prev.count + 1 }))
  })
  await findByText('count: 3')
  expect(store.getState().count).toBe(3)
})