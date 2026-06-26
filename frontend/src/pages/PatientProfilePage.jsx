import { useState, useEffect, useCallback } from 'react'

const CONDITIONS_LABELS = {
  has_diabetes: 'Diabetes',
  has_high_bp: 'High BP',
  has_heart_disease: 'Heart Disease',
  has_asthma: 'Asthma',
  has_recent_surgery: 'Recent Surgery',
  is_pregnant: 'Pregnant',
  has_thyroid: 'Thyroid',
  has_kidney_disease: 'Kidney Disease',
}

export default function PatientProfilePage({
  queueItem,
  onBack,
  apiClient,
  onMarkDone,
  isDoctor,
}) {
  const isEdit = queueItem.status === 'WITH_DOCTOR' && isDoctor
  const patient = queueItem.patient

  const [profileData, setProfileData] = useState(null) // { visit_id, observation, prescription }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [observationText, setObservationText] = useState('')
  const [prescriptionItems, setPrescriptionItems] = useState([]) // [{name, description}]

  const [showHistory, setShowHistory] = useState(false)

  // ── Load profile ──────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qid = queueItem.queue_item_id ?? queueItem.id
      const { data } = await apiClient.get(`/profile/?queue_item_id=${qid}`)
      setProfileData(data)
      setObservationText(data.observation?.observation ?? '')
      setPrescriptionItems(data.prescription?.items ?? [])
    } catch {
      setError('Failed to load patient profile.')
    } finally {
      setLoading(false)
    }
  }, [apiClient, queueItem])

  useEffect(() => { loadProfile() }, [loadProfile])

  // ── Prescription item helpers ─────────────────────────────────────────────
  const addItem = () =>
    setPrescriptionItems((p) => [...p, { name: '', description: '' }])

  const updateItem = (idx, field, val) =>
    setPrescriptionItems((p) =>
      p.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    )

  const removeItem = (idx) =>
    setPrescriptionItems((p) => p.filter((_, i) => i !== idx))

  // ── Save observation + prescription ──────────────────────────────────────
  const handleSave = async () => {
    if (!profileData?.visit_id) {
      setSaveMsg('⚠ No active visit found for this patient.')
      return
    }
    setSaving(true)
    setSaveMsg('')
    try {
      const { visit_id } = profileData
      const patientId = patient.id

      let updatedObs = profileData.observation
      let updatedPresc = profileData.prescription

      // ── Observation ──────────────────────────────────────────────────────
      if (observationText.trim()) {
        if (profileData.observation) {
          const { data } = await apiClient.patch(
            `/profile/observation/${profileData.observation.observation_id}/`,
            { observation: observationText }
          )
          updatedObs = data
        } else {
          const { data } = await apiClient.post('/profile/observation/', {
            visit_id,
            patient_id: patientId,
            observation: observationText,
          })
          updatedObs = data
        }
      }

      // ── Prescription ─────────────────────────────────────────────────────
      const validItems = prescriptionItems.filter((i) => i.name.trim())
      if (validItems.length > 0) {
        if (profileData.prescription) {
          const { data } = await apiClient.patch(
            `/profile/prescription/${profileData.prescription.prescription_id}/`,
            { items: validItems }
          )
          updatedPresc = data
        } else {
          const { data } = await apiClient.post('/profile/prescription/', {
            visit_id,
            patient_id: patientId,
            items: validItems,
          })
          updatedPresc = data
        }
      }

      setProfileData((prev) => ({ ...prev, observation: updatedObs, prescription: updatedPresc }))
      setSaveMsg('✓ Saved successfully')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch {
      setSaveMsg('⚠ Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Visit History sub-view ────────────────────────────────────────────────
  if (showHistory) {
    return (
      <VisitHistoryPage
        patient={patient}
        apiClient={apiClient}
        onBack={() => setShowHistory(false)}
      />
    )
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-4xl animate-spin">⏳</div>
      </div>
    )
  }

  const genderLabel =
    patient.gender === 'M' ? 'Male'
    : patient.gender === 'F' ? 'Female'
    : patient.gender === 'O' ? 'Other'
    : null

  const activeConditions = Object.keys(CONDITIONS_LABELS).filter((k) => patient[k])

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-blue-600 font-medium text-sm"
        >
          ← Back
        </button>
        <h1 className="font-semibold text-gray-800 text-base">Patient Profile</h1>
        {!isEdit && (
          <button
            onClick={() => setShowHistory(true)}
            className="text-sm text-blue-600 font-medium"
          >
            View History
          </button>
        )}
        {isEdit && <div className="w-20" />}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-36 space-y-5 max-w-2xl mx-auto w-full">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Section 1: Patient Basic Profile ── */}
        <Section title="Patient Info">
          <div className="space-y-1">
            <p className="text-lg font-bold text-gray-800">{patient.patient_name}</p>
            {patient.mobile_no && (
              <p className="text-sm text-gray-500">📞 {patient.mobile_no}</p>
            )}
            {patient.address && (
              <p className="text-sm text-gray-500">📍 {patient.address}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {genderLabel && <Chip label={genderLabel} />}
            {patient.age && <Chip label={`${patient.age} yrs`} />}
            {patient.pulse_rate && <Chip label={`${patient.pulse_rate} bpm`} />}
            {patient.weight && <Chip label={`${patient.weight} kg`} />}
            {patient.height && <Chip label={`${patient.height} cm`} />}
          </div>
          {activeConditions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {activeConditions.map((k) => (
                <span
                  key={k}
                  className="text-[10px] font-medium bg-red-50 text-red-600 border border-red-100 rounded-full px-2 py-0.5"
                >
                  {CONDITIONS_LABELS[k]}
                </span>
              ))}
            </div>
          )}
          {patient.condition_notes && (
            <p className="text-xs text-gray-400 mt-2 italic">📝 {patient.condition_notes}</p>
          )}
        </Section>

        {/* ── Section 2: Observation ── */}
        <Section title="Observation">
          {isEdit ? (
            <textarea
              value={observationText}
              onChange={(e) => setObservationText(e.target.value)}
              rows={4}
              placeholder="Enter clinical observations…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap min-h-[40px]">
              {profileData?.observation?.observation || (
                <span className="text-gray-400 italic">No observation recorded.</span>
              )}
            </p>
          )}
        </Section>

        {/* ── Section 3: Prescription ── */}
        <Section
          title="Prescription"
          action={
            isEdit && (
              <button
                onClick={addItem}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full hover:bg-blue-100 transition"
              >
                + Add item
              </button>
            )
          }
        >
          {isEdit ? (
            prescriptionItems.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No prescription items yet. Tap "+ Add item" to add.
              </p>
            ) : (
              <div className="space-y-3">
                {prescriptionItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(idx, 'name', e.target.value)}
                        placeholder="Medicine name"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <input
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        placeholder="1-0-1 a/f"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-gray-400 hover:text-red-500 text-lg leading-none mt-2 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            profileData?.prescription?.items?.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left py-1 font-medium">Medicine</th>
                    <th className="text-left py-1 font-medium">Dosage</th>
                  </tr>
                </thead>
                <tbody>
                  {profileData.prescription.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50">
                      <td className="py-1.5 text-gray-800 font-medium">{item.name}</td>
                      <td className="py-1.5 text-gray-500">{item.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400 italic">No prescription recorded.</p>
            )
          )}
        </Section>
      </div>

      {/* ── Footer buttons ── */}
      {isEdit && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex flex-col gap-2 max-w-2xl mx-auto">
          {saveMsg && (
            <p className={`text-xs text-center font-medium ${saveMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
              {saveMsg}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white rounded-xl py-3 text-sm font-semibold transition"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => onMarkDone(queueItem, profileData?.visit_id)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 text-sm font-semibold transition"
            >
              Move to Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Visit History sub-page ────────────────────────────────────────────────────

function VisitHistoryPage({ patient, apiClient, onBack }) {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedVisit, setExpandedVisit] = useState(null)
  const PAGE_SIZE = 10

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await apiClient.get(
          `/profile/visits/?patient_id=${patient.id}&page=${page}&page_size=${PAGE_SIZE}`
        )
        setVisits(data.results ?? data)
        setTotalCount(data.count ?? (data.results ?? data).length)
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [apiClient, patient.id, page])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <button onClick={onBack} className="text-blue-600 font-medium text-sm">
          ← Back
        </button>
        <div>
          <h1 className="font-semibold text-gray-800 text-base">Visit History</h1>
          <p className="text-xs text-gray-400">{patient.patient_name}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="flex justify-center py-20"><div className="text-4xl animate-spin">⏳</div></div>
        ) : visits.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p>No visit history found.</p>
          </div>
        ) : (
          visits.map((visit) => (
            <VisitCard
              key={visit.visit_id}
              visit={visit}
              expanded={expandedVisit === visit.visit_id}
              onToggle={() =>
                setExpandedVisit((v) => (v === visit.visit_id ? null : visit.visit_id))
              }
            />
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-2 pb-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              ← Prev
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function VisitCard({ visit, expanded, onToggle }) {
  const visitDate = new Date(visit.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  const PAYMENT_COLORS = {
    PAID:    'bg-green-100 text-green-700',
    PARTIAL: 'bg-amber-100 text-amber-700',
    UNPAID:  'bg-red-100 text-red-600',
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Visit header — always visible */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
        onClick={onToggle}
      >
        <div>
          <p className="text-sm font-semibold text-gray-800">📅 {visitDate}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {visit.bill
              ? `${visit.bill.bill_type} • ₹${parseFloat(visit.bill.total_bill || 0).toLocaleString('en-IN')}`
              : 'No bill'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {visit.bill && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PAYMENT_COLORS[visit.bill.payment_status] || 'bg-gray-100 text-gray-500'}`}>
              {visit.bill.payment_status}
            </span>
          )}
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-4 bg-gray-50">
          {/* Observation */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observation</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {visit.observation?.observation || <span className="text-gray-400 italic">None</span>}
            </p>
          </div>

          {/* Prescription */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Prescription</p>
            {visit.prescription?.items?.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th className="text-left pb-1 font-medium">Medicine</th>
                    <th className="text-left pb-1 font-medium">Dosage</th>
                  </tr>
                </thead>
                <tbody>
                  {visit.prescription.items.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1 text-gray-800 font-medium">{item.name}</td>
                      <td className="py-1 text-gray-500">{item.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400 italic">None</p>
            )}
          </div>

          {/* Bill */}
          {visit.bill && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bill</p>
              <div className="space-y-1">
                {visit.bill.line_items?.map((li, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{li.name} × {li.days} day{li.days !== 1 ? 's' : ''}</span>
                    <span className="text-gray-800 font-medium">₹{parseFloat(li.amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
                  <span className="text-gray-700">Net Bill</span>
                  <span className="text-gray-900">₹{parseFloat(visit.bill.net_bill || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Section({ title, children, action }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function Chip({ label }) {
  return (
    <span className="text-[11px] font-medium bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">
      {label}
    </span>
  )
}
