import { act, renderHook, waitFor } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useTempoState } from './useTempoState'
import type { TempoSettings } from '../types'

const SETTINGS: TempoSettings = {
  accentColor: '#2563eb',
  hoursPerDay: 8,
  showWeekend: false,
}

function dispatchPointerEvent(type: string, clientY?: number): void {
  const event = new Event(type) as Event & { clientY?: number }
  if (clientY !== undefined) {
    Object.defineProperty(event, 'clientY', { value: clientY })
  }
  window.dispatchEvent(event)
}

describe('useTempoState pointer drag creation', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('opens the entry modal after a pointer drag in week view', async () => {
    const { result } = renderHook(() => useTempoState(SETTINGS))
    const setPointerCapture = vi.fn()

    act(() => {
      result.current.weekProps?.weekDays[0].onPointerDown({
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
        clientY: 100,
        currentTarget: {
          getBoundingClientRect: () => ({ top: 0 } as DOMRect),
          setPointerCapture,
        },
        preventDefault: vi.fn(),
      } as unknown as ReactPointerEvent<Element>)
    })

    act(() => {
      dispatchPointerEvent('pointermove', 200)
      dispatchPointerEvent('pointerup')
    })

    expect(setPointerCapture).toHaveBeenCalledWith(1)

    await waitFor(() => {
      expect(result.current.modalOpen).toBe(true)
      expect(result.current.modalProps?.modalTitle).toBe('Log hours')
    })
  })
})
