import { useState } from 'react'

const CONDITIONS = [
  { key: 'has_diabetes',       label: 'Diabetes',       emoji: '🩸' },
  { key: 'has_high_bp',        label: 'High BP',         emoji: '💓' },
  { key: 'has_heart_disease',  label: 'Heart Disease',   emoji: '❤️' },
  { key: 'has_asthma',         label: 'Asthma',          emoji: '🫁' },
  { key: 'has_recent_surgery', label: 'Recent Surgery',  emoji: '🩺' },
  { key: 'is_pregnant',        label: 'Pregnant',        emoji: '🤰' },
  { key: 'has_thyroid',        label: 'Thyroid',         emoji: '🦋' },
  { key: 'has_kidney_disease', label: 'Kidney Disease',  emoji: '🫘' },
]

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

const emptyForm = {
  patient_name: '', address: '', mobile_no: '', gender: '',
  age: '', pulse_rate: '', weight: '', height: '',
  has_diabetes: false, has_high_bp: false, has_heart_disease: false,
  has_asthma: false, has_recent_surgery: false, is_pregnant: false,
  has_thyroid: false, has_kidney_disease: false,
  condition_notes: '',
}

export default function PatientProfileModal({ apiClient, onClose, onCreated, onUpdated, editPatient }) {
  const isEdit = Boolean(editPatient)
  const totalSteps = isEdit ? 2 : 3
  const [step, setStep] = useState(1)

  const [form, setForm] = useState(() => {
    if (!editPatient) return { ...emptyForm }
    return {
      patient_name:       editPatient.patient_name || '',
      address:            editPatient.address || '',
      mobile_no:          editPatient.mobile_no || '',
      gender:             editPatient.gender || '',
      age:                editPatient.age        != null ? String(editPatient.age)        : '',
      pulse_rate:         editPatient.pulse_rate != null ? String(editPatient.pulse_rate) : '',
      weight:             editPatient.weight     != null ? String(editPatient.weight)     : '',
      height:             editPatient.height     != null ? String(editPatient.height)     : '',
      has_diabetes:       editPatient.has_diabetes       || false,
      has_high_bp:        editPatient.has_high_bp        || false,
      has_heart_disease:  editPatient.has_heart_disease  || false,
      has_asthma:         editPatient.has_asthma         || false,
      has_recent_surgery: editPatient.has_recent_surgery || false,
      is_pregnant:        editPatient.is_pregnant        || false,
      has_thyroid:        editPatient.has_thyroid        || false,
      has_kidney_disease: editPatient.has_kidney_disease || false,
      condition_notes:    editPatient.condition_notes    || '',
    }
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const toggle = (field) => setForm((f) => ({ ...f, [field]: !f[field] }))

  // ── Reception payment collection (create mode only) ──
  const [queueForm, setQueueForm] = useState({
    reception_bill_type: 'OPD',
    reception_line_items: [],
    reception_amount_collected: '',
    reception_paid_via: 'CASH',
  })

  const charges = queueForm.reception_bill_type === 'OPD' ? OPD_CHARGES : IPD_CHARGES

  const addReceptionCharge = (ct) =>
    setQueueForm((q) => ({
      ...q,
      reception_line_items: [...q.reception_line_items, { name: ct.name, rate_per_day: ct.rate, days: '1' }],
    }))

  const updateReceptionItem = (idx, field, val) =>
    setQueueForm((q) => ({
      ...q,
      reception_line_items: q.reception_line_items.map((item, i) => (i === idx ? { ...item, [field]: val } : item)),
    }))

  const removeReceptionItem = (idx) =>
    setQueueForm((q) => ({
      ...q,
      reception_line_items: q.reception_line_items.filter((_, i) => i !== idx),
    }))

  const receptionTotal = queueForm.reception_line_items.reduce(
    (sum, i) => sum + (parseFloat(i.rate_per_day) || 0) * (parseInt(i.days) || 0), 0
  )

  const canStep2 = form.patient_name.trim()

  const handleSubmit = async () => {
    if (!form.patient_name.trim()) {
      setError('Patient name is required.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        age:        form.age        !== '' ? parseInt(form.age)        : null,
        pulse_rate: form.pulse_rate !== '' ? parseInt(form.pulse_rate) : null,
        weight:     form.weight     !== '' ? form.weight               : null,
        height:     form.height     !== '' ? form.height               : null,
        ...(!isEdit && {
          queue: {
            reception_bill_type:        queueForm.reception_bill_type,
            reception_line_items:       queueForm.reception_line_items,
            reception_amount_collected: queueForm.reception_amount_collected !== ''
              ? queueForm.reception_amount_collected
              : '0.00',
            reception_paid_via: queueForm.reception_paid_via,
          },
        }),
      }
      let data
      if (isEdit) {
        ;({ data } = await apiClient.patch(`/patients/${editPatient.id}/`, payload))
        onUpdated?.(data)
      } else {
        ;({ data } = await apiClient.post('/patients/', payload))
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
          : 'Failed to save. Please try again.'
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
              {isEdit ? 'Edit Patient' : 'New Patient'}
            </h2>
            <p className="text-xs text-gray-400">Shree Hospital · Queue Registration</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full text-xl transition"
          >×</button>
        </div>

        {/* ── Step tabs ── */}
        <div className="flex border-b shrink-0">
          {[
            { s: 1, label: 'Patient Info', canGo: true       },
            { s: 2, label: 'Conditions',   canGo: !!canStep2 },
            ...(!isEdit ? [{ s: 3, label: 'Payment', canGo: !!canStep2 }] : []),
          ].map(({ s, label, canGo }) => (
            <button key={s} onClick={() => canGo && setStep(s)}
              className={`flex-1 py-3 text-sm font-medium transition
                ${step === s
                  ? 'text-blue-700 border-b-2 border-blue-700'
                  : canGo ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
            >
              {s}. {label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4">

          {/* Step 1 — Patient Info */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2">
                <label className="label">Patient Name *</label>
                <input
                  className="input" value={form.patient_name}
                  onChange={set('patient_name')} placeholder="Full name"
                />
              </div>
              <div className="col-span-2">
                <label className="label">Address</label>
                <input
                  className="input" value={form.address}
                  onChange={set('address')} placeholder="Village / City"
                />
              </div>
              <div>
                <label className="label">Mobile No</label>
                <input
                  className="input" type="tel" maxLength={15}
                  value={form.mobile_no} onChange={set('mobile_no')} placeholder="9876543210"
                />
              </div>
              <div>
                <label className="label">Gender</label>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden h-[42px]">
                  {[{ v: 'M', l: 'Male' }, { v: 'F', l: 'Female' }, { v: 'O', l: 'Other' }].map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setForm((f) => ({ ...f, gender: f.gender === v ? '' : v }))}
                      className={`flex-1 text-sm font-medium transition
                        ${form.gender === v ? 'bg-blue-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Age (years)</label>
                <input
                  className="input" type="number" min="0" max="120" step="1"
                  value={form.age} onChange={set('age')} placeholder="e.g. 35"
                />
              </div>
              <div>
                <label className="label">Pulse Rate (bpm)</label>
                <input
                  className="input" type="number" min="0" max="300" step="1"
                  value={form.pulse_rate} onChange={set('pulse_rate')} placeholder="e.g. 72"
                />
              </div>
              <div>
                <label className="label">Weight (kg)</label>
                <input
                  className="input" type="number" min="0" max="300" step="0.1"
                  value={form.weight} onChange={set('weight')} placeholder="e.g. 65.0"
                />
              </div>
              <div>
                <label className="label">Height (cm)</label>
                <input
                  className="input" type="number" min="0" max="300" step="0.1"
                  value={form.height} onChange={set('height')} placeholder="e.g. 165.0"
                />
              </div>
            </div>
          )}

          {/* Step 2 — Conditions */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {CONDITIONS.map(({ key, label, emoji }) => (
                  <button key={key} type="button" onClick={() => toggle(key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition text-left
                      ${form[key]
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <span className="text-base leading-none">{emoji}</span>
                    <span className="flex-1">{label}</span>
                    {form[key] && <span className="text-red-500 text-xs font-bold">✓</span>}
                  </button>
                ))}
              </div>
              <div>
                <label className="label">Condition Notes</label>
                <textarea
                  className="input resize-none" rows={3}
                  value={form.condition_notes} onChange={set('condition_notes')}
                  placeholder="Additional details about pre-existing conditions…"
                />
              </div>
            </div>
          )}

          {/* Step 3 — Payment Collection (create only) */}
          {step === 3 && !isEdit && (
            <div className="space-y-4">

              {/* OPD / IPD toggle */}
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                {[
                  { type: 'OPD', icon: '🩺', label: 'OPD — Out-Patient' },
                  { type: 'IPD', icon: '🏥', label: 'IPD — In-Patient'  },
                ].map(({ type, icon, label }) => (
                  <button key={type} type="button"
                    onClick={() => setQueueForm((q) => ({
                      ...q, reception_bill_type: type, reception_line_items: [],
                    }))}
                    className={`flex-1 py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2
                      ${queueForm.reception_bill_type === type
                        ? (type === 'OPD' ? 'bg-green-600 text-white' : 'bg-blue-700 text-white')
                        : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    <span>{icon}</span>{label}
                  </button>
                ))}
              </div>

              {/* Quick-add chips */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick-add charges</p>
                <div className="flex flex-wrap gap-1.5">
                  {charges.map((ct) => (
                    <button key={ct.name} type="button" onClick={() => addReceptionCharge(ct)}
                      className={`text-xs border rounded-full px-3 py-1 active:scale-95 transition
                        ${queueForm.reception_bill_type === 'OPD'
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                    >
                      + {ct.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line items */}
              {queueForm.reception_line_items.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Charges collected</p>
                  <div className="grid grid-cols-12 text-[10px] font-semibold text-gray-400 uppercase px-1 mb-1">
                    <span className="col-span-4">Charge</span>
                    <span className="col-span-3 text-right">₹/Unit</span>
                    <span className="col-span-2 text-center">Qty</span>
                    <span className="col-span-3 text-right">Amount</span>
                  </div>
                  <div className="space-y-1.5">
                    {queueForm.reception_line_items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                        <div className="col-span-4 text-xs font-medium text-gray-700 truncate leading-tight">{item.name}</div>
                        {/* Rate: view-only for reception */}
                        <div className="col-span-3">
                          <span className="block w-full text-right text-xs text-gray-500 px-1.5 py-1">
                            {item.rate_per_day !== '' ? `₹${item.rate_per_day}` : '—'}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="1" value={item.days}
                            onChange={(e) => updateReceptionItem(idx, 'days', e.target.value)}
                            className="w-full text-center text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-1">
                          <span className="text-xs font-semibold text-gray-700">
                            ₹{((parseFloat(item.rate_per_day) || 0) * (parseInt(item.days) || 0)).toLocaleString('en-IN')}
                          </span>
                          <button onClick={() => removeReceptionItem(idx)}
                            className="text-red-400 hover:text-red-600 text-lg leading-none ml-0.5 transition">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-gray-700 px-1 mt-2 pt-2 border-t border-gray-100">
                    <span>Sub-total</span>
                    <span>₹{receptionTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-3xl mb-1.5">💊</p>
                  <p className="text-sm font-medium text-gray-500">No charges added yet</p>
                  <p className="text-xs mt-1">Use the chips above to add collected charges</p>
                </div>
              )}

              {/* Amount collected + payment mode */}
              <div className={`rounded-xl p-4 space-y-3 border ${queueForm.reception_bill_type === 'OPD' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex justify-between items-center text-sm text-gray-700">
                  <label className="font-medium shrink-0">Amount Collected (₹)</label>
                  <input
                    type="number" min="0"
                    value={queueForm.reception_amount_collected}
                    onChange={(e) => setQueueForm((q) => ({ ...q, reception_amount_collected: e.target.value }))}
                    placeholder="0"
                    className="w-32 text-right text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <p className="text-[12px] font-medium text-gray-600 mb-1.5">Payment Mode</p>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden h-[38px]">
                    {[{ v: 'CASH', l: 'Cash' }, { v: 'UPI', l: 'UPI' }, { v: 'ONLINE', l: 'Online' }].map(({ v, l }) => (
                      <button key={v} type="button"
                        onClick={() => setQueueForm((q) => ({ ...q, reception_paid_via: v }))}
                        className={`flex-1 text-sm font-medium transition
                          ${queueForm.reception_paid_via === v ? 'bg-blue-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                      >{l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100 shrink-0">
            ⚠ {error}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t flex gap-3 shrink-0">
          {step > 1 ? (
            <button onClick={() => setStep((s) => s - 1)}
              className="px-5 border border-gray-300 text-gray-600 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition">
              ← Back
            </button>
          ) : (
            <button onClick={onClose}
              className="px-5 border border-gray-300 text-gray-600 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
          )}
          {step < totalSteps ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canStep2 && step === 1}
              className="flex-1 bg-blue-700 hover:bg-blue-800 text-white rounded-xl py-3 text-sm font-semibold active:scale-95 transition disabled:opacity-50"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !form.patient_name.trim()}
              className="flex-1 bg-blue-700 hover:bg-blue-800 text-white rounded-xl py-3 text-sm font-semibold active:scale-95 transition disabled:opacity-50"
            >
              {loading ? 'Saving…' : isEdit ? '✏️ Update Patient' : '➕ Add to Queue'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
