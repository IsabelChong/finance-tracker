import { useState } from 'react'
import { Plus, X, Star, Heart, Plane, Trophy, Trash2 } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useWants } from '../hooks/useWants'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { formatCurrency, formatDate, toDate } from '../lib/utils'
import { Want, Category, Account, AccountBucket } from '../types'

type WantCategory = 'needs' | 'dream' | 'vacation'
type WantState = 'saving' | 'readyToBuy'
type FilterCat = 'all' | WantCategory
type FilterState = 'all' | WantState

const CAT_META: Record<WantCategory, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  needs:    { label: 'Needs',    icon: <Heart size={14} />,  color: 'text-red-400',    bg: 'bg-red-400/10'    },
  dream:    { label: 'Dream',    icon: <Star size={14} />,   color: 'text-purple-400', bg: 'bg-purple-400/10' },
  vacation: { label: 'Vacation', icon: <Plane size={14} />,  color: 'text-teal-400',   bg: 'bg-teal-400/10'   },
}

export default function WantsPage() {
  const { wants, addWant, updateWant, deleteWant } = useWants()
  const { accounts, buckets, addBucket, updateBucket, deleteBucket, addTransaction, deleteTransaction } = useAccounts()
  const { expenseCategories } = useCategories()

  const [filterCat, setFilterCat]     = useState<FilterCat>('all')
  const [filterState, setFilterState] = useState<FilterState>('all')
  const [showAdd, setShowAdd]         = useState(false)
  const [selected, setSelected]       = useState<Want | null>(null)
  const [purchasing, setPurchasing]   = useState<Want | null>(null)
  const [readdingWant, setReaddingWant] = useState<Want | null>(null)

  const activeWants    = wants.filter(w => w.state !== 'purchased')
  const completedWants = wants.filter(w => w.state === 'purchased')

  const filtered = activeWants.filter(w =>
    (filterCat === 'all' || w.category === filterCat) &&
    (filterState === 'all' || w.state === filterState)
  )

  const totalSaved   = activeWants.reduce((s, w) => s + (buckets.find(b => b.id === w.bucketId)?.allocatedAmount ?? 0), 0)
  const totalTarget  = activeWants.reduce((s, w) => s + w.targetAmount, 0)

  const getBucketForWant = (w: Want) => buckets.find(b => b.id === w.bucketId)
  const getSavedAmount   = (w: Want) => getBucketForWant(w)?.allocatedAmount ?? 0

  const handlePurchase = async (want: Want, actualAmount: number, accountId: string, category: Category, date: Date, notes: string) => {
    const acc = accounts.find(a => a.id === accountId)
    const txId = await addTransaction({
      date, amount: actualAmount, type: 'expense',
      categoryName: category.name, categoryIcon: category.icon, categoryColor: category.colorHex,
      accountId, accountName: acc?.name ?? '',
      payee: want.name, notes,
    })
    const bucket = getBucketForWant(want)
    if (bucket) await deleteBucket(bucket.id)
    await updateWant(want.id, {
      state: 'purchased',
      purchasedAmount: actualAmount,
      purchasedAt: Timestamp.fromDate(date),
      purchaseTransactionId: txId,
      purchaseAccountId: accountId,
    } as Partial<Want>)
  }

  const handleDeletePurchased = async (want: Want) => {
    if (!confirm(`Permanently delete "${want.name}" and reverse its purchase transaction?`)) return
    if (want.purchaseTransactionId && want.purchasedAmount != null && want.purchaseAccountId) {
      await deleteTransaction(want.purchaseTransactionId, {
        amount: want.purchasedAmount, type: 'expense', accountId: want.purchaseAccountId,
      })
    }
    await deleteWant(want.id)
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Wants & Goals</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-xs mb-0.5">Saved</p>
          <p className="font-bold text-green-400">{formatCurrency(totalSaved)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-xs mb-0.5">Target</p>
          <p className="font-bold">{formatCurrency(totalTarget)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-xs mb-0.5">Remaining</p>
          <p className="font-bold text-orange-400">{formatCurrency(Math.max(0, totalTarget - totalSaved))}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {(['all', 'needs', 'dream', 'vacation'] as const).map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${filterCat === c ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {c === 'all' ? 'All Categories' : c}
          </button>
        ))}
        <div className="w-px h-6 bg-slate-700 my-auto mx-1 shrink-0" />
        {(['saving', 'readyToBuy'] as const).map(s => (
          <button key={s} onClick={() => setFilterState(filterState === s ? 'all' : s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterState === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {s === 'readyToBuy' ? '✅ Ready' : '💰 Saving'}
          </button>
        ))}
      </div>

      {/* Active want cards */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500">
          {activeWants.length === 0 ? 'No goals yet. Add your first saving goal!' : 'No goals match your filters.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(want => {
            const saved   = getSavedAmount(want)
            const pct     = want.targetAmount > 0 ? Math.min(100, (saved / want.targetAmount) * 100) : 0
            const meta    = CAT_META[want.category]
            const bucket  = getBucketForWant(want)
            const ready   = want.state === 'readyToBuy' || saved >= want.targetAmount
            const daysLeft = want.targetDate ? Math.ceil((toDate(want.targetDate).getTime() - Date.now()) / 86400000) : null

            return (
              <div key={want.id} className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl transition-all">
                {/* Card body — opens edit modal */}
                <div onClick={() => setSelected(want)} className="p-5 space-y-3 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.color} ${meta.bg}`}>
                        {meta.icon}{meta.label}
                      </span>
                      {ready && <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">✅ Ready!</span>}
                    </div>
                    {daysLeft !== null && daysLeft > 0 && (
                      <span className="text-xs text-slate-500">{daysLeft}d left</span>
                    )}
                  </div>
                  <p className="font-semibold text-base">{want.name}</p>
                  <div className="space-y-1.5">
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: ready ? '#22c55e' : (meta.color.includes('red') ? '#ef4444' : meta.color.includes('purple') ? '#a855f7' : '#14b8a6') }} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={`font-semibold ${meta.color}`}>{formatCurrency(saved)}</span>
                      <span className="text-slate-400">of {formatCurrency(want.targetAmount)}</span>
                      <span className={`font-bold ${ready ? 'text-green-400' : ''}`}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  {bucket?.accountId && (
                    <p className="text-xs text-slate-500">
                      Saved in: {accounts.find(a => a.id === bucket.accountId)?.name ?? 'Unknown account'}
                    </p>
                  )}
                  {want.targetDate && (
                    <p className="text-xs text-slate-500">🎯 Target: {formatDate(want.targetDate)}</p>
                  )}
                </div>

                {/* Mark as purchased button */}
                <div className="px-5 pb-4 border-t border-slate-800 pt-3 flex justify-end">
                  <button
                    onClick={() => setPurchasing(want)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20 px-3 py-1.5 rounded-lg transition-colors">
                    <Trophy size={13} /> Mark as purchased
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Completed / Archived */}
      {completedWants.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Completed ({completedWants.length})
          </h2>
          {completedWants.map(want => {
            const meta = CAT_META[want.category]
            const diff = want.purchasedAmount != null ? want.purchasedAmount - want.targetAmount : null
            return (
              <div key={want.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Trophy size={16} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm">{want.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${meta.color} ${meta.bg}`}>{meta.label}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Spent <span className="font-semibold text-white">{formatCurrency(want.purchasedAmount ?? 0)}</span>
                    <span className="text-slate-600"> · Goal was {formatCurrency(want.targetAmount)}</span>
                    {diff !== null && diff !== 0 && (
                      <span className={diff < 0 ? 'text-green-400' : 'text-orange-400'}>
                        {' '}({diff < 0 ? `saved ${formatCurrency(-diff)}` : `over by ${formatCurrency(diff)}`})
                      </span>
                    )}
                  </p>
                  {want.purchasedAt && (
                    <p className="text-xs text-slate-500 mt-0.5">Purchased on {formatDate(want.purchasedAt)}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button onClick={() => setReaddingWant(want)}
                    className="text-xs text-slate-500 hover:text-blue-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800 whitespace-nowrap">
                    + Re-add transaction
                  </button>
                  <button onClick={() => handleDeletePurchased(want)}
                    className="text-slate-600 hover:text-red-400 p-1 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddWantModal
          accounts={accounts.filter(a => a.type !== 'credit')}
          onClose={() => setShowAdd(false)}
          onSave={async (wantData, accountId) => {
            const ref = await addWant(wantData)
            if (ref && accountId) {
              const bucketRef = await addBucket({ name: wantData.name, allocatedAmount: 0, accountId, isEmergencyFund: false })
              if (bucketRef) await updateWant(ref.id, { bucketId: bucketRef.id })
            }
            setShowAdd(false)
          }}
        />
      )}
      {selected && (
        <EditWantModal
          want={selected}
          bucket={getBucketForWant(selected)}
          account={accounts.find(a => a.id === getBucketForWant(selected)?.accountId)}
          onClose={() => setSelected(null)}
          onUpdateState={(state) => updateWant(selected.id, { state })}
          onAddToSavings={async (amount) => {
            const bucket = getBucketForWant(selected)
            if (bucket) await updateBucket(bucket.id, { allocatedAmount: bucket.allocatedAmount + amount })
          }}
          onDelete={async () => { await deleteWant(selected.id); setSelected(null) }}
        />
      )}
      {purchasing && (
        <PurchaseModal
          want={purchasing}
          bucket={getBucketForWant(purchasing)}
          accounts={accounts.filter(a => a.type !== 'credit')}
          expenseCategories={expenseCategories}
          onClose={() => setPurchasing(null)}
          onConfirm={async (actualAmount, accountId, category, date, notes) => {
            await handlePurchase(purchasing, actualAmount, accountId, category, date, notes)
            setPurchasing(null)
          }}
        />
      )}
      {readdingWant && (
        <ReaddTransactionModal
          want={readdingWant}
          accounts={accounts.filter(a => a.type !== 'credit')}
          expenseCategories={expenseCategories}
          onClose={() => setReaddingWant(null)}
          onConfirm={async (amount, accountId, category, date, notes) => {
            const acc = accounts.find(a => a.id === accountId)
            const txId = await addTransaction({
              date, amount, type: 'expense',
              categoryName: category.name, categoryIcon: category.icon, categoryColor: category.colorHex,
              accountId, accountName: acc?.name ?? '',
              payee: readdingWant.name, notes,
            })
            await updateWant(readdingWant.id, {
              purchaseTransactionId: txId,
              purchasedAmount: amount,
              purchasedAt: Timestamp.fromDate(date),
              purchaseAccountId: accountId,
            } as Partial<Want>)
            setReaddingWant(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Purchase Modal ───────────────────────────────────────────────────────────

function PurchaseModal({ want, bucket, accounts, expenseCategories, onClose, onConfirm }: {
  want: Want; bucket?: AccountBucket; accounts: Account[]
  expenseCategories: Category[]
  onClose: () => void
  onConfirm: (actualAmount: number, accountId: string, category: Category, date: Date, notes: string) => Promise<void>
}) {
  const defaultAccountId = bucket?.accountId ?? accounts[0]?.id ?? ''
  const [actualAmount, setActualAmount] = useState(String(want.targetAmount))
  const [accountId, setAccountId]       = useState(defaultAccountId)
  const [selectedCat, setSelectedCat]   = useState<Category | null>(null)
  const [date, setDate]                 = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const canConfirm = actualAmount && Number(actualAmount) > 0 && accountId && selectedCat

  const handleConfirm = async () => {
    if (!canConfirm || !selectedCat) return
    setSaving(true)
    setError(null)
    try {
      await onConfirm(Number(actualAmount), accountId, selectedCat, new Date(date), notes)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <div>
            <h2 className="text-lg font-bold">Mark as Purchased</h2>
            <p className="text-xs text-slate-400">{want.name} · goal: {formatCurrency(want.targetAmount)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Actual amount */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Actual amount spent (SGD)</label>
            <input
              type="number" value={actualAmount} onChange={e => setActualAmount(e.target.value)}
              onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
              placeholder="0.00" min="0" step="0.01"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            />
            {bucket && (
              <p className="text-xs text-slate-500 mt-1">Bucket had {formatCurrency(bucket.allocatedAmount)} allocated — remainder stays in account</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Purchase date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
          </div>

          {/* Account */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Deduct from account</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500">
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>)}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">Expense category</label>
            <div className="grid grid-cols-3 gap-2">
              {expenseCategories.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCat(cat)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-sm transition-all ${
                    selectedCat?.id === cat.id ? 'ring-2 ring-blue-500 bg-slate-800' : 'bg-slate-800 hover:bg-slate-700'
                  }`}>
                  <span className="text-base leading-none">{cat.icon}</span>
                  <span className="text-xs text-slate-300 leading-tight truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Where did you buy it?"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button onClick={handleConfirm} disabled={!canConfirm || saving}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
            <Trophy size={16} /> {saving ? 'Saving…' : 'Confirm Purchase'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Re-add Transaction Modal ────────────────────────────────────────────────

function ReaddTransactionModal({ want, accounts, expenseCategories, onClose, onConfirm }: {
  want: Want; accounts: Account[]
  expenseCategories: Category[]
  onClose: () => void
  onConfirm: (amount: number, accountId: string, category: Category, date: Date, notes: string) => Promise<void>
}) {
  const defaultAccountId = want.purchaseAccountId ?? accounts[0]?.id ?? ''
  const purchasedDate = want.purchasedAt ? toDate(want.purchasedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  const [amount, setAmount]           = useState(String(want.purchasedAmount ?? ''))
  const [accountId, setAccountId]     = useState(defaultAccountId)
  const [selectedCat, setSelectedCat] = useState<Category | null>(null)
  const [date, setDate]               = useState(purchasedDate)
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const canConfirm = amount && Number(amount) > 0 && accountId && selectedCat

  const handleConfirm = async () => {
    if (!canConfirm || !selectedCat) return
    setSaving(true)
    setError(null)
    try {
      await onConfirm(Number(amount), accountId, selectedCat, new Date(date), notes)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <div>
            <h2 className="text-lg font-bold">Re-add Transaction</h2>
            <p className="text-xs text-slate-400">{want.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Amount (SGD)</label>
            <input
              type="number" value={amount} onChange={e => setAmount(e.target.value)}
              onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
              placeholder="0.00" min="0" step="0.01"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Purchase date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Deduct from account</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500">
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">Expense category</label>
            <div className="grid grid-cols-3 gap-2">
              {expenseCategories.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCat(cat)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-sm transition-all ${
                    selectedCat?.id === cat.id ? 'ring-2 ring-blue-500 bg-slate-800' : 'bg-slate-800 hover:bg-slate-700'
                  }`}>
                  <span className="text-base leading-none">{cat.icon}</span>
                  <span className="text-xs text-slate-300 leading-tight truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button onClick={handleConfirm} disabled={!canConfirm || saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? 'Saving…' : 'Re-add Transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Want Modal ───────────────────────────────────────────────────────────

function AddWantModal({ accounts, onClose, onSave }: { accounts: any[]; onClose: () => void; onSave: (data: Omit<Want, 'id' | 'createdAt'>, accountId?: string) => void }) {
  const [name, setName]               = useState('')
  const [category, setCategory]       = useState<WantCategory>('dream')
  const [targetAmount, setTargetAmount] = useState('')
  const [hasDate, setHasDate]         = useState(false)
  const [targetDate, setTargetDate]   = useState('')
  const [notes, setNotes]             = useState('')
  const [accountId, setAccountId]     = useState(accounts[0]?.id ?? '')

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <h2 className="text-lg font-bold">Add Goal</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">What do you want?</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Japan trip, new AirPods..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(CAT_META) as [WantCategory, typeof CAT_META[WantCategory]][]).map(([key, meta]) => (
                <button key={key} onClick={() => setCategory(key)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${category === key ? `ring-2 ring-offset-2 ring-offset-slate-900 ${meta.bg}` : 'bg-slate-800'} ${meta.color}`}>
                  {meta.icon}
                  <span className="text-xs font-medium">{meta.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Target amount (SGD)</label>
            <input value={targetAmount} onChange={e => setTargetAmount(e.target.value)} type="number" placeholder="0.00"
              onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setHasDate(!hasDate)}
              className={`w-10 h-6 rounded-full transition-colors ${hasDate ? 'bg-blue-600' : 'bg-slate-700'} relative`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${hasDate ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-slate-300">Set a target date</span>
          </label>
          {hasDate && (
            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
          )}
          {accounts.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Save in account (creates a bucket)</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
                <option value="">No account (manual tracking)</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          <button
            onClick={() => onSave({ name, category, state: 'saving', targetAmount: Number(targetAmount), targetDate: hasDate && targetDate ? Timestamp.fromDate(new Date(targetDate)) : undefined, notes }, accountId || undefined)}
            disabled={!name || !targetAmount}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors">
            Add Goal
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Want Modal ──────────────────────────────────────────────────────────

function EditWantModal({ want, bucket, account, onClose, onUpdateState, onAddToSavings, onDelete }: {
  want: Want; bucket?: any; account?: any
  onClose: () => void; onUpdateState: (s: WantState) => void
  onAddToSavings: (amount: number) => void; onDelete: () => void
}) {
  const [addAmount, setAddAmount] = useState('')
  const saved = bucket?.allocatedAmount ?? 0
  const pct   = want.targetAmount > 0 ? Math.min(100, (saved / want.targetAmount) * 100) : 0
  const meta  = CAT_META[want.category]

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <div>
            <h2 className="text-lg font-bold">{want.name}</h2>
            <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? '#22c55e' : (meta.color.includes('red') ? '#ef4444' : meta.color.includes('purple') ? '#a855f7' : '#14b8a6') }} />
            </div>
            <div className="flex justify-between text-sm">
              <span className={`font-bold text-lg ${meta.color}`}>{formatCurrency(saved)}</span>
              <div className="text-right">
                <p className="text-slate-400">of {formatCurrency(want.targetAmount)}</p>
                <p className="font-bold text-lg">{pct.toFixed(0)}%</p>
              </div>
            </div>
            {want.targetDate && <p className="text-xs text-slate-500">🎯 Target date: {formatDate(want.targetDate)}</p>}
          </div>

          {bucket && account && (
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-2">
                Add to savings ({account.name} · {formatCurrency(account.balance - (bucket?.allocatedAmount ?? 0))} unallocated)
              </label>
              <div className="flex gap-2">
                <input value={addAmount} onChange={e => setAddAmount(e.target.value)} type="number" placeholder="Amount to allocate"
                  onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
                <button onClick={() => { if (addAmount) { onAddToSavings(Number(addAmount)); setAddAmount('') } }}
                  disabled={!addAmount}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-semibold px-4 rounded-xl transition-colors">
                  Add
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">Status</label>
            <div className="flex gap-2">
              {(['saving', 'readyToBuy'] as WantState[]).map(s => (
                <button key={s} onClick={() => onUpdateState(s)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${want.state === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                  {s === 'saving' ? '💰 Saving' : '✅ Ready to Buy'}
                </button>
              ))}
            </div>
          </div>

          {want.notes && <p className="text-sm text-slate-400 italic">"{want.notes}"</p>}

          <button onClick={() => { if (confirm(`Delete "${want.name}"?`)) onDelete() }}
            className="w-full text-red-400 text-sm py-2 hover:bg-red-400/10 rounded-xl transition-colors">
            Delete goal
          </button>
        </div>
      </div>
    </div>
  )
}
