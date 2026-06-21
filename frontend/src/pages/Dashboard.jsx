import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { createApiClient } from '../api'
import Header from '../components/Header'

export default function Dashboard({ onTabChange }) {
  const { user, logout } = useAuth()
  const apiClient = useMemo(() => createApiClient(user.token), [user.token])

  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await apiClient.get('/metrics/')
      setMetrics(res.data)
    } catch (err) {
      if (err.response?.status === 401) logout()
      else setError(true)
    } finally {
      setLoading(false)
    }
  }, [apiClient, logout])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  const fAmt = (n) =>
    `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onRefresh={fetchMetrics} />

      {/* Tab bar */}
      <div className="bg-white border-b sticky top-[60px] z-30">
        <div className="max-w-2xl mx-auto flex">
          {/* Dashboard — active */}
          <button className="px-6 py-3 text-sm font-semibold text-blue-700 border-b-2 border-blue-700">
            📊 Dashboard
          </button>
          <button
            onClick={() => onTabChange('bills')}
            className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
          >
            📋 Bills
          </button>
          <button
            onClick={() => onTabChange('charges')}
            className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
          >
            ⚙️ Charges
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <div className="text-4xl animate-spin mb-3">⏳</div>
          <p className="text-sm">Loading metrics…</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <div className="text-5xl mb-3">⚠️</div>
          <p className="font-medium text-gray-600">Could not load metrics</p>
          <button
            onClick={fetchMetrics}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : metrics ? (
        <main className="max-w-2xl mx-auto w-full px-4 py-6 space-y-8">

          {/* ── Today ──────────────────────────────────────────────────── */}
          <section>
            <SectionHeading icon="📅" label="Today" date={metrics.as_of} />
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                icon="🏥"
                label="IPD Admissions"
                value={metrics.today_ipd_bills}
                color="blue"
              />
              <MetricCard
                icon="🩺"
                label="OPD Visits"
                value={metrics.today_opd_bills}
                color="green"
              />
              <MetricCard
                icon="💰"
                label="Collected"
                value={fAmt(metrics.today_collected)}
                color="amber"
              />
            </div>
          </section>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-200" />

          {/* ── All Time ───────────────────────────────────────────────── */}
          <section>
            <SectionHeading icon="📈" label="All Time" />
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                icon="🏥"
                label="Total IPD Bills"
                value={metrics.total_ipd_bills}
                color="blue"
              />
              <MetricCard
                icon="🩺"
                label="Total OPD Bills"
                value={metrics.total_opd_bills}
                color="green"
              />
              <MetricCard
                icon="💰"
                label="Total Collected"
                value={fAmt(metrics.total_collected)}
                color="amber"
              />
            </div>
          </section>

          {/* Footer note */}
          {metrics.metrics_updated_at && (
            <p className="text-center text-xs text-gray-400 pb-6">
              Metrics last updated{' '}
              {new Date(metrics.metrics_updated_at).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </main>
      ) : null}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function SectionHeading({ icon, label, date }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {icon} {label}
      </span>
      {date && (
        <span className="text-xs text-gray-400">
          (
          {new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
          )
        </span>
      )}
    </div>
  )
}

const COLOR_MAP = {
  blue:  { card: 'bg-blue-50 border-blue-100',  text: 'text-blue-700',  icon: 'bg-blue-100'  },
  green: { card: 'bg-green-50 border-green-100', text: 'text-green-700', icon: 'bg-green-100' },
  amber: { card: 'bg-amber-50 border-amber-100', text: 'text-amber-700', icon: 'bg-amber-100' },
}

function MetricCard({ icon, label, value, color }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${c.card}`}>
      <span className={`text-xl w-9 h-9 flex items-center justify-center rounded-xl ${c.icon}`}>
        {icon}
      </span>
      <span className={`text-xs font-medium leading-tight ${c.text} opacity-80`}>
        {label}
      </span>
      <span className={`text-2xl font-bold leading-tight ${c.text}`}>
        {value}
      </span>
    </div>
  )
}
