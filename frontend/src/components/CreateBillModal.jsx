import { useState, useEffect } from 'react'
import { useServiceRates } from '../hooks/useServiceRates'

const emptyIPD = {
  patient_name: '', address: '', mobile_no: '', gender: '',
  age: '', pulse_rate: '', weight: '', height: '',
  admitted_on: '', discharged_on: '',
  room_no: '', ward: '', total_stay: '',
  advance_paid: '0', advance_paid_via: 'CASH', discount: '', discount_note: '',
}

const emptyOPD = {
  patient_name: '', address: '', mobile_no: '', gender: '',
  age: '', pulse_rate: '', weight: '', height: '',
  visit_date: '',
  advance_paid: '0', advance_paid_via: 'CASH', discount: '', discount_note: '',
}

/** Returns today's date as YYYY-MM-DD in the browser's local time zone. */
const todayISO = () => new Date().toLocaleDateString('en-CA')

export default function CreateBillModal({ apiClient, isDoctor, onClose, onCreated, onUpdated, editBill, prefillData }) {
  const isEdit = Boolean(editBill)
  const defaultType = editBill?.bill_type || prefillData?._queue?.reception_bill_type || 'IPD'

  const [billType, setBillType] = useState(defaultType)
  const [step, setStep] = useState(1)

  const [form, setForm] = useState(() => {
    const today = todayISO()
    if (!editBill) {
      // Pre-fill from patient profile when opening "Create Bill" from Queue
      const pre = prefillData || {}
      const q = pre._queue || {}
      const common = {
        patient_name: pre.patient_name || '',
        address:      pre.address      || '',
        mobile_no:    pre.mobile_no    || '',
        gender:       pre.gender       || '',
        age:          pre.age        != null ? String(pre.age)        : '',
        pulse_rate:   pre.pulse_rate != null ? String(pre.pulse_rate) : '',
        weight:       pre.weight     != null ? String(pre.weight)     : '',
        height:       pre.height     != null ? String(pre.height)     : '',
        advance_paid: parseFloat(q.reception_amount_collected) > 0
            ? String(q.reception_amount_collected)
            : '0',
        advance_paid_via: q.reception_paid_via || 'CASH',
      }
      return defaultType === 'IPD'
        ? { ...emptyIPD, ...common, admitted_on: today }
        : { ...emptyOPD, ...common, visit_date: today }
    }
    return {
      patient_name:   editBill.patient_name || '',
      address:        editBill.address || '',
      mobile_no:      editBill.mobile_no || '',
      gender:         editBill.gender || '',
      age:            editBill.age != null ? String(editBill.age) : '',
      pulse_rate:     editBill.pulse_rate != null ? String(editBill.pulse_rate) : '',
      weight:         editBill.weight != null ? String(editBill.weight) : '',
      height:         editBill.height != null ? String(editBill.height) : '',
      admitted_on:    editBill.admitted_on || '',
      discharged_on:  editBill.discharged_on || '',
      room_no:        editBill.room_no || '',
      ward:           editBill.ward || '',
      total_stay:     String(editBill.total_stay ?? ''),
      visit_date:     editBill.visit_date || '',
      advance_paid:   String(editBill.advance_paid ?? '0'),
      advance_paid_via: editBill.advance_paid_via || 'CASH',
      discount:       editBill.discount != null ? String(editBill.discount) : '',
      discount_note:  editBill.discount_note || '',
    }
  })

  const [lineItems, setLineItems] = useState(() => {
    if (editBill?.line_items?.length) {
      return editBill.line_items.map((i) => ({
        name: i.name, rate_per_day: String(i.rate_per_day), days: String(i.days),
      }))
    }
    const rItems = prefillData?._queue?.reception_line_items
    if (!editBill && rItems?.length) {
      return rItems.map((i) => ({
        name: i.name,
        rate_per_day: String(i.rate_per_day || i.rate || '0'),
        days: String(i.days || 1),
        _fromReception: true,
      }))
    }
    return []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { ipdRates, opdRates, loading: ratesLoading } = useServiceRates(apiClient)

  // Safety net: if component somehow mounted before prefillData._queue was ready,
  // seed lineItems from reception data once (only when lineItems is empty and
  // prefillData has reception items, and we're not in edit mode).
  useEffect(() => {
    if (isEdit) return
    const rItems = prefillData?._queue?.reception_line_items
    if (rItems?.length && lineItems.length === 0) {
      setLineItems(
        rItems.map((i) => ({
          name: i.name,
          rate_per_day: String(i.rate_per_day || i.rate || '0'),
          days: String(i.days || 1),
          _fromReception: true,
        }))
      )
      const amt = parseFloat(prefillData._queue.reception_amount_collected)
      if (amt > 0) {
        setForm((f) => ({
          ...f,
          advance_paid: String(prefillData._queue.reception_amount_collected),
          advance_paid_via: prefillData._queue.reception_paid_via || 'CASH',
        }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally runs only once on mount

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

  const charges = billType === 'OPD' ? opdRates : ipdRates
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
    (sum, i) => {
      const amt = (parseFloat(i.rate_per_day) || 0) * (parseInt(i.days) || 0)
      return sum + (amt > 0 ? amt : 0)  // only positive charges count
    }, 0
  )
  const discountAmt = parseFloat(form.discount) || 0
  const totalPc = isEdit ? (parseFloat(editBill?.total_partially_collected) || 0) : 0
  const netBill = totalBill - (parseFloat(form.advance_paid) || 0) - discountAmt - totalPc

  const canStep2 = form.patient_name.trim()
  const canStep3 = canStep2 && (billType === 'OPD' ? form.visit_date : form.admitted_on)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      // Helper: turn '' into null for date fields
      const dateOrNull = (v) => v || null

      const base = {
        bill_type: billType,
        patient_name_input: form.patient_name,
        address_input: form.address,
        mobile_no_input: form.mobile_no,
        gender_input: form.gender,
        weight_input: form.weight !== '' ? form.weight : null,
        height_input: form.height !== '' ? form.height : null,
        age_input:    form.age !== '' ? parseInt(form.age) : null,
        pulse_rate_input: form.pulse_rate !== '' ? parseInt(form.pulse_rate) : null,
        // Link to visit if provided (from PatientProfilePage "Move to Done" flow)
        ...(prefillData?._visit_id ? { visit_id: prefillData._visit_id } : {}),
        advance_paid: form.advance_paid,
        advance_paid_via: form.advance_paid_via,
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

        {/* ── Step tabs — 3 steps ── */}
        <div className="flex border-b shrink-0">
          {[
            { label: 'Patient',      s: 1, canGo: true       },
            { label: 'Type & Dates', s: 2, canGo: !!canStep2 },
            { label: 'Charges',      s: 3, canGo: !!canStep3 },
          ].map(({ label, s, canGo }) => (
            <button
              key={s}
              onClick={() => canGo && setStep(s)}
              className={`flex-1 py-3 text-sm font-medium transition
                ${step === s
                  ? (billType === 'OPD' ? 'text-green-700 border-b-2 border-green-600' : 'text-blue-700 border-b-2 border-blue-700')
                  : canGo ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'
                }`}
            >
              {s}. {label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4">

          {/* ── Step 1: Patient Details (common to both IPD & OPD) ── */}
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
                <div className="flex rounded-lg border border-gray-300 overflow-hidden h-[42px]">
                  {[{ v: 'M', l: 'Male' }, { v: 'F', l: 'Female' }, { v: 'O', l: 'Other' }].map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setForm(f => ({ ...f, gender: f.gender === v ? '' : v }))}
                      className={`flex-1 text-sm font-medium transition
                        ${form.gender === v
                          ? (billType === 'OPD' ? 'bg-green-600 text-white' : 'bg-blue-700 text-white')
                          : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >{l}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Age (years)</label>
                <input className="input" type="number" min="0" max="120" step="1"
                  value={form.age} onChange={set('age')} placeholder="e.g. 35" />
              </div>
              <div>
                <label className="label">Pulse Rate (bpm)</label>
                <input className="input" type="number" min="0" max="300" step="1"
                  value={form.pulse_rate} onChange={set('pulse_rate')} placeholder="e.g. 72" />
              </div>

              <div>
                <label className="label">Weight (kg)</label>
                <input className="input" type="number" min="0" max="300" step="0.1"
                  value={form.weight} onChange={set('weight')} placeholder="e.g. 12.5" />
              </div>
              <div>
                <label className="label">Height (cm)</label>
                <input className="input" type="number" min="0" max="300" step="0.1"
                  value={form.height} onChange={set('height')} placeholder="e.g. 165" />
              </div>
            </div>
          )}

          {/* ── Step 2: Type & Dates ── */}
          {step === 2 && (
            <div className="space-y-4">

              {/* IPD / OPD toggle — create mode only; locked display in edit mode */}
              {!isEdit ? (
                <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                  {[
                    { type: 'IPD', icon: '🏥', label: 'IPD — In-Patient'  },
                    { type: 'OPD', icon: '🩺', label: 'OPD — Out-Patient' },
                  ].map(({ type, icon, label }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const today = todayISO()
                        setBillType(type)
                        // Keep reception-tagged items across type change; clear only manually added ones
                        setLineItems((prev) => prev.filter((i) => i._fromReception))
                        setForm(f => ({
                          ...f,
                          admitted_on:   type === 'IPD' ? (f.admitted_on || today) : '',
                          discharged_on: type === 'IPD' ? f.discharged_on : '',
                          room_no:       type === 'IPD' ? f.room_no : '',
                          ward:          type === 'IPD' ? f.ward : '',
                          total_stay:    type === 'IPD' ? f.total_stay : '',
                          visit_date:    type === 'OPD' ? (f.visit_date || today) : '',
                        }))
                      }}
                      className={`flex-1 py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2
                        ${billType === type
                          ? (type === 'OPD' ? 'bg-green-600 text-white' : 'bg-blue-700 text-white')
                          : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold
                  ${billType === 'OPD' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                  <span>{billType === 'OPD' ? '🩺' : '🏥'}</span>
                  {billType === 'OPD' ? 'OPD — Out-Patient' : 'IPD — In-Patient'}
                  <span className="ml-auto text-xs opacity-50">locked</span>
                </div>
              )}

              {/* Type-specific date / location fields */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {billType === 'OPD' ? (
                  <div className="col-span-2">
                    <label className="label">Visit Date *</label>
                    <input className="input" type="date" max={todayISO()} value={form.visit_date} onChange={set('visit_date')} />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="label">Ward</label>
                      <input className="input" value={form.ward} onChange={set('ward')} placeholder="General" />
                    </div>
                    <div>
                      <label className="label">Room / Bed No</label>
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
            </div>
          )}

          {/* ── Step 3: Charges & Summary ── */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Reception collection banner */}
              {!isEdit && parseFloat(prefillData?._queue?.reception_amount_collected) > 0 && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-xs text-green-700">
                  <span className="text-sm">💰</span>
                  <span>
                    <span className="font-semibold">
                      ₹{parseFloat(prefillData._queue.reception_amount_collected).toLocaleString('en-IN')}
                    </span>
                    {' '}collected at reception via{' '}
                    {prefillData._queue.reception_paid_via === 'CASH' ? 'Cash'
                      : prefillData._queue.reception_paid_via === 'UPI' ? 'UPI' : 'Online'}
                    {' '}· Set as advance paid
                  </span>
                </div>
              )}

              {/* Quick-add chips */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick-add charges</p>
                {ratesLoading ? (
                  <p className="text-xs text-gray-400 animate-pulse py-1">Loading charges…</p>
                ) : charges.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1">
                    No active {billType} charges configured.
                    {' '}Add them in the <strong>Charges</strong> tab.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {charges.map((ct) => (
                      <button
                        key={ct.name}
                        onClick={() => addCharge(ct)}
                        className={`text-xs border rounded-full px-3 py-1 active:scale-95 transition
                          ${billType === 'OPD' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                      >
                        + {ct.name}
                        {ct.rate && ct.rate !== '0' && (
                          <span className="ml-1 opacity-60">₹{ct.rate}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
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
                        <div className="col-span-4 text-xs font-medium text-gray-700 truncate leading-tight">
                          {item.name}
                          {item._fromReception && (
                            <span className="ml-1 text-[9px] bg-green-100 text-green-600 rounded px-1 align-middle font-semibold">Reception</span>
                          )}
                        </div>
                        <div className="col-span-3">
                          {isDoctor ? (
                            <input type="number" min="0" value={item.rate_per_day}
                              onChange={(e) => updateItem(idx, 'rate_per_day', e.target.value)}
                              className="w-full text-right text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                          ) : (
                            <span className="block w-full text-right text-xs text-gray-600 px-1.5 py-1">
                              {item.rate_per_day}
                            </span>
                          )}
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

              {/* Totals */}
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
                {/* Total Partial Collections — shown in edit mode when > 0 */}
                {isEdit && totalPc > 0 && (
                  <div className="flex justify-between text-sm text-indigo-700 bg-indigo-50 rounded-lg px-2 py-1.5 border border-indigo-100">
                    <span className="font-medium">💰 Total Partial Collections</span>
                    <span className="font-semibold">₹{totalPc.toLocaleString('en-IN')}</span>
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
          {step === 1 && (
            <button onClick={() => setStep(2)} disabled={!canStep2}
              className={`flex-1 text-white rounded-xl py-3 text-sm font-semibold active:scale-95 transition disabled:opacity-50
                ${billType === 'OPD' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-700 hover:bg-blue-800'}`}
            >
              Next: Type &amp; Dates →
            </button>
          )}
          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} className="px-5 border border-gray-300 text-gray-600 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition">
                ← Back
              </button>
              <button onClick={() => setStep(3)} disabled={!canStep3}
                className={`flex-1 text-white rounded-xl py-3 text-sm font-semibold active:scale-95 transition disabled:opacity-50
                  ${billType === 'OPD' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-700 hover:bg-blue-800'}`}
              >
                Next: Add Charges →
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <button onClick={() => setStep(2)} className="px-5 border border-gray-300 text-gray-600 rounded-xl py-3 text-sm font-medium hover:bg-gray-50 transition">
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={loading || lineItems.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 text-sm font-semibold active:scale-95 transition disabled:opacity-50"
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
