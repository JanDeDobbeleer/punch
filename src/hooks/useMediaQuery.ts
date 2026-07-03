import { useEffect, useState } from 'react';

// Mobile breakpoint mirrors the `768px` threshold used in src/index.css.
export const MOBILE_BREAKPOINT = '(max-width: 767px)';

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 * Single source of truth for JS-driven responsive branching (the CSS side
 * handles purely visual breakpoints via @media rules in index.css).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent): void => setMatches(event.matches);

    setMatches(mql.matches);

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }

    // Safari < 14 fallback.
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_BREAKPOINT);
}
