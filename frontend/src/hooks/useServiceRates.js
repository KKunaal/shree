/**
 * useServiceRates — fetches active service rates from /api/rates/?is_active=true
 * and returns them split into OPD and IPD lists, each shaped as:
 *   { name: string, rate: string }
 *
 * Categories IPD / ROOM / PROCEDURE / NURSING / OTHER all map to IPD-type bills.
 * Category OPD maps to OPD-type bills.
 *
 * The hook is safe to use by both doctor and reception roles — the backend
 * GET permission on /api/rates/ is open to any authenticated user.
 */

import { useState, useEffect } from 'react'

const IPD_CATS = new Set(['IPD', 'ROOM', 'PROCEDURE', 'NURSING', 'OTHER'])

export function useServiceRates(apiClient) {
  const [ipdRates, setIpdRates] = useState([])
  const [opdRates, setOpdRates] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!apiClient) return
    let cancelled = false

    apiClient.get('/rates/?is_active=true')
      .then(({ data }) => {
        if (cancelled) return
        const all = Array.isArray(data) ? data : (data.results ?? [])
        setIpdRates(
          all
            .filter((r) => IPD_CATS.has(r.category))
            .map((r) => ({ name: r.name, rate: String(parseFloat(r.default_rate) || 0) }))
        )
        setOpdRates(
          all
            .filter((r) => r.category === 'OPD')
            .map((r) => ({ name: r.name, rate: String(parseFloat(r.default_rate) || 0) }))
        )
      })
      .catch(() => {}) // silently fail — chips won't appear, user sees empty-state hint
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [apiClient])

  return { ipdRates, opdRates, loading }
}
