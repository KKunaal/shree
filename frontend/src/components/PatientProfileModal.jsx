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

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">

          {/* Section 1 — Patient Info */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Patient Info
            </p>
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
          </div>

          {/* Section 2 — Pre-existing Conditions */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Pre-existing Conditions
            </p>
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
            <div className="mt-3">
              <label className="label">Condition Notes</label>
              <textarea
                className="input resize-none" rows={3}
                value={form.condition_notes} onChange={set('condition_notes')}
                placeholder="Additional details about pre-existing conditions…"
              />
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100 shrink-0">
            ⚠ {error}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 border border-gray-300 text-gray-600 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.patient_name.trim()}
            className="flex-1 bg-blue-700 hover:bg-blue-800 text-white rounded-xl py-3 text-sm font-semibold active:scale-95 transition disabled:opacity-50"
          >
            {loading ? 'Saving…' : isEdit ? '✏️ Update Patient' : '➕ Add to Queue'}
          </button>
        </div>
      </div>
    </div>
  )
}
