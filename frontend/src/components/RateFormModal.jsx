import { useState } from 'react'

const CATEGORIES = [
  { value: 'OPD',       label: 'OPD' },
  { value: 'IPD',       label: 'IPD' },
  { value: 'ROOM',      label: 'Room' },
  { value: 'PROCEDURE', label: 'Procedure' },
  { value: 'NURSING',   label: 'Nursing' },
  { value: 'OTHER',     label: 'Other' },
]

const COMMON_UNITS = [
  'per visit',
  'per day',
  'per procedure',
  'per night',
  'per admission',
  'per trip',
  'per item',
]

const empty = {
  name: '',
  category: 'OPD',
  default_rate: '',
  unit: 'per visit',
  is_active: true,
  description: '',
}

export default function RateFormModal({ apiClient, onClose, onSaved, editRate }) {
  const isEdit = Boolean(editRate)

  const [form, setForm] = useState(() =>
    editRate
      ? {
          name: editRate.name,
          category: editRate.category,
          default_rate: String(editRate.default_rate),
          unit: editRate.unit,
          is_active: editRate.is_active,
          description: editRate.description || '',
        }
      : empty
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let data
      if (isEdit) {
        ;({ data } = await apiClient.patch(`/rates/${editRate.id}/`, form))
      } else {
        ;({ data } = await apiClient.post('/rates/', form))
      }
      onSaved(data, isEdit)
      onClose()
    } catch (err) {
      const detail = err.response?.data
      setError(
        detail && typeof detail === 'object'
          ? Object.entries(detail)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join(' | ')
          : 'Failed to save. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800">
              {isEdit ? 'Edit Service Charge' : 'New Service Charge'}
            </h2>
            <p className="text-xs text-gray-400">Shree Bal Rugnalaya</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full text-xl transition"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          <div>
            <label className="label">Service Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Room Charges – Private"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <select className="input" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Default Rate (₹) *</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.default_rate}
                onChange={set('default_rate')}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Unit</label>
            <input
              className="input"
              value={form.unit}
              onChange={set('unit')}
              placeholder="per visit / per day"
              list="unit-options"
            />
            <datalist id="unit-options">
              {COMMON_UNITS.map((u) => <option key={u} value={u} />)}
            </datalist>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-700">Active</p>
              <p className="text-xs text-gray-400">Visible in quick-add chips</p>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.is_active ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  form.is_active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="label">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.description}
              onChange={set('description')}
              placeholder="Any notes about this charge"
            />
          </div>

        </form>

        {/* Error */}
        {error && (
          <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100 shrink-0">
            ⚠ {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 border border-gray-300 text-gray-600 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.name || form.default_rate === ''}
            className="flex-1 bg-blue-700 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-800 active:scale-95 transition disabled:opacity-50"
          >
            {loading
              ? 'Saving…'
              : isEdit
                ? '✏️ Update Charge'
                : '💾 Save Charge'}
          </button>
        </div>

      </div>
    </div>
  )
}
