import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { createApiClient } from '../api'
import Header from '../components/Header'
import BillCard from '../components/BillCard'
import CreateBillModal from '../components/CreateBillModal'

export default function Bills({ onTabChange }) {
  const { user, logout } = useAuth()
  const apiClient = useMemo(() => createApiClient(user.token), [user.token])

  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editBill, setEditBill] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL') // 'ALL' | 'IPD' | 'OPD'
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchBills = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/bills/')
      setBills(res.data)
    } catch (err) {
      if (err.response?.status === 401) logout()
    } finally {
      setLoading(false)
    }
  }, [apiClient, logout])

  useEffect(() => { fetchBills() }, [fetchBills])

  const filtered = bills.filter((b) => {
    if (typeFilter !== 'ALL' && b.bill_type !== typeFilter) return false
    const q = search.toLowerCase()
    return (
      b.patient_name.toLowerCase().includes(q) ||
      (b.ipd_no || '').toLowerCase().includes(q) ||
      (b.opd_no || '').toLowerCase().includes(q)
    )
  })

  const ipdCount = bills.filter((b) => b.bill_type === 'IPD').length
  const opdCount = bills.filter((b) => b.bill_type === 'OPD').length

  const handleBillCreated = (newBill) => {
    setBills((prev) => [newBill, ...prev])
    showToast(`✓ ${newBill.bill_type} bill saved for ${newBill.patient_name} · Net ₹${parseFloat(newBill.net_bill).toLocaleString('en-IN')}`)
  }

  const handleBillUpdated = (updatedBill) => {
    setBills((prev) => prev.map((b) => (b.id === updatedBill.id ? updatedBill : b)))
    showToast(`✓ Bill updated for ${updatedBill.patient_name}`)
  }

  const handleDeleteConfirmed = async () => {
    const bill = confirmDelete
    setConfirmDelete(null)
    try {
      await apiClient.delete(`/bills/${bill.id}/`)
      setBills((prev) => prev.filter((b) => b.id !== bill.id))
      showToast(`✓ Bill deleted for ${bill.patient_name}`)
    } catch {
      showToast('⚠ Failed to delete bill. Please try again.', 'error')
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

    const patientSection = isOPD
      ? `<div>Patient Name: <b>${bill.patient_name || '—'}</b></div>
         <div>OPD No: <b>${bill.opd_no || '—'}</b></div>
         <div>Address: <b>${bill.address || '—'}</b></div>
         <div>Visit Date: <b>${fDate(bill.visit_date)}</b></div>`
      : `<div>Patient Name: <b>${bill.patient_name || '—'}</b></div>
         <div>IPD No: <b>${bill.ipd_no || '—'}</b></div>
         <div>Address: <b>${bill.address || '—'}</b></div>
         <div>Ward: <b>${bill.ward || '—'}</b></div>
         <div>Room No: <b>${bill.room_no || '—'}</b></div>
         <div>Total Stay: <b>${bill.total_stay || 0} day(s)</b></div>
         <div>Admitted: <b>${fDate(bill.admitted_on)}</b></div>
         <div>Discharged: <b>${fDate(bill.discharged_on)}</b></div>`

    const discountRow = parseFloat(bill.discount) > 0
      ? `<tr><td>Discount${bill.discount_note ? ` (${bill.discount_note})` : ''}</td><td style="text-align:right">– ${fAmt(bill.discount)}</td></tr>`
      : ''

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
      <div class="hdr"><h1>Shree Bal Rugnalaya</h1><p>Ambad, Jalna</p>
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
        <div className={`fixed top-[68px] left-4 right-4 z-50 text-white text-sm font-medium rounded-xl px-4 py-3 shadow-lg ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-white border-b sticky top-[60px] z-30">
        <div className="max-w-2xl mx-auto flex">
          <button className="px-6 py-3 text-sm font-semibold text-blue-700 border-b-2 border-blue-700">
            📋 Bills
            {bills.length > 0 && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-600 rounded-full px-2 py-0.5">
                {bills.length}
              </span>
            )}
          </button>
          <button
            onClick={() => onTabChange('charges')}
            className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
          >
            ⚙️ Charges
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-4 space-y-2">
        <input
          type="search" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Search patient name, IPD / OPD no…"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {/* Type filter pills */}
        <div className="flex gap-2">
          {[
            { key: 'ALL',  label: `All (${bills.length})` },
            { key: 'IPD',  label: `🏥 IPD (${ipdCount})` },
            { key: 'OPD',  label: `🩺 OPD (${opdCount})` },
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
      <main className="max-w-2xl mx-auto w-full px-4 py-4 pb-28 space-y-3">
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-3xl mb-3 animate-spin">⏳</div>
            <p className="text-sm">Loading bills…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-medium">
              {search || typeFilter !== 'ALL' ? 'No matching bills' : 'No bills yet'}
            </p>
            <p className="text-sm mt-1">
              {search || typeFilter !== 'ALL' ? 'Try adjusting your search or filter' : 'Tap + to create the first bill'}
            </p>
          </div>
        ) : (
          filtered.map((bill) => (
            <BillCard
              key={bill.id} bill={bill}
              onPrint={handlePrint}
              onEdit={(b) => setEditBill(b)}
              onDelete={(b) => setConfirmDelete(b)}
            />
          ))
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-blue-700 hover:bg-blue-800 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl font-light active:scale-90 transition-transform z-40"
        title="Create new bill"
      >
        +
      </button>

      {showCreate && (
        <CreateBillModal apiClient={apiClient} onClose={() => setShowCreate(false)} onCreated={handleBillCreated} />
      )}

      {editBill && (
        <CreateBillModal apiClient={apiClient} onClose={() => setEditBill(null)} onUpdated={handleBillUpdated} editBill={editBill} />
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
    </div>
  )
}
