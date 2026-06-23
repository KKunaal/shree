/**
 * useUrlState — thin wrapper that keeps a value in sync with a URL search param.
 *
 * Usage:
 *   const [value, setValue] = useUrlState('tab', 'bills')
 *
 * • On mount the initial value is read from the URL if the param is present,
 *   otherwise the provided default is used (and written into the URL).
 * • Every call to setValue updates the URL without adding a history entry
 *   (replaceState), so the browser back button is not polluted.
 * • Multiple params can coexist — only the named param is touched.
 */

import { useState, useCallback, useEffect } from 'react'

export function useUrlState(param, defaultValue) {
  const [value, _setValue] = useState(() => {
    const sp = new URLSearchParams(window.location.search)
    return sp.has(param) ? sp.get(param) : defaultValue
  })

  // Keep URL in sync whenever value changes
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (value === defaultValue) {
      sp.delete(param)      // keep URL clean when at default
    } else {
      sp.set(param, value)
    }
    const qs = sp.toString()
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, '', newUrl)
  }, [param, value, defaultValue])

  const setValue = useCallback((valOrFn) => {
    _setValue((prev) => (typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn))
  }, [])

  return [value, setValue]
}
