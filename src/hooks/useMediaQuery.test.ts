import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { MOBILE_BREAKPOINT, useIsMobile, useMediaQuery } from './useMediaQuery'

afterEach(() => {
  vi.restoreAllMocks()
})

type MatchMediaMock = {
  dispatchChange: (matches: boolean) => void
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

function mockMatchMedia(initialMatches: boolean): MatchMediaMock {
  let listener: ((event: MediaQueryListEvent) => void) | undefined
  let matches = initialMatches
  const addEventListener = vi.fn((_type: 'change', handler: (event: MediaQueryListEvent) => void) => {
    listener = handler
  })
  const removeEventListener = vi.fn((_type: 'change', handler: (event: MediaQueryListEvent) => void) => {
    if (listener === handler) {
      listener = undefined
    }
  })

  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query,
    matches,
    addEventListener,
    removeEventListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  } as MediaQueryList)))

  return {
    dispatchChange(nextMatches) {
      matches = nextMatches
      listener?.({ matches: nextMatches } as MediaQueryListEvent)
    },
    addEventListener,
    removeEventListener,
  }
}

describe('useMediaQuery', () => {
  test('returns the current matchMedia value', () => {
    mockMatchMedia(true)

    const { result } = renderHook(() => useMediaQuery('(max-width: 900px)'))

    expect(result.current).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 900px)')
  })

  test('useIsMobile follows the mobile breakpoint query', () => {
    mockMatchMedia(true)
    expect(renderHook(() => useIsMobile()).result.current).toBe(true)

    mockMatchMedia(false)
    expect(renderHook(() => useIsMobile()).result.current).toBe(false)
    expect(window.matchMedia).toHaveBeenCalledWith(MOBILE_BREAKPOINT)
  })

  test('updates when the media query emits a change event', () => {
    const matchMedia = mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 900px)'))

    expect(result.current).toBe(false)

    act(() => {
      matchMedia.dispatchChange(true)
    })

    expect(result.current).toBe(true)
  })

  test('removes the change listener on unmount', () => {
    const matchMedia = mockMatchMedia(false)
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 900px)'))

    const registeredHandler = matchMedia.addEventListener.mock.calls[0]?.[1]

    unmount()

    expect(matchMedia.removeEventListener).toHaveBeenCalledWith('change', registeredHandler)
  })
})
