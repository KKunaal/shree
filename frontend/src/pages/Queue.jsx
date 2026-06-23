import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { createApiClient } from '../api'
import Header from '../components/Header'
import PatientProfileModal from '../components/PatientProfileModal'
import CreateBillModal from '../components/CreateBillModal'
import { useUrlState } from '../hooks/useUrlState'

const STATUS_CFG = {
  WAITING:     { label: 'Waiting',     color: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-400'  },
  WITH_DOCTOR: { label: 'With Doctor', color: 'bg-blue-100 text-blue-700 border-blue-200',    dot: 'bg-blue-500'   },
  DONE:        { label: 'Done',        color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500'  },
}

const STATUS_CYCLE = ['WAITING', 'WITH_DOCTOR', 'DONE']

const CONDITIONS_LABELS = {
  has_diabetes:       'Diabetes',
  has_high_bp:        'High BP',
  has_heart_disease:  'Heart Disease',
  has_asthma:         'Asthma',
  has_recent_surgery: 'Recent Surgery',
  is_pregnant:        'Pregnant',
  has_thyroid:        'Thyroid',
  has_kidney_disease: 'Kidney Disease',
}

const todayISO = () => new Date().toLocaleDateString('en-CA')

export default function Queue({ onTabChange }) {
  const { user, logout } = useAuth()
  const apiClient = useMemo(() => createApiClient(user.token), [user.token])
  const isDoctor = user?.role === 'doctor'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useUrlState('qStatus', 'WAITING')
  const [summary, setSummary] = useState({ all: 0, waiting: 0, with_doctor: 0, done: 0 })
  const [refreshTick, setRefreshTick] = useState(0)
  const [toast, setToast] = useState(null)

  // Modals
  const [showPatientModal, setShowPatientModal] = useState(false)
  const [editPatient, setEditPatient] = useState(null)
  const [showBillModal, setShowBillModal] = useState(false)
  const [billPrefill, setBillPrefill] = useState(null)
  // When doctor clicks "Mark Done", bill must be created first before status is patched
  const [pendingDoneItem, setPendingDoneItem] = useState(null)

  // 3-dot menu
  const [openMenu, setOpenMenu] = useState(null) // queue item id

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ date: todayISO() })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      const res = await apiClient.get(`/queue/?${params}`)
      setItems(res.data.results ?? res.data)
      setSummary(res.data.summary ?? { all: 0, waiting: 0, with_doctor: 0, done: 0 })
    } catch (err) {
      if (err.response?.status === 401) logout()
    } finally {
      setLoading(false)
    }
  }, [apiClient, logout, statusFilter, refreshTick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchQueue() }, [fetchQueue])

  // Close menu on outside click
  useEffect(() => {
    if (openMenu == null) return
    const close = () => setOpenMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openMenu])

  const handlePatientCreated = (queueData) => {
    // New patients always start as WAITING — only add to visible list if filter matches
    if (statusFilter === 'ALL' || statusFilter === 'WAITING') {
      setItems((prev) => [...prev, queueData].sort((a, b) => a.queue_number - b.queue_number))
    }
    setSummary((s) => ({ ...s, all: s.all + 1, waiting: s.waiting + 1 }))
    showToast('✓ Patient added to queue')
  }

  const handlePatientUpdated = (updated) => {
    setItems((prev) =>
      prev.map((item) =>
        item.patient.id === updated.id ? { ...item, patient: updated } : item
      )
    )
    showToast('✓ Patient updated')
  }

  const handleStatusCycle = async (queueItem) => {
    const idx = STATUS_CYCLE.indexOf(queueItem.status)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    try {
      const { data } = await apiClient.patch(`/queue/${queueItem.id}/`, { status: next })
      if (statusFilter !== 'ALL' && data.status !== statusFilter) {
        setItems((prev) => prev.filter((i) => i.id !== queueItem.id))
      } else {
        setItems((prev) => prev.map((i) => (i.id === queueItem.id ? data : i)))
      }
    } catch {
      showToast('⚠ Failed to update status', 'error')
    }
  }

  const handleMoveToWithDoctor = async (queueItem) => {
    try {
      const { data } = await apiClient.patch(`/queue/${queueItem.id}/`, { status: 'WITH_DOCTOR' })
      if (statusFilter !== 'ALL' && statusFilter !== 'WITH_DOCTOR') {
        setItems((prev) => prev.filter((i) => i.id !== queueItem.id))
      } else {
        setItems((prev) => prev.map((i) => (i.id === queueItem.id ? data : i)))
      }
      showToast('✓ Moved to With Doctor')
    } catch {
      showToast('⚠ Failed to update status', 'error')
    }
  }

  const handleMarkDone = (queueItem) => {
    // Open bill creation first; queue is only patched to DONE after bill is saved
    setPendingDoneItem(queueItem)
    setBillPrefill({
      ...queueItem.patient,
      _queue: {
        reception_bill_type:        queueItem.reception_bill_type,
        reception_line_items:       queueItem.reception_line_items,
        reception_amount_collected: queueItem.reception_amount_collected,
        reception_paid_via:         queueItem.reception_paid_via,
      },
    })
    setShowBillModal(true)
  }

  // Called internally after bill is successfully created
  const markQueueItemDone = async (queueItem) => {
    try {
      const { data } = await apiClient.patch(`/queue/${queueItem.id}/`, { status: 'DONE' })
      if (statusFilter !== 'ALL' && statusFilter !== 'DONE') {
        setItems((prev) => prev.filter((i) => i.id !== queueItem.id))
      } else {
        setItems((prev) => prev.map((i) => (i.id === queueItem.id ? data : i)))
      }
    } catch {
      showToast('⚠ Bill saved but failed to mark patient as Done', 'error')
    }
  }

  const handleMoveToWaiting = async (queueItem) => {
    try {
      const { data } = await apiClient.patch(`/queue/${queueItem.id}/`, { status: 'WAITING' })
      if (statusFilter !== 'ALL' && statusFilter !== 'WAITING') {
        setItems((prev) => prev.filter((i) => i.id !== queueItem.id))
      } else {
        setItems((prev) => prev.map((i) => (i.id === queueItem.id ? data : i)))
      }
      showToast('✓ Moved back to Waiting')
    } catch {
      showToast('⚠ Failed to update status', 'error')
    }
  }

  const handleMoveUp = async (queueItem) => {
    try {
      const { data } = await apiClient.post(`/queue/${queueItem.id}/move-up/`)
      setItems((prev) =>
        prev
          .map((i) => {
            if (i.id === data.moved.id)     return data.moved
            if (i.id === data.displaced.id) return data.displaced
            return i
          })
          .sort((a, b) => a.queue_number - b.queue_number)
      )
      showToast('✓ Patient moved up in queue')
    } catch {
      showToast('⚠ Failed to move patient up', 'error')
    }
  }

  const handleMoveDown = async (queueItem) => {
    try {
      const { data } = await apiClient.post(`/queue/${queueItem.id}/move-down/`)
      setItems((prev) =>
        prev
          .map((i) => {
            if (i.id === data.moved.id)     return data.moved
            if (i.id === data.displaced.id) return data.displaced
            return i
          })
          .sort((a, b) => a.queue_number - b.queue_number)
      )
      showToast('✓ Patient moved down in queue')
    } catch {
      showToast('⚠ Failed to move patient down', 'error')
    }
  }

  const handleDeleteConfirmed = async () => {
    const item = confirmDelete
    setConfirmDelete(null)
    try {
      await apiClient.delete(`/queue/${item.id}/`)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      showToast(`✓ Removed ${item.patient.patient_name} from queue`)
    } catch {
      showToast('⚠ Failed to remove from queue', 'error')
    }
  }

  // Counts come from the server summary — always reflect today's full queue
  const counts = {
    ALL:         summary.all,
    WAITING:     summary.waiting,
    WITH_DOCTOR: summary.with_doctor,
    DONE:        summary.done,
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onRefresh={fetchQueue} />

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-white text-xs font-medium rounded-xl px-4 py-2.5 shadow-lg whitespace-nowrap pointer-events-none select-none
          ${toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Top tab bar ── */}
      <div className="bg-white border-b sticky top-[60px] z-30">
        <div className="max-w-2xl mx-auto flex">
          {isDoctor && (
            <button onClick={() => onTabChange('dashboard')}
              className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition">
              📊 Dashboard
            </button>
          )}
          <button onClick={() => onTabChange('bills')}
            className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition">
            📋 Bills
          </button>
          {/* Queue — active */}
          <button className="px-4 py-3 text-sm font-semibold text-blue-700 border-b-2 border-blue-700">
            🏥 Queue
            {summary.waiting > 0 && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                {summary.waiting}
              </span>
            )}
          </button>
          {isDoctor && (
            <button onClick={() => onTabChange('charges')}
              className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition">
              ⚙️ Charges
            </button>
          )}
        </div>
      </div>

      {/* ── Status filter dropdown ── */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer"
          >
            <option value="ALL">All ({counts.ALL})</option>
            <option value="WAITING">⏳ Waiting ({counts.WAITING})</option>
            <option value="WITH_DOCTOR">👨‍⚕️ With Doctor ({counts.WITH_DOCTOR})</option>
            <option value="DONE">✅ Done ({counts.DONE})</option>
          </select>
        </div>
      </div>

      {/* ── Queue list ── */}
      <main className="max-w-2xl mx-auto w-full px-4 py-4 pb-28 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="text-4xl animate-spin mb-3">⏳</div>
            <p className="text-sm">Loading queue…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-5xl mb-3">🏥</p>
            <p className="font-medium text-gray-600">
              {statusFilter === 'ALL' ? 'No patients in queue today' : `No patients with status "${STATUS_CFG[statusFilter]?.label}"`}
            </p>
            <p className="text-xs mt-1">Tap the + button below to add a patient</p>
          </div>
        ) : (
          items.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              isFirst={items[0]?.id === item.id}
              isLast={items[items.length - 1]?.id === item.id}
              isDoctor={isDoctor}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onStatusCycle={() => handleStatusCycle(item)}
              onMoveToWithDoctor={() => { handleMoveToWithDoctor(item); setOpenMenu(null) }}
              onMarkDone={() => { handleMarkDone(item); setOpenMenu(null) }}
              onMoveToWaiting={() => { handleMoveToWaiting(item); setOpenMenu(null) }}
              onMoveUp={() => { handleMoveUp(item); setOpenMenu(null) }}
              onMoveDown={() => { handleMoveDown(item); setOpenMenu(null) }}
              onEdit={() => {
                setEditPatient(item.patient)
                setShowPatientModal(true)
                setOpenMenu(null)
              }}
              onDelete={() => {
                setConfirmDelete(item)
                setOpenMenu(null)
              }}
            />
          ))
        )}
      </main>

      {/* ── FAB — Add Patient ── */}
      <button
        onClick={() => { setEditPatient(null); setShowPatientModal(true) }}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-blue-700 hover:bg-blue-800 text-white shadow-xl text-2xl flex items-center justify-center active:scale-95 transition"
        title="Add patient to queue"
      >
        +
      </button>

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl">
            <p className="text-base font-bold text-gray-800 mb-1">Remove from queue?</p>
            <p className="text-sm text-gray-500 mb-5">
              This will remove <strong>{confirmDelete.patient.patient_name}</strong> (#{confirmDelete.queue_number}) from today's queue.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleDeleteConfirmed}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Patient Profile Modal ── */}
      {showPatientModal && (
        <PatientProfileModal
          apiClient={apiClient}
          editPatient={editPatient}
          onClose={() => { setShowPatientModal(false); setEditPatient(null) }}
          onCreated={handlePatientCreated}
          onUpdated={handlePatientUpdated}
        />
      )}

      {/* ── Create Bill Modal (pre-filled from patient profile) ── */}
      {showBillModal && (
        <CreateBillModal
          apiClient={apiClient}
          isDoctor={isDoctor}
          prefillData={billPrefill}
          onClose={() => {
            setShowBillModal(false)
            setBillPrefill(null)
            // Doctor closed without saving — do NOT mark as Done
            setPendingDoneItem(null)
          }}
          onCreated={async () => {
            setShowBillModal(false)
            setBillPrefill(null)
            if (pendingDoneItem) {
              await markQueueItemDone(pendingDoneItem)
              setPendingDoneItem(null)
              showToast('✓ Bill saved & patient marked as Done')
            } else {
              showToast('✓ Bill saved successfully')
            }
          }}
          onUpdated={() => {
            setShowBillModal(false)
            setBillPrefill(null)
            setPendingDoneItem(null)
          }}
        />
      )}
    </div>
  )
}

/* ── QueueCard ── */
function QueueCard({ item, isFirst, isLast, isDoctor, openMenu, setOpenMenu, onStatusCycle, onMoveToWithDoctor, onMarkDone, onMoveToWaiting, onMoveUp, onMoveDown, onEdit, onDelete }) {
  const { patient, queue_number, status } = item
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.WAITING

  // Reception loses Edit + Remove once a patient has left the WAITING state
  const receptionLocked = !isDoctor && (status === 'WITH_DOCTOR' || status === 'DONE')

  // Reception cannot move up/down while patient is WITH_DOCTOR
  const receptionMoveLocked = !isDoctor && status === 'WITH_DOCTOR'

  const activeConditions = Object.keys(CONDITIONS_LABELS).filter((k) => patient[k])

  const genderLabel = patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : patient.gender === 'O' ? 'Other' : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {/* Queue number badge */}
          <div className="w-9 h-9 rounded-xl bg-blue-700 text-white text-sm font-bold flex items-center justify-center shrink-0">
            {queue_number}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{patient.patient_name}</p>
            {patient.mobile_no && (
              <p className="text-xs text-gray-400">{patient.mobile_no}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status badge — tap to cycle */}
          <button onClick={onStatusCycle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition active:scale-95 ${cfg.color}`}
            title="Tap to change status"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </button>

          {/* 3-dot menu */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === item.id ? null : item.id) }}
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition text-lg font-bold"
            >
              ⋮
            </button>
            {openMenu === item.id && (
              <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-xl z-50 w-56 py-1 overflow-hidden"
                onClick={(e) => e.stopPropagation()}>

                {/* ── Status actions ── */}
                {/* "With Doctor": reception can't use this from DONE; greyed when already WITH_DOCTOR */}
                {(isDoctor || status !== 'DONE') && (
                  <MenuOption
                    icon="👨‍⚕️" label="With Doctor"
                    onClick={onMoveToWithDoctor}
                    disabled={status === 'WITH_DOCTOR'}
                    hint={status === 'WITH_DOCTOR'
                      ? 'Already with doctor'
                      : (!isDoctor ? 'Only doctor can edit or remove after this' : null)}
                  />
                )}
                {/* Doctor-only actions */}
                {isDoctor && status !== 'DONE' && (
                  <MenuOption icon="✅" label="Mark Done" onClick={onMarkDone}
                    hint="Creates the bill & marks patient as Done" />
                )}
                {isDoctor && status !== 'WAITING' && (
                  <MenuOption icon="↩️" label="Move to Waiting" onClick={onMoveToWaiting} />
                )}

                {/* ── Position actions — hidden for DONE patients ── */}
                {status !== 'DONE' && (
                  <>
                    <MenuOption
                      icon="⬆️" label="Move Up"
                      onClick={onMoveUp}
                      disabled={isFirst || receptionMoveLocked}
                      hint={receptionMoveLocked ? 'Not allowed while patient is with doctor' : null}
                    />
                    <MenuOption
                      icon="⬇️" label="Move Down"
                      onClick={onMoveDown}
                      disabled={isLast || receptionMoveLocked}
                      hint={receptionMoveLocked ? 'Not allowed while patient is with doctor' : null}
                    />
                  </>
                )}

                <div className="my-1 border-t border-gray-100" />

                {/* ── Management actions ── */}
                <MenuOption
                  icon="✏️" label="Edit Patient"
                  onClick={onEdit}
                  disabled={receptionLocked}
                  hint={receptionLocked ? 'Only doctor can edit now' : null}
                />
                <MenuOption
                  icon="🗑️" label="Remove"
                  onClick={onDelete}
                  disabled={receptionLocked}
                  hint={receptionLocked ? 'Only doctor can remove now' : null}
                  danger
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Middle row — vitals & details */}
      {(patient.age || genderLabel || patient.weight || patient.height || patient.pulse_rate) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {genderLabel && <Chip label={genderLabel} />}
          {patient.age        && <Chip label={`${patient.age} yrs`} />}
          {patient.pulse_rate && <Chip label={`${patient.pulse_rate} bpm`} />}
          {patient.weight     && <Chip label={`${patient.weight} kg`} />}
          {patient.height     && <Chip label={`${patient.height} cm`} />}
        </div>
      )}

      {/* Conditions row */}
      {activeConditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {activeConditions.map((k) => (
            <span key={k}
              className="text-[10px] font-medium bg-red-50 text-red-600 border border-red-100 rounded-full px-2 py-0.5">
              {CONDITIONS_LABELS[k]}
            </span>
          ))}
        </div>
      )}

      {/* Condition notes */}
      {patient.condition_notes && (
        <p className="text-xs text-gray-400 mt-2 italic">📝 {patient.condition_notes}</p>
      )}

      {/* Reception collection badge */}
      {parseFloat(item.reception_amount_collected) > 0 && (
        <div className="mt-2">
          <span className="text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5">
            💰 ₹{parseFloat(item.reception_amount_collected).toLocaleString('en-IN')} collected at reception
            {item.reception_paid_via && (
              <> · {{ CASH: '💵 Cash', UPI: '📲 UPI', ONLINE: '🌐 Online' }[item.reception_paid_via] || item.reception_paid_via}</>
            )}
          </span>
        </div>
      )}
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

function MenuOption({ icon, label, onClick, danger, disabled, hint }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full flex items-start gap-2.5 px-4 py-2.5 text-left transition
        ${disabled
          ? 'cursor-not-allowed'
          : danger
          ? 'hover:bg-red-50'
          : 'hover:bg-gray-50'}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex flex-col min-w-0">
        <span className={`text-sm font-medium leading-tight
          ${disabled ? 'text-gray-300' : danger ? 'text-red-600' : 'text-gray-700'}`}>
          {label}
        </span>
        {hint && (
          <span className="text-[10px] leading-tight mt-0.5 text-amber-500 font-normal">
            {hint}
          </span>
        )}
      </span>
    </button>
  )
}
