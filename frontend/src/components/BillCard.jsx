import { useState, useRef, useEffect } from 'react'

const fmt = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

const PAID_VIA_LABELS = { CASH: '💵 Cash', UPI: '📲 UPI', ONLINE: '🌐 Online' }

const STATUS_BADGE = {
  PAID:    { cls: 'bg-emerald-100 text-emerald-700', label: '✓ Paid'     },
  PARTIAL: { cls: 'bg-yellow-100  text-yellow-700',  label: '◑ Partial'  },
  UNPAID:  { cls: 'bg-orange-100  text-orange-700',  label: '⏳ Unpaid'  },
}

export default function BillCard({ bill, isDoctor, onEdit, onDelete, onPrint, onPaymentChange, onCollectPartial }) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [confirmPaid, setConfirmPaid] = useState(false)
  const [pendingPaidVia, setPendingPaidVia] = useState(bill.paid_via || 'CASH')
  const menuRef = useRef(null)

  const isOPD     = bill.bill_type === 'OPD'
  const isPaid    = bill.payment_status === 'PAID'
  const isPartial = bill.payment_status === 'PARTIAL'
  const hasAdvance = parseFloat(bill.advance_paid) > 0
  const hasDiscount = parseFloat(bill.discount) > 0
  const accentText = isOPD ? 'text-green-700' : 'text-blue-700'

  const genderLabel = { M: '♂ Male', F: '♀ Female', O: '⚧ Other' }[bill.gender] || ''

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const savePayment = async (updates) => {
    if (paymentSaving || !onPaymentChange) return
    setPaymentSaving(true)
    try {
      await onPaymentChange(bill.id, updates)
    } finally {
      setPaymentSaving(false)
    }
  }

  const changeStatus = (newStatus) => {
    if (newStatus === bill.payment_status) return
    if (!isDoctor) {
      // Reception can only move to PAID (with popup); PARTIAL is set by collect-partial API only
      if (newStatus === 'PAID') {
        setPendingPaidVia(bill.paid_via || 'CASH')
        setConfirmPaid(true)
      }
      return
    }
    savePayment({ payment_status: newStatus, paid_via: bill.paid_via || 'CASH' })
  }

  const confirmMarkPaid = () => {
    savePayment({ payment_status: 'PAID', paid_via: pendingPaidVia })
    setConfirmPaid(false)
  }

  const changePaidVia = (newValue) => {
    savePayment({ payment_status: bill.payment_status, paid_via: newValue })
  }

  return (
    <>
      <div
        className="bg-white rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setExpanded((e) => !e)}
      >
      {/* Summary row */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-800">{bill.patient_name}</h3>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0
              ${isOPD ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
              {isOPD ? '🩺 OPD' : '🏥 IPD'}
            </span>
            {/* Payment status badge */}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[bill.payment_status]?.cls ?? 'bg-orange-100 text-orange-700'}`}>
              {STATUS_BADGE[bill.payment_status]?.label ?? '⏳ Unpaid'}
            </span>
            {bill.remote_row_ref && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full shrink-0">
                ✓ Sheet
              </span>
            )}
            {bill.callout && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 border
                ${bill.callout === 'Bill settled'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                {bill.callout === 'Bill settled' ? '✅ Bill settled' : `📋 ${bill.callout}`}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-0.5">
            {isOPD
              ? <span>OPD No: <span className="font-medium">{bill.opd_no || '—'}</span></span>
              : <span>
                  IPD No: <span className="font-medium">{bill.ipd_no || '—'}</span>
                  {bill.room_no ? ` · Room ${bill.room_no}` : ''}
                  {bill.ward ? ` · ${bill.ward}` : ''}
                </span>
            }
          </p>

          <p className="text-xs text-gray-400 mt-0.5">
            {isOPD
              ? `Visit: ${fmtDate(bill.visit_date)}`
              : `${fmtDate(bill.admitted_on)}${bill.discharged_on ? ` → ${fmtDate(bill.discharged_on)}` : ''}${bill.total_stay > 0 ? ` · ${bill.total_stay}d` : ''}`
            }
          </p>
          {(bill.mobile_no || genderLabel || bill.age || bill.pulse_rate || bill.weight || bill.height) && (
            <p className="text-xs text-gray-400 mt-0.5">
              {bill.mobile_no && <span>📱 {bill.mobile_no}</span>}
              {bill.mobile_no && genderLabel && <span className="mx-1">·</span>}
              {genderLabel && <span>{genderLabel}</span>}
              {bill.age && <span className="mx-1">·</span>}
              {bill.age && <span>🎂 {bill.age} yr</span>}
              {bill.pulse_rate && <span className="mx-1">·</span>}
              {bill.pulse_rate && <span>💓 {bill.pulse_rate} bpm</span>}
              {bill.weight && <span className="mx-1">·</span>}
              {bill.weight && <span>⚖️ {bill.weight} kg</span>}
              {bill.height && <span className="mx-1">·</span>}
              {bill.height && <span>📏 {bill.height} cm</span>}
            </p>
          )}
        </div>

        <div className="flex items-start gap-0.5 shrink-0">
          <div className="text-right">
            <div className={`text-lg font-bold ${accentText}`}>{fmt(bill.net_bill)}</div>
            {(hasAdvance || hasDiscount) && (
              <div className="text-xs text-gray-400 line-through">{fmt(bill.total_bill)}</div>
            )}
            {hasAdvance && (
              <div className="text-xs text-green-600">−{fmt(bill.advance_paid)} adv</div>
            )}
            {hasDiscount && (
              <div className="text-xs text-purple-600">−{fmt(bill.discount)} disc</div>
            )}
            <div className="text-[10px] text-gray-300 mt-1">{expanded ? '▲' : '▼'}</div>
          </div>

          {/* ⋮ Kebab */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition text-xl leading-none"
            >⋮</button>
            {menuOpen && (
              <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-xl z-30 min-w-[160px] py-1">
                <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPrint?.(bill) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5">
                  🖨️ Print
                </button>
                {isDoctor && (
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit?.(bill) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5">
                    ✏️ Edit
                  </button>
                )}
                {isDoctor && bill.payment_status === 'UNPAID' && onCollectPartial && (
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onCollectPartial(bill) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-indigo-700 hover:bg-indigo-50 flex items-center gap-2.5">
                    💰 Collect Partial
                  </button>
                )}
                {isDoctor && onDelete && (
                  <>
                    <div className="h-px bg-gray-100 mx-3 my-0.5" />
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete?.(bill) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5">
                      🗑️ Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Payment bar (always visible) ─────────────────────────────────── */}
      <div
        className="flex items-center gap-2 flex-wrap px-4 pb-3"
        onClick={(e) => e.stopPropagation()}
      >
        {isDoctor ? (
          /* ── Doctor: 2-option dropdown (UNPAID / PAID) ── */
          <>
            <PayStatusSelector
              value={bill.payment_status}
              disabled={paymentSaving}
              onChange={changeStatus}
            />
            {isPaid && (
              <PayViaSelector
                value={bill.paid_via || 'CASH'}
                disabled={paymentSaving}
                onChange={changePaidVia}
              />
            )}
            {isPaid && (
              <span className="text-[10px] text-gray-400 ml-auto">
                via {PAID_VIA_LABELS[bill.paid_via] || bill.paid_via}
              </span>
            )}
          </>
        ) : isPaid ? (
          /* ── Reception: PAID is immutable ── */
          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">
            ✓ Paid · {PAID_VIA_LABELS[bill.paid_via] || bill.paid_via}
          </span>
        ) : (
          /* ── Reception: UNPAID or PARTIAL → show "Mark as Paid" button ── */
          <button
            disabled={paymentSaving}
            onClick={() => { setPendingPaidVia(bill.paid_via || 'CASH'); setConfirmPaid(true) }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-red-50 border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-60 active:scale-95 transition"
          >
            {paymentSaving
              ? <span className="animate-spin leading-none">⏳</span>
              : '✓ Mark as Paid'}
          </button>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl">
          {bill.line_items?.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase text-[10px]">
                  <th className="text-left pb-1.5 font-medium">Charge</th>
                  <th className="text-right pb-1.5 font-medium">{isOPD ? '₹/Unit' : '₹/Day'}</th>
                  <th className="text-right pb-1.5 font-medium">{isOPD ? 'Qty' : 'Days'}</th>
                  <th className="text-right pb-1.5 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bill.line_items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-1.5 text-gray-700">{item.name}</td>
                    <td className="py-1.5 text-right text-gray-500">{fmt(item.rate_per_day)}</td>
                    <td className="py-1.5 text-right text-gray-500">{item.days}</td>
                    <td className="py-1.5 text-right font-medium text-gray-700">{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 text-[11px]">
                <tr>
                  <td colSpan="3" className="pt-2 text-right text-gray-500">Total</td>
                  <td className="pt-2 text-right font-bold text-gray-800">{fmt(bill.total_bill)}</td>
                </tr>
                {hasAdvance && (
                  <tr>
                    <td colSpan="3" className="text-right text-gray-500">Less Advance</td>
                    <td className="text-right text-green-600">−{fmt(bill.advance_paid)}</td>
                  </tr>
                )}
                {hasDiscount && (
                  <tr>
                    <td colSpan="3" className="text-right text-gray-500">
                      Discount{bill.discount_note ? ` (${bill.discount_note})` : ''}
                    </td>
                    <td className="text-right text-purple-600">−{fmt(bill.discount)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan="3" className={`text-right font-semibold ${accentText}`}>Net Payable</td>
                  <td className={`text-right font-bold ${accentText}`}>{fmt(bill.net_bill)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="text-xs text-gray-400 py-1">No line items recorded.</p>
          )}
        </div>
      )}
    </div>

    {/* ── Reception confirmation popup — Mark as Paid ─────────────────── */}
    {confirmPaid && (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={() => setConfirmPaid(false)}
      >
        <div
          className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-3xl mb-2 text-center">✓</div>
          <h3 className="text-base font-bold text-gray-800 text-center">Move to Paid?</h3>
          <p className="text-sm text-gray-500 mt-1.5 text-center">
            Are you sure you want to mark this bill as paid?
          </p>
          <p className="text-xs text-orange-700 mt-2 text-center bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">
            ⚠ Only doctors can change the status after it's moved to paid.
          </p>
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-600 mb-1.5">Payment received via</p>
            <PayViaSelector
              value={pendingPaidVia}
              disabled={paymentSaving}
              onChange={setPendingPaidVia}
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setConfirmPaid(false)}
              className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition"
            >
              No, cancel
            </button>
            <button
              disabled={paymentSaving}
              onClick={confirmMarkPaid}
              className="flex-1 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
            >
              {paymentSaving ? '⏳' : 'Yes, mark paid'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  )
}

/* ── Payment status dropdown (doctor only — UNPAID ↔ PAID) ─────────────── */

// Only UNPAID and PAID are selectable; PARTIAL is set only via collect-partial API
const STATUS_OPTIONS = [
  { value: 'UNPAID', label: '○ Unpaid', cls: 'text-orange-700',  bg: 'bg-orange-50  border-orange-200  hover:bg-orange-100'  },
  { value: 'PAID',   label: '✓ Paid',   cls: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
]

// Full display map including PARTIAL (shown as trigger label when bill is PARTIAL)
const STATUS_DISPLAY = {
  UNPAID:  { label: '○ Unpaid',  cls: 'text-orange-700',  bg: 'bg-orange-50  border-orange-200'  },
  PARTIAL: { label: '◑ Partial', cls: 'text-yellow-700',  bg: 'bg-yellow-50  border-yellow-200'  },
  PAID:    { label: '✓ Paid',    cls: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
}

function PayStatusSelector({ value, disabled, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = STATUS_DISPLAY[value] || STATUS_DISPLAY.UNPAID

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition active:scale-95 disabled:opacity-60 select-none ${current.cls} ${current.bg}`}
      >
        {disabled
          ? <span className="animate-spin leading-none">⏳</span>
          : <>{current.label}<span className="text-[10px] opacity-50 leading-none">▾</span></>
        }
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-[140px] py-1">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${opt.cls} ${opt.value === value ? 'font-semibold' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Custom pay-via dropdown ────────────────────────────────────────────── *
 * Replaces <select> so font size + position are consistent on all devices.  */

const PAY_OPTIONS = [
  { value: 'UPI',    label: '📲 UPI'    },
  { value: 'CASH',   label: '💵 Cash'   },
  { value: 'ONLINE', label: '🌐 Online' },
]

function PayViaSelector({ value, disabled, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const current = PAY_OPTIONS.find(o => o.value === value) || PAY_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 disabled:opacity-60 select-none active:bg-gray-50"
      >
        <span>{current.label}</span>
        <span className="text-[10px] text-gray-400 leading-none">▾</span>
      </button>

      {/* Dropdown — anchored below trigger, consistent on all screen sizes */}
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-[120px] py-1">
          {PAY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(opt.value)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                opt.value === value ? 'font-semibold text-blue-700' : 'text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
