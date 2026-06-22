import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { createApiClient } from '../api'
import Header from '../components/Header'
import BillCard from '../components/BillCard'
import CreateBillModal from '../components/CreateBillModal'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 5000 // 5 s after typing stops

export default function Bills({ onTabChange }) {
  const { user, logout } = useAuth()
  const apiClient = useMemo(() => createApiClient(user.token), [user.token])
  const isDoctor = user?.role === 'doctor'

  const [results, setResults] = useState([])           // current page bills
  const [totalCount, setTotalCount] = useState(0)      // total matching search+filter
  const [summary, setSummary] = useState({ ipd: 0, opd: 0 }) // overall type counts
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editBill, setEditBill] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [collectPartialBill, setCollectPartialBill] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL') // 'ALL' | 'IPD' | 'OPD'
  const [page, setPage] = useState(1)
  const [refreshTick, setRefreshTick] = useState(0)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2000)
  }

  // ── Debounce: wait SEARCH_DEBOUNCE_MS after the user stops typing ──────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  // ── Reset to page 1 whenever the effective search or type filter changes ───
  useEffect(() => { setPage(1) }, [debouncedSearch, typeFilter])

  // ── Fetch from the server whenever page / debouncedSearch / typeFilter / refreshTick changes ─
  const fetchBills = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (typeFilter !== 'ALL') params.set('bill_type', typeFilter)
      const res = await apiClient.get(`/bills/?${params}`)
      setResults(res.data.results ?? [])
      setTotalCount(res.data.count ?? 0)
      setSummary(res.data.summary ?? { ipd: 0, opd: 0 })
    } catch (err) {
      if (err.response?.status === 401) logout()
    } finally {
      setLoading(false)
    }
  }, [apiClient, logout, page, debouncedSearch, typeFilter, refreshTick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchBills() }, [fetchBills])

  // ── Derived pagination ─────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  // ── Event handlers ─────────────────────────────────────────────────────────
  const handleBillCreated = (newBill) => {
    // Jump back to page 1 with cleared search so the new bill is visible
    setPage(1)
    setSearch('')
    setDebouncedSearch('')
    setRefreshTick((t) => t + 1)
    showToast(`✓ ${newBill.bill_type} bill saved for ${newBill.patient_name} · Net ₹${parseFloat(newBill.net_bill).toLocaleString('en-IN')}`)
  }

  const handleBillUpdated = (updatedBill) => {
    setResults((prev) => prev.map((b) => (b.id === updatedBill.id ? updatedBill : b)))
    showToast(`✓ Bill updated for ${updatedBill.patient_name}`)
  }

  const handleDeleteConfirmed = async () => {
    const bill = confirmDelete
    setConfirmDelete(null)
    try {
      await apiClient.delete(`/bills/${bill.id}/`)
      // If we just deleted the last row on a page > 1, step back a page
      if (results.length === 1 && page > 1) {
        setPage((p) => p - 1)
      } else {
        setRefreshTick((t) => t + 1)
      }
      showToast(`✓ Bill deleted for ${bill.patient_name}`)
    } catch {
      showToast('⚠ Failed to delete bill. Please try again.', 'error')
    }
  }

  const handlePaymentChange = async (billId, updates) => {
    try {
      const { data } = await apiClient.patch(`/bills/${billId}/payment/`, updates)
      // Patch the local results array so the card re-renders immediately
      setResults((prev) => prev.map((b) => (b.id === billId ? data : b)))
    } catch {
      showToast('⚠ Failed to update payment status.', 'error')
    }
  }

  const handleCollectPartialSubmit = async (amount) => {
    if (!collectPartialBill) return
    try {
      const { data } = await apiClient.post(
        `/bills/${collectPartialBill.id}/collect-partial/`,
        { amount: String(amount) }
      )
      setResults((prev) => prev.map((b) => (b.id === collectPartialBill.id ? data : b)))
      setCollectPartialBill(null)
      showToast(`✓ Collect request set for ${data.patient_name}`)
    } catch (err) {
      showToast(err?.response?.data?.detail || '⚠ Failed to record partial collection.', 'error')
    }
  }

  const handleExecuteCollect = async (pcrId, paidVia) => {
    try {
      const { data } = await apiClient.post(`/collect-partial/${pcrId}/execute/`, { paid_via: paidVia })
      setResults((prev) => prev.map((b) => (b.id === data.id ? data : b)))
      showToast(`✓ Collected · ${data.patient_name}`)
    } catch (err) {
      showToast(err?.response?.data?.detail || '⚠ Failed to collect.', 'error')
    }
  }

  const handleDeleteCollect = async (pcrId) => {
    try {
      const { data } = await apiClient.delete(`/collect-partial/${pcrId}/`)
      setResults((prev) => prev.map((b) => (b.id === data.id ? data : b)))
      showToast('✓ Collect request removed')
    } catch {
      showToast('⚠ Failed to remove collect request.', 'error')
    }
  }

  const handleEditCollect = async (pcrId, amount) => {
    try {
      const { data } = await apiClient.patch(`/collect-partial/${pcrId}/`, { amount: String(amount) })
      setResults((prev) => prev.map((b) => (b.id === data.id ? data : b)))
      showToast('✓ Collect amount updated')
    } catch (err) {
      showToast(err?.response?.data?.detail || '⚠ Failed to update.', 'error')
    }
  }

  const handlePrint = (bill) => {
    const fDate = (d) =>
      d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
    const fAmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    const isOPD = bill.bill_type === 'OPD'

    const rows = (bill.line_items || []).map((i) =>
      `<tr><td>${i.name}</td><td style="text-align:right">${fAmt(i.rate_per_day)}</td>` +
      `<td style="text-align:center">${i.days}</td><td style="text-align:right">${fAmt(i.amount)}</td></tr>`
    ).join('')

    const genderLabel = { M: 'Male', F: 'Female', O: 'Other' }[bill.gender] || '—'

    const patientSection = isOPD
      ? `<div>Patient Name: <b>${bill.patient_name || '—'}</b></div>
         <div>OPD No: <b>${bill.opd_no || '—'}</b></div>
         <div>Mobile No: <b>${bill.mobile_no || '—'}</b></div>
         <div>Gender: <b>${genderLabel}</b></div>
         <div>Age: <b>${bill.age ? bill.age + ' yrs' : '—'}</b></div>
         <div>Pulse Rate: <b>${bill.pulse_rate ? bill.pulse_rate + ' bpm' : '—'}</b></div>
         <div>Weight: <b>${bill.weight ? bill.weight + ' kg' : '—'}</b></div>
         <div>Height: <b>${bill.height ? bill.height + ' cm' : '—'}</b></div>
         <div>Address: <b>${bill.address || '—'}</b></div>
         <div>Visit Date: <b>${fDate(bill.visit_date)}</b></div>`
      : `<div>Patient Name: <b>${bill.patient_name || '—'}</b></div>
         <div>IPD No: <b>${bill.ipd_no || '—'}</b></div>
         <div>Mobile No: <b>${bill.mobile_no || '—'}</b></div>
         <div>Gender: <b>${genderLabel}</b></div>
         <div>Age: <b>${bill.age ? bill.age + ' yrs' : '—'}</b></div>
         <div>Pulse Rate: <b>${bill.pulse_rate ? bill.pulse_rate + ' bpm' : '—'}</b></div>
         <div>Weight: <b>${bill.weight ? bill.weight + ' kg' : '—'}</b></div>
         <div>Height: <b>${bill.height ? bill.height + ' cm' : '—'}</b></div>
         <div>Address: <b>${bill.address || '—'}</b></div>
         <div>Ward: <b>${bill.ward || '—'}</b></div>
         <div>Room/Bed No: <b>${bill.room_no || '—'}</b></div>
         <div>Total Stay: <b>${bill.total_stay || 0} day(s)</b></div>
         <div>Admitted: <b>${fDate(bill.admitted_on)}</b></div>
         <div>Discharged: <b>${fDate(bill.discharged_on)}</b></div>`

    const discountRow = parseFloat(bill.discount) > 0
      ? `<tr><td>Discount${bill.discount_note ? ` (${bill.discount_note})` : ''}</td><td style="text-align:right">– ${fAmt(bill.discount)}</td></tr>`
      : ''

    const paidViaLabel = { CASH: 'Cash', UPI: 'UPI', ONLINE: 'Online' }[bill.paid_via] || bill.paid_via || '—'
    const paymentRow = bill.payment_status === 'PAID'
      ? `<tr><td>Payment</td><td style="text-align:right;color:#15803d">✓ Paid via ${paidViaLabel}</td></tr>`
      : `<tr><td>Payment</td><td style="text-align:right;color:#c2410c">⏳ Unpaid</td></tr>`

    const html = `<!DOCTYPE html><html><head><title>Bill – ${bill.patient_name}</title><style>
      body{font-family:Arial,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#222}
      .hdr{text-align:center;border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:18px}
      .hdr h1{font-size:22px;margin:0}.hdr p{margin:3px 0;font-size:13px}
      .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-top:6px;
        background:${isOPD ? '#dcfce7' : '#dbeafe'};color:${isOPD ? '#15803d' : '#1d4ed8'}}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 24px;margin-bottom:18px;font-size:13px}
      .grid b{font-weight:600}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px}
      th{background:#f0f0f0;padding:7px 8px;text-align:left;border:1px solid #ccc}
      td{padding:6px 8px;border:1px solid #ddd}
      .tot{margin-left:auto;width:280px;font-size:13px;border-collapse:collapse}
      .tot td{padding:4px 8px;border:none}
      .tot .net td{font-size:15px;font-weight:700;border-top:2px solid #222;padding-top:6px}
      .foot{margin-top:40px;display:flex;justify-content:space-between;font-size:12px}
      @media print{@page{margin:18mm}}</style></head><body>
      <div class="hdr"><h1>Shree Hospital</h1><p>Ambad, Jalna</p>
        <div class="badge">${isOPD ? '🩺 OPD BILL' : '🏥 IPD BILL'}</div></div>
      <div class="grid">${patientSection}</div>
      <table><thead><tr>
        <th>Charge</th>
        <th style="text-align:right">${isOPD ? '₹/Unit' : '₹/Day'}</th>
        <th style="text-align:center">${isOPD ? 'Qty' : 'Days'}</th>
        <th style="text-align:right">Amount</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <table class="tot">
        <tr><td>Total Bill</td><td style="text-align:right">${fAmt(bill.total_bill)}</td></tr>
        ${parseFloat(bill.advance_paid) > 0 ? `<tr><td>Less Advance</td><td style="text-align:right">– ${fAmt(bill.advance_paid)}</td></tr>` : ''}
        ${discountRow}
        <tr class="net"><td>Net Payable</td><td style="text-align:right">${fAmt(bill.net_bill)}</td></tr>
        ${paymentRow}
      </table>
      <div class="foot"><div>Date: ${fDate(new Date().toISOString())}</div>
        <div>Authorised Signature: ___________________</div></div>
      <script>window.onload=()=>window.print()</script></body></html>`

    const win = window.open('', '_blank', 'width=860,height=720')
    win.document.write(html)
    win.document.close()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onRefresh={fetchBills} />

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-white text-xs font-medium rounded-xl px-4 py-2.5 shadow-lg whitespace-nowrap pointer-events-none select-none
          ${toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-white border-b sticky top-[60px] z-30">
        <div className="max-w-2xl mx-auto flex">
          {isDoctor && (
            <button
              onClick={() => onTabChange('dashboard')}
              className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
            >
              📊 Dashboard
            </button>
          )}
          <button className="px-4 py-3 text-sm font-semibold text-blue-700 border-b-2 border-blue-700">
            📋 Bills
            {(summary.ipd + summary.opd) > 0 && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-600 rounded-full px-2 py-0.5">
                {summary.ipd + summary.opd}
              </span>
            )}
          </button>
          <button
            onClick={() => onTabChange('queue')}
            className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
          >
            🏥 Queue
          </button>
          {isDoctor && (
            <button
              onClick={() => onTabChange('charges')}
              className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
            >
              ⚙️ Charges
            </button>
          )}
        </div>
      </div>

      {/* Search + filter */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-4 space-y-2">
        <div className="relative">
          <input
            type="search" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍  Search patient name, IPD / OPD no…"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          {/* Pending-debounce indicator */}
          {search !== debouncedSearch && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">
              ⏳
            </span>
          )}
        </div>
        {/* Type filter pills */}
        <div className="flex gap-2">
          {[
            { key: 'ALL',  label: `All (${summary.ipd + summary.opd})` },
            { key: 'IPD',  label: `🏥 IPD (${summary.ipd})` },
            { key: 'OPD',  label: `🩺 OPD (${summary.opd})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTypeFilter(key)}
              className={`text-xs rounded-full px-3 py-1.5 font-medium border transition
                ${typeFilter === key
                  ? key === 'OPD' ? 'bg-green-600 text-white border-green-600'
                    : key === 'IPD' ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bill list */}
      <main className="max-w-2xl mx-auto w-full px-4 py-4 pb-4 space-y-3">
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-3xl mb-3 animate-spin">⏳</div>
            <p className="text-sm">Loading bills…</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-medium">
              {debouncedSearch || typeFilter !== 'ALL' ? 'No matching bills' : 'No bills yet'}
            </p>
            <p className="text-sm mt-1">
              {debouncedSearch || typeFilter !== 'ALL' ? 'Try adjusting your search or filter' : 'Tap + to create the first bill'}
            </p>
          </div>
        ) : (
          results.map((bill) => (
            <BillCard
              key={bill.id} bill={bill}
              isDoctor={isDoctor}
              onPrint={handlePrint}
              onEdit={(b) => setEditBill(b)}
              onDelete={isDoctor ? (b) => setConfirmDelete(b) : undefined}
              onPaymentChange={handlePaymentChange}
              onCollectPartial={isDoctor ? (b) => setCollectPartialBill(b) : undefined}
              onExecuteCollect={handleExecuteCollect}
              onDeleteCollect={handleDeleteCollect}
              onEditCollect={handleEditCollect}
            />
          ))
        )}
      </main>

      {/* Pagination bar — only when there is more than one page */}
      {totalPages > 1 && (
        <div className="max-w-2xl mx-auto w-full px-4 pb-28">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            {/* Prev */}
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed hover:text-blue-700 transition"
            >
              ← Prev
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                const show = p === 1 || p === totalPages || Math.abs(p - safePage) <= 1
                const showEllipsisAfter = p === 1 && safePage > 3
                const showEllipsisBefore = p === totalPages && safePage < totalPages - 2
                return (
                  <span key={p} className="flex items-center">
                    {showEllipsisAfter && <span className="px-1 text-gray-400 text-xs">…</span>}
                    {show && (
                      <button
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 text-sm rounded-lg font-medium transition
                          ${p === safePage
                            ? 'bg-blue-700 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                          }`}
                      >
                        {p}
                      </button>
                    )}
                    {showEllipsisBefore && <span className="px-1 text-gray-400 text-xs">…</span>}
                  </span>
                )
              })}
            </div>

            {/* Next */}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed hover:text-blue-700 transition"
            >
              Next →
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, totalCount)} of {totalCount} bills
          </p>
        </div>
      )}

      {/* Spacer when no pagination bar */}
      {totalPages <= 1 && <div className="pb-28" />}

      {/* FAB — doctors only */}
      {isDoctor && (
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-blue-700 hover:bg-blue-800 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl font-light active:scale-90 transition-transform z-40"
          title="Create new bill"
        >
          +
        </button>
      )}

      {showCreate && (
        <CreateBillModal apiClient={apiClient} isDoctor={isDoctor} onClose={() => setShowCreate(false)} onCreated={handleBillCreated} />
      )}

      {editBill && (
        <CreateBillModal apiClient={apiClient} isDoctor={isDoctor} onClose={() => setEditBill(null)} onUpdated={handleBillUpdated} editBill={editBill} />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-4xl mb-3 text-center">🗑️</div>
            <h3 className="text-base font-bold text-gray-800 text-center">Delete Bill?</h3>
            <p className="text-sm text-gray-500 mt-2 text-center">
              Delete the bill for <strong className="text-gray-700">{confirmDelete.patient_name}</strong>?{' '}
              This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleDeleteConfirmed}
                className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-700 active:scale-95 transition">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {collectPartialBill && (
        <CollectPartialModal
          bill={collectPartialBill}
          onClose={() => setCollectPartialBill(null)}
          onConfirm={handleCollectPartialSubmit}
        />
      )}
    </div>
  )
}

/* ── Collect Partial Modal ──────────────────────────────────────────────── */

function CollectPartialModal({ bill, onClose, onConfirm }) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const net = parseFloat(bill.net_bill || 0)
  const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  const validate = (val) => {
    const n = parseFloat(val)
    if (!val || isNaN(n) || n <= 0) return 'Enter an amount greater than ₹0'
    if (n >= net) return `Amount must be less than net payable of ${fmt(net)}`
    return ''
  }

  const handleConfirm = async () => {
    const err = validate(amount)
    if (err) { setError(err); return }
    setSaving(true)
    setError('')
    try {
      await onConfirm(parseFloat(amount))
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-3xl mb-1 text-center">💰</div>
        <h3 className="text-base font-bold text-gray-800 text-center">Collect Partial Payment</h3>
        <p className="text-sm text-gray-500 mt-1 text-center">{bill.patient_name}</p>

        {/* Net payable pill */}
        <div className="mt-4 flex justify-center">
          <span className="text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1">
            Net Payable: {fmt(net)}
          </span>
        </div>

        {/* Amount input */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Amount to collect from patient (must be less than {fmt(net)})
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₹</span>
            <input
              type="number"
              min="1"
              max={net - 1}
              step="1"
              autoFocus
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              placeholder="e.g. 250"
              className="w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        </div>

        {/* Preview */}
        {amount && !validate(amount) && (
          <div className="mt-3 bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700 border border-indigo-100">
            📋 A collect request for <span className="font-semibold">{fmt(amount)}</span> will be created.
            Reception will see a <span className="font-semibold">Collect</span> button on this bill.
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !amount || !!validate(amount)}
            className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition disabled:opacity-50"
          >
            {saving ? '⏳ Saving…' : `Set Collect ${amount ? fmt(amount) : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
