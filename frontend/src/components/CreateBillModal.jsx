import { useState, useEffect } from 'react'

const IPD_CHARGES = [
  { name: 'Room Charges – General', rate: '1500' },
  { name: 'Room Charges – Private', rate: '2500' },
  { name: 'I.P.D Charges',          rate: '1400' },
  { name: 'Monitoring',             rate: '100'  },
  { name: 'Neocan',                 rate: '300'  },
  { name: 'Consulting Charges',     rate: '300'  },
  { name: 'IV Fluids',              rate: '150'  },
  { name: 'Nursing Charges',        rate: '300'  },
  { name: 'Nebulization',           rate: '20'   },
  { name: 'O2 Charges',             rate: '1500' },
  { name: 'Emergency Charges',      rate: '500'  },
  { name: 'Procedure Charges',      rate: ''     },
  { name: 'Other Charges',          rate: ''     },
]

const OPD_CHARGES = [
  { name: 'OPD – First Visit',      rate: '300' },
  { name: 'OPD – Second Visit',     rate: '200' },
  { name: 'OPD – Follow-up',        rate: '150' },
  { name: 'Emergency Consultation', rate: '500' },
  { name: 'Dressing',               rate: '200' },
  { name: 'Injection / IV',         rate: '50'  },
  { name: 'ECG',                    rate: '250' },
  { name: 'X-Ray',                  rate: '400' },
  { name: 'Sonography',             rate: '700' },
  { name: 'Procedure Charges',      rate: ''    },
  { name: 'Other Charges',          rate: ''    },
]

const emptyIPD = {
  patient_name: '', address: '', mobile_no: '', gender: '', weight: '',
  admitted_on: '', discharged_on: '',
  room_no: '', ward: '', total_stay: '',
  advance_paid: '0', discount: '', discount_note: '',
}

const emptyOPD = {
  patient_name: '', address: '', mobile_no: '', gender: '', weight: '',
  visit_date: '',
  advance_paid: '0', discount: '', discount_note: '',
}

/** Returns today's date as YYYY-MM-DD in the browser's local time zone. */
const todayISO = () => new Date().toLocaleDateString('en-CA')

export default function CreateBillModal({ apiClient, onClose, onCreated, onUpdated, editBill }) {
  const isEdit = Boolean(editBill)
  const defaultType = editBill?.bill_type || 'IPD'

  const [billType, setBillType] = useState(defaultType)
  const [step, setStep] = useState(1)

  const [form, setForm] = useState(() => {
    const today = todayISO()
    if (!editBill) {
      return billType === 'IPD'
        ? { ...emptyIPD, admitted_on: today }
        : { ...emptyOPD, visit_date: today }
    }
    return {
      patient_name:   editBill.patient_name || '',
      address:        editBill.address || '',
      mobile_no:      editBill.mobile_no || '',
      gender:         editBill.gender || '',
      weight:         editBill.weight != null ? String(editBill.weight) : '',
      admitted_on:    editBill.admitted_on || '',
      discharged_on:  editBill.discharged_on || '',
      room_no:        editBill.room_no || '',
      ward:           editBill.ward || '',
      total_stay:     String(editBill.total_stay ?? ''),
      visit_date:     editBill.visit_date || '',
      advance_paid:   String(editBill.advance_paid ?? '0'),
      discount:       editBill.discount != null ? String(editBill.discount) : '',
      discount_note:  editBill.discount_note || '',
    }
  })

  const [lineItems, setLineItems] = useState(() =>
    editBill?.line_items?.length
      ? editBill.line_items.map((i) => ({
          name: i.name, rate_per_day: String(i.rate_per_day), days: String(i.days),
        }))
      : []
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-compute stay days for IPD
  useEffect(() => {
    if (billType === 'IPD' && form.admitted_on && form.discharged_on) {
      const days = Math.ceil(
        (new Date(form.discharged_on) - new Date(form.admitted_on)) / 86_400_000
      )
      if (days >= 0) setForm((f) => ({ ...f, total_stay: String(days) }))
    }
  }, [form.admitted_on, form.discharged_on, billType])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const charges = billType === 'OPD' ? OPD_CHARGES : IPD_CHARGES
  const defaultDays = billType === 'OPD' ? '1' : (form.total_stay || '1')

  const addCharge = (ct) =>
    setLineItems((prev) => [
      ...prev, { name: ct.name, rate_per_day: ct.rate, days: defaultDays },
    ])

  const updateItem = (idx, field, val) =>
    setLineItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)))

  const removeItem = (idx) =>
    setLineItems((prev) => prev.filter((_, i) => i !== idx))

  const totalBill = lineItems.reduce(
    (sum, i) => sum + (parseFloat(i.rate_per_day) || 0) * (parseInt(i.days) || 0), 0
  )
  const discountAmt = parseFloat(form.discount) || 0
  const netBill = totalBill - (parseFloat(form.advance_paid) || 0) - discountAmt

  const canAdvance = form.patient_name.trim() && (
    billType === 'OPD' ? form.visit_date : form.admitted_on
  )

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      // Helper: turn '' into null for date fields
      const dateOrNull = (v) => v || null

      const base = {
        bill_type: billType,
        patient_name: form.patient_name,
        address: form.address,
        mobile_no: form.mobile_no,
        gender: form.gender,
        weight: form.weight !== '' ? form.weight : null,
        advance_paid: form.advance_paid,
        discount: form.discount !== '' ? form.discount : null,
        discount_note: form.discount_note,
        line_items: lineItems.map((i) => ({
          name: i.name,
          rate_per_day: i.rate_per_day,
          days: parseInt(i.days) || 0,
        })),
      }

      const payload = billType === 'OPD'
        ? {
            ...base,
            visit_date:     dateOrNull(form.visit_date),
            // explicitly null out IPD fields so they don't drift
            admitted_on:    null,
            discharged_on:  null,
          }
        : {
            ...base,
            admitted_on:    dateOrNull(form.admitted_on),
            discharged_on:  dateOrNull(form.discharged_on),
            room_no:        form.room_no,
            ward:           form.ward,
            total_stay:     parseInt(form.total_stay) || 0,
            // explicitly null out OPD fields
            visit_date:     null,
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
          ? Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
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
            <h2 className="text-base font-bold text-gray-800">
              {isEdit ? `Edit ${billType} Bill` : 'New Patient Bill'}
            </h2>
            <p className="text-xs text-gray-400">Shree Hospital</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full text-xl transition">×</button>
        </div>

        {/* ── Bill type toggle (create only) ── */}
        {!isEdit && (
          <div className="px-5 pt-4 pb-2 shrink-0">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {[
                { type: 'IPD', icon: '🏥', label: 'IPD — In-Patient' },
                { type: 'OPD', icon: '🩺', label: 'OPD — Out-Patient' },
              ].map(({ type, icon, label }) => (
                <button
                  key={type}
                  onClick={() => {
                    const today = todayISO()
                    setBillType(type)
                    setLineItems([])
                    setStep(1)
                    setForm(type === 'IPD'
                      ? { ...emptyIPD, admitted_on: today }
                      : { ...emptyOPD, visit_date: today }
                    )
                  }}
                  className={`flex-1 py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2
                    ${billType === type ? (type === 'OPD' ? 'bg-green-600 text-white' : 'bg-blue-700 text-white') : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  <span>{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step tabs ── */}
        <div className="flex border-b shrink-0">
          {['Patient Details', 'Charges & Summary'].map((label, i) => (
            <button
              key={label}
              onClick={() => (i === 0 || canAdvance) && setStep(i + 1)}
              className={`flex-1 py-3 text-sm font-medium transition
                ${step === i + 1
                  ? (billType === 'OPD' ? 'text-green-700 border-b-2 border-green-600' : 'text-blue-700 border-b-2 border-blue-700')
                  : canAdvance || i === 0 ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'
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
                <label className="label">Mobile No</label>
                <input className="input" type="tel" maxLength={15} value={form.mobile_no} onChange={set('mobile_no')} placeholder="9876543210" />
              </div>
              <div>
                <label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={set('gender')}>
                  <option value="">— Select —</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>

              <div>
                <label className="label">Weight (kg)</label>
                <input className="input" type="number" min="0" max="300" step="0.1"
                  value={form.weight} onChange={set('weight')} placeholder="e.g. 12.5" />
              </div>

              {billType === 'OPD' ? (
                <div>
                  <label className="label">Visit Date *</label>
                  <input className="input" type="date" max={todayISO()} value={form.visit_date} onChange={set('visit_date')} />
                </div>
              ) : (
                /* IPD — fill the remaining half-col with Ward, then rest below */
                <div>
                  <label className="label">Ward</label>
                  <input className="input" value={form.ward} onChange={set('ward')} placeholder="General" />
                </div>
              )}

              {billType === 'IPD' && (
                <>
                  <div>
                    <label className="label">Room No</label>
                    <input className="input" value={form.room_no} onChange={set('room_no')} placeholder="12" />
                  </div>
                  <div>
                    <label className="label">Admitted On *</label>
                    <input className="input" type="date" max={todayISO()} value={form.admitted_on} onChange={set('admitted_on')} />
                  </div>
                  <div>
                    <label className="label">Discharged On</label>
                    <input className="input" type="date" max={todayISO()} value={form.discharged_on} onChange={set('discharged_on')} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Total Stay (days)</label>
                    <input className="input" type="number" min="0" value={form.total_stay} onChange={set('total_stay')} placeholder="Auto from dates" />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2 — Charges */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Quick-add chips */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick-add charges</p>
                <div className="flex flex-wrap gap-1.5">
                  {charges.map((ct) => (
                    <button
                      key={ct.name}
                      onClick={() => addCharge(ct)}
                      className={`text-xs border rounded-full px-3 py-1 active:scale-95 transition
                        ${billType === 'OPD' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                    >
                      + {ct.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Added charges */}
              {lineItems.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Added charges</p>
                  <div className="grid grid-cols-12 text-[10px] font-semibold text-gray-400 uppercase px-1 mb-1">
                    <span className="col-span-4">Charge</span>
                    <span className="col-span-3 text-right">{billType === 'OPD' ? '₹/Unit' : '₹/Day'}</span>
                    <span className="col-span-2 text-center">{billType === 'OPD' ? 'Qty' : 'Days'}</span>
                    <span className="col-span-3 text-right">Amount</span>
                  </div>
                  <div className="space-y-1.5">
                    {lineItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                        <div className="col-span-4 text-xs font-medium text-gray-700 truncate leading-tight">{item.name}</div>
                        <div className="col-span-3">
                          <input type="number" min="0" value={item.rate_per_day}
                            onChange={(e) => updateItem(idx, 'rate_per_day', e.target.value)}
                            className="w-full text-right text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="0" value={item.days}
                            onChange={(e) => updateItem(idx, 'days', e.target.value)}
                            className="w-full text-center text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-1">
                          <span className="text-xs font-semibold text-gray-700">
                            ₹{((parseFloat(item.rate_per_day) || 0) * (parseInt(item.days) || 0)).toLocaleString('en-IN')}
                          </span>
                          <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none ml-0.5 transition" title="Remove">×</button>
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
              <div className={`rounded-xl p-4 space-y-2 border ${billType === 'OPD' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Total Bill</span>
                  <span className="font-semibold">₹{totalBill.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <label className="shrink-0">Less / Advance</label>
                  <input type="number" min="0" value={form.advance_paid} onChange={set('advance_paid')}
                    className="w-28 text-right text-sm border border-gray-200 rounded-lg px-3 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <label className="shrink-0">Discount (Doctor)</label>
                  <input type="number" min="0" value={form.discount} onChange={set('discount')} placeholder="0"
                    className="w-28 text-right text-sm border border-gray-200 rounded-lg px-3 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                {(parseFloat(form.discount) > 0) && (
                  <div>
                    <input type="text" value={form.discount_note} onChange={set('discount_note')} placeholder="Discount reason (optional)"
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>
                )}
                <div className={`flex justify-between text-base font-bold border-t pt-2
                  ${billType === 'OPD' ? 'text-green-800 border-green-200' : 'text-blue-800 border-blue-200'}`}>
                  <span>Net Payable</span>
                  <span>₹{netBill.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100 shrink-0">⚠ {error}</div>
        )}

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t flex gap-3 shrink-0">
          {step === 1 ? (
            <button onClick={() => setStep(2)} disabled={!canAdvance}
              className={`flex-1 text-white rounded-xl py-3 text-sm font-semibold active:scale-95 transition disabled:opacity-50
                ${billType === 'OPD' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-700 hover:bg-blue-800'}`}
            >
              Next: Add Charges →
            </button>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="px-5 border border-gray-300 text-gray-600 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition">
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={loading || lineItems.length === 0}
                className={`flex-1 text-white rounded-xl py-3 text-sm font-semibold active:scale-95 transition disabled:opacity-50
                  ${billType === 'OPD' ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {loading ? 'Saving…' : isEdit
                  ? `✏️ Update Bill · ₹${netBill.toLocaleString('en-IN')}`
                  : `💾 Save ${billType} Bill · ₹${netBill.toLocaleString('en-IN')}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
