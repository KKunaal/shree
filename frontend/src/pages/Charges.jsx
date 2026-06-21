import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { createApiClient } from '../api'
import Header from '../components/Header'
import RateFormModal from '../components/RateFormModal'

const CATEGORY_META = {
  OPD:       { label: 'OPD',       color: 'bg-blue-100 text-blue-700' },
  IPD:       { label: 'IPD',       color: 'bg-purple-100 text-purple-700' },
  ROOM:      { label: 'Room',      color: 'bg-indigo-100 text-indigo-700' },
  PROCEDURE: { label: 'Procedure', color: 'bg-orange-100 text-orange-700' },
  NURSING:   { label: 'Nursing',   color: 'bg-pink-100 text-pink-700' },
  OTHER:     { label: 'Other',     color: 'bg-gray-100 text-gray-600' },
}

const FILTER_TABS = [
  { key: 'ALL',       label: 'All' },
  { key: 'OPD',       label: 'OPD' },
  { key: 'IPD',       label: 'IPD' },
  { key: 'ROOM',      label: 'Room' },
  { key: 'PROCEDURE', label: 'Procedure' },
  { key: 'NURSING',   label: 'Nursing' },
  { key: 'OTHER',     label: 'Other' },
]

export default function Charges({ onTabChange }) {
  const { user, logout } = useAuth()
  const apiClient = useMemo(() => createApiClient(user.token), [user.token])

  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editRate, setEditRate] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchRates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/rates/')
      setRates(res.data)
    } catch (err) {
      if (err.response?.status === 401) logout()
    } finally {
      setLoading(false)
    }
  }, [apiClient, logout])

  useEffect(() => { fetchRates() }, [fetchRates])

  const filtered = rates.filter((r) => {
    const matchCat = categoryFilter === 'ALL' || r.category === categoryFilter
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // ── handlers ────────────────────────────────────────────────────────────────

  const handleRateSaved = (rate, wasEdit) => {
    if (wasEdit) {
      setRates((prev) => prev.map((r) => (r.id === rate.id ? rate : r)))
      showToast(`✓ "${rate.name}" updated`)
    } else {
      setRates((prev) => [...prev, rate])
      showToast(`✓ "${rate.name}" added`)
    }
  }

  const handleToggleActive = async (rate) => {
    try {
      const { data } = await apiClient.patch(`/rates/${rate.id}/`, {
        is_active: !rate.is_active,
      })
      setRates((prev) => prev.map((r) => (r.id === data.id ? data : r)))
    } catch {
      showToast('⚠ Failed to update status.', 'error')
    }
  }

  const handleDeleteConfirmed = async () => {
    const rate = confirmDelete
    setConfirmDelete(null)
    try {
      await apiClient.delete(`/rates/${rate.id}/`)
      setRates((prev) => prev.filter((r) => r.id !== rate.id))
      showToast(`✓ "${rate.name}" deleted`)
    } catch {
      showToast('⚠ Failed to delete. Please try again.', 'error')
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-[68px] left-4 right-4 z-50 text-white text-sm font-medium rounded-xl px-4 py-3 shadow-lg
            ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Sticky tab bar */}
      <div className="bg-white border-b sticky top-[60px] z-30">
        <div className="max-w-2xl mx-auto flex">
          <button
            onClick={() => onTabChange('dashboard')}
            className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => onTabChange('bills')}
            className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
          >
            📋 Bills
          </button>
          <button className="px-6 py-3 text-sm font-semibold text-blue-700 border-b-2 border-blue-700">
            ⚙️ Charges
            {rates.length > 0 && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-600 rounded-full px-2 py-0.5">
                {rates.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                categoryFilter === key
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Search service name…"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {/* Rate list */}
      <main className="max-w-2xl mx-auto w-full px-4 py-4 pb-28 space-y-2">
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-3xl mb-3 animate-spin">⏳</div>
            <p className="text-sm">Loading charges…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">⚙️</div>
            <p className="font-medium">
              {search ? 'No matching charges' : 'No charges configured'}
            </p>
            <p className="text-sm mt-1">
              {search ? 'Try a different search term' : 'Tap + to add the first charge'}
            </p>
          </div>
        ) : (
          filtered.map((rate) => (
            <div
              key={rate.id}
              className={`bg-white rounded-xl border flex items-center gap-3 px-4 py-3 transition
                ${rate.is_active ? 'border-gray-100 shadow-sm' : 'border-gray-100 opacity-55'}`}
            >
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800 truncate">
                    {rate.name}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0
                      ${CATEGORY_META[rate.category]?.color}`}
                  >
                    {CATEGORY_META[rate.category]?.label}
                  </span>
                  {!rate.is_active && (
                    <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full shrink-0">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{rate.unit}</p>
              </div>

              {/* Rate */}
              <div className="text-right shrink-0">
                <div className="text-base font-bold text-blue-700">
                  ₹{parseFloat(rate.default_rate).toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Active toggle */}
                <button
                  onClick={() => handleToggleActive(rate)}
                  title={rate.is_active ? 'Deactivate' : 'Activate'}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    rate.is_active ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      rate.is_active ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>

                <button
                  onClick={() => setEditRate(rate)}
                  title="Edit"
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                >
                  ✏️
                </button>
                <button
                  onClick={() => setConfirmDelete(rate)}
                  title="Delete"
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-blue-700 hover:bg-blue-800 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl font-light active:scale-90 transition-transform z-40"
        title="Add new charge"
      >
        +
      </button>

      {/* Add modal */}
      {showForm && (
        <RateFormModal
          apiClient={apiClient}
          onClose={() => setShowForm(false)}
          onSaved={handleRateSaved}
        />
      )}

      {/* Edit modal */}
      {editRate && (
        <RateFormModal
          apiClient={apiClient}
          editRate={editRate}
          onClose={() => setEditRate(null)}
          onSaved={handleRateSaved}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-4xl mb-3 text-center">🗑️</div>
            <h3 className="text-base font-bold text-gray-800 text-center">Delete Charge?</h3>
            <p className="text-sm text-gray-500 mt-2 text-center">
              Delete{' '}
              <strong className="text-gray-700">"{confirmDelete.name}"</strong>?
              This cannot be undone.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-700 active:scale-95 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
