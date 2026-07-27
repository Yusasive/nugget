import { useEffect, useState } from 'react';

/** Delays reflecting a fast-changing value (e.g. a search box) so a query
 * keyed on it doesn't refire on every keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
