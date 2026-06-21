import { useState, useEffect } from 'react'

const CHARGE_TYPES = [
  { name: 'Room Charges',       rate: '2500' },
  { name: 'I.P.D Charges',      rate: '1400' },
  { name: 'Monitoring',         rate: '100'  },
  { name: 'Neocan',             rate: '300'  },
  { name: 'Consulting Charges', rate: '300'  },
  { name: 'IV Fluids',          rate: '150'  },
  { name: 'Nursing Charges',    rate: '300'  },
  { name: 'Nebulization',       rate: '20'   },
  { name: 'Emergency Charges',  rate: '500'  },
  { name: 'O2 Charges',         rate: '1500' },
  { name: 'Procedure Charges',  rate: ''     },
  { name: 'Other Charges',      rate: ''     },
]

const empty = {
  patient_name: '', address: '', ipd_no: '',
  admitted_on: '', discharged_on: '',
  room_no: '', ward: '', total_stay: '',
  advance_paid: '0',
}

export default function CreateBillModal({ apiClient, onClose, onCreated, onUpdated, editBill }) {
  const isEdit = Boolean(editBill)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() =>
    editBill
      ? {
          patient_name: editBill.patient_name || '',
          address: editBill.address || '',
          ipd_no: editBill.ipd_no || '',
          admitted_on: editBill.admitted_on || '',
          discharged_on: editBill.discharged_on || '',
          room_no: editBill.room_no || '',
          ward: editBill.ward || '',
          total_stay: String(editBill.total_stay ?? ''),
          advance_paid: String(editBill.advance_paid ?? '0'),
        }
      : empty
  )
  const [lineItems, setLineItems] = useState(() =>
    editBill?.line_items?.length
      ? editBill.line_items.map((i) => ({
          name: i.name,
          rate_per_day: String(i.rate_per_day),
          days: String(i.days),
        }))
      : []
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-compute total stay when both dates are set
  useEffect(() => {
    if (form.admitted_on && form.discharged_on) {
      const days = Math.ceil(
        (new Date(form.discharged_on) - new Date(form.admitted_on)) / 86_400_000
      )
      if (days >= 0) setForm((f) => ({ ...f, total_stay: String(days) }))
    }
  }, [form.admitted_on, form.discharged_on])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const totalBill = lineItems.reduce(
    (sum, i) => sum + (parseFloat(i.rate_per_day) || 0) * (parseInt(i.days) || 0),
    0
  )
  const netBill = totalBill - (parseFloat(form.advance_paid) || 0)

  const addCharge = (ct) =>
    setLineItems((prev) => [
      ...prev,
      { name: ct.name, rate_per_day: ct.rate, days: form.total_stay || '1' },
    ])

  const updateItem = (idx, field, val) =>
    setLineItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    )

  const removeItem = (idx) =>
    setLineItems((prev) => prev.filter((_, i) => i !== idx))

  const canAdvance = form.patient_name.trim() && form.admitted_on

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        total_stay: parseInt(form.total_stay) || 0,
        line_items: lineItems.map((i) => ({
          name: i.name,
          rate_per_day: i.rate_per_day,
          days: parseInt(i.days) || 0,
        })),
      }
      let data
      if (isEdit) {
        ;({ data } = await apiClient.patch(`/bills/${editBill.id}/`, payload))
        onUpdated?.(data)
      } else {
        ;({ data } = await apiClient.post('/bills/', payload))
        onCreated?.(data)
      }
      onClose()
    } catch (err) {
      const detail = err.response?.data
      setError(
        detail && typeof detail === 'object'
          ? Object.entries(detail)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join(' | ')
          : 'Failed to save bill. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl max-h-[93vh] flex flex-col shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800">{isEdit ? 'Edit Bill' : 'New Patient Bill'}</h2>
            <p className="text-xs text-gray-400">Shree Bal Rugnalaya</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full text-xl transition"
          >
            ×
          </button>
        </div>

        {/* ── Step tabs ── */}
        <div className="flex border-b shrink-0">
          {['Patient Details', 'Charges & Summary'].map((label, i) => (
            <button
              key={label}
              onClick={() => (i === 0 || canAdvance) && setStep(i + 1)}
              className={`flex-1 py-3 text-sm font-medium transition
                ${step === i + 1
                  ? 'text-blue-700 border-b-2 border-blue-700'
                  : canAdvance || i === 0
                    ? 'text-gray-500 hover:text-gray-700'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4">

          {/* Step 1 — Patient Details */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2">
                <label className="label">Patient Name *</label>
                <input className="input" value={form.patient_name} onChange={set('patient_name')} placeholder="Full name" />
              </div>
              <div className="col-span-2">
                <label className="label">Address</label>
                <input className="input" value={form.address} onChange={set('address')} placeholder="Village / City" />
              </div>
              <div>
                <label className="label">IPD No</label>
                <input className="input" value={form.ipd_no} onChange={set('ipd_no')} placeholder="IPD-001" />
              </div>
              <div>
                <label className="label">Ward</label>
                <input className="input" value={form.ward} onChange={set('ward')} placeholder="General" />
              </div>
              <div>
                <label className="label">Room No</label>
                <input className="input" value={form.room_no} onChange={set('room_no')} placeholder="12" />
              </div>
              <div>
                <label className="label">Total Stay (days)</label>
                <input
                  className="input"
                  type="number" min="0"
                  value={form.total_stay}
                  onChange={set('total_stay')}
                  placeholder="Auto from dates"
                />
              </div>
              <div>
                <label className="label">Admitted On *</label>
                <input className="input" type="date" value={form.admitted_on} onChange={set('admitted_on')} />
              </div>
              <div>
                <label className="label">Discharged On</label>
                <input className="input" type="date" value={form.discharged_on} onChange={set('discharged_on')} />
              </div>
            </div>
          )}

          {/* Step 2 — Charges */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Quick-add chips */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Quick-add charges
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {CHARGE_TYPES.map((ct) => (
                    <button
                      key={ct.name}
                      onClick={() => addCharge(ct)}
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-100 active:scale-95 transition"
                    >
                      + {ct.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Added charges */}
              {lineItems.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Added charges
                  </p>
                  {/* Column headers */}
                  <div className="grid grid-cols-12 text-[10px] font-semibold text-gray-400 uppercase px-1 mb-1">
                    <span className="col-span-4">Charge</span>
                    <span className="col-span-3 text-right">₹/Day</span>
                    <span className="col-span-2 text-center">Days</span>
                    <span className="col-span-3 text-right">Amount</span>
                  </div>
                  <div className="space-y-1.5">
                    {lineItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                        <div className="col-span-4 text-xs font-medium text-gray-700 truncate leading-tight">
                          {item.name}
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number" min="0"
                            value={item.rate_per_day}
                            onChange={(e) => updateItem(idx, 'rate_per_day', e.target.value)}
                            className="w-full text-right text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number" min="0"
                            value={item.days}
                            onChange={(e) => updateItem(idx, 'days', e.target.value)}
                            className="w-full text-center text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-1">
                          <span className="text-xs font-semibold text-gray-700">
                            ₹{(
                              (parseFloat(item.rate_per_day) || 0) *
                              (parseInt(item.days) || 0)
                            ).toLocaleString('en-IN')}
                          </span>
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-red-400 hover:text-red-600 text-lg leading-none ml-0.5 transition"
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">💊</p>
                  <p className="text-sm font-medium">No charges added</p>
                  <p className="text-xs mt-1">Tap the chips above to add charges</p>
                </div>
              )}

              {/* Totals summary */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-2 border border-blue-100">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Total Bill</span>
                  <span className="font-semibold">₹{totalBill.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <label className="shrink-0">Less / Advance</label>
                  <input
                    type="number" min="0"
                    value={form.advance_paid}
                    onChange={set('advance_paid')}
                    className="w-28 text-right text-sm border border-blue-200 rounded-lg px-3 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="flex justify-between text-base font-bold text-blue-800 border-t border-blue-200 pt-2">
                  <span>Net Payable</span>
                  <span>₹{netBill.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100 shrink-0">
            ⚠ {error}
          </div>
        )}

        {/* ── Footer actions ── */}
        <div className="px-5 py-4 border-t flex gap-3 shrink-0">
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!canAdvance}
              className="flex-1 bg-blue-700 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-800 active:scale-95 transition disabled:opacity-50"
            >
              Next: Add Charges →
            </button>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-5 border border-gray-300 text-gray-600 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || lineItems.length === 0}
                className="flex-1 bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 active:scale-95 transition disabled:opacity-50"
              >
                {loading
                  ? 'Saving…'
                  : isEdit
                    ? `✏️ Update Bill · ₹${netBill.toLocaleString('en-IN')}`
                    : `💾 Save Bill · ₹${netBill.toLocaleString('en-IN')}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
