import { useState, useRef, useEffect } from 'react'

const fmt = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

export default function BillCard({ bill, onEdit, onDelete, onPrint }) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const hasAdvance = parseFloat(bill.advance_paid) > 0

  // Close the kebab menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setExpanded((e) => !e)}
    >
      {/* Summary row */}
      <div className="flex items-start justify-between px-4 py-4 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-800">{bill.patient_name}</h3>
            {bill.remote_row_ref && (
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full shrink-0">
                ✓ Sheets
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            IPD: <span className="font-medium">{bill.ipd_no || '—'}</span>
            {bill.room_no ? ` · Room ${bill.room_no}` : ''}
            {bill.ward ? ` · ${bill.ward}` : ''}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {fmtDate(bill.admitted_on)}
            {bill.discharged_on ? ` → ${fmtDate(bill.discharged_on)}` : ''}
            {bill.total_stay > 0 ? ` · ${bill.total_stay} day${bill.total_stay !== 1 ? 's' : ''}` : ''}
          </p>
        </div>

        <div className="flex items-start gap-0.5 shrink-0">
          {/* Amount */}
          <div className="text-right">
            <div className="text-lg font-bold text-blue-700">{fmt(bill.net_bill)}</div>
            {hasAdvance && (
              <>
                <div className="text-xs text-gray-400 line-through">{fmt(bill.total_bill)}</div>
                <div className="text-xs text-green-600">-{fmt(bill.advance_paid)} adv</div>
              </>
            )}
            <div className="text-[10px] text-gray-300 mt-1">{expanded ? '▲' : '▼'}</div>
          </div>

          {/* ⋮ Kebab menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition text-xl leading-none"
              title="More options"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-xl z-30 min-w-[144px] py-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPrint?.(bill) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                >
                  🖨️ Print
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit?.(bill) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                >
                  ✏️ Edit
                </button>
                <div className="h-px bg-gray-100 mx-3 my-0.5" />
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete?.(bill) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5"
                >
                  🗑️ Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded line-items table */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-xl overflow-hidden">
          {bill.line_items?.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 uppercase text-[10px]">
                  <th className="text-left pb-1.5 font-medium">Charge</th>
                  <th className="text-right pb-1.5 font-medium">Rate/Day</th>
                  <th className="text-right pb-1.5 font-medium">Days</th>
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
                    <td className="text-right text-green-600">-{fmt(bill.advance_paid)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan="3" className="text-right font-semibold text-blue-700">Net Payable</td>
                  <td className="text-right font-bold text-blue-700">{fmt(bill.net_bill)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="text-xs text-gray-400 py-1">No line items recorded.</p>
          )}
        </div>
      )}
    </div>
  )
}
