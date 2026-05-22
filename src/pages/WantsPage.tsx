import { useState } from 'react'
import { Plus, X, Star, Heart, Plane } from 'lucide-react'
import { useWants } from '../hooks/useWants'
import { useAccounts } from '../hooks/useAccounts'
import { formatCurrency, formatDate, toDate } from '../lib/utils'
import { Want } from '../types'
import { Timestamp } from 'firebase/firestore'

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
  const { accounts, buckets, addBucket, updateBucket } = useAccounts()
  const [filterCat, setFilterCat] = useState<FilterCat>('all')
  const [filterState, setFilterState] = useState<FilterState>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Want | null>(null)

  const filtered = wants.filter(w =>
    (filterCat === 'all' || w.category === filterCat) &&
    (filterState === 'all' || w.state === filterState)
  )

  const totalSaved = wants.reduce((s, w) => {
    const bucket = buckets.find(b => b.id === w.bucketId)
    return s + (bucket?.allocatedAmount ?? 0)
  }, 0)
  const totalTarget = wants.reduce((s, w) => s + w.targetAmount, 0)

  const getBucketForWant = (w: Want) => buckets.find(b => b.id === w.bucketId)
  const getSavedAmount = (w: Want) => getBucketForWant(w)?.allocatedAmount ?? 0

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

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500">
          {wants.length === 0 ? 'No goals yet. Add your first saving goal!' : 'No goals match your filters.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(want => {
            const saved = getSavedAmount(want)
            const pct = want.targetAmount > 0 ? Math.min(100, (saved / want.targetAmount) * 100) : 0
            const meta = CAT_META[want.category]
            const bucket = getBucketForWant(want)
            const ready = want.state === 'readyToBuy' || saved >= want.targetAmount
            const daysLeft = want.targetDate ? Math.ceil((toDate(want.targetDate).getTime() - Date.now()) / 86400000) : null

            return (
              <button key={want.id} onClick={() => setSelected(want)} className="w-full text-left bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-5 transition-all space-y-3">
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
              </button>
            )
          })}
        </div>
      )}

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
    </div>
  )
}

function AddWantModal({ accounts, onClose, onSave }: { accounts: any[]; onClose: () => void; onSave: (data: Omit<Want, 'id' | 'createdAt'>, accountId?: string) => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<WantCategory>('dream')
  const [targetAmount, setTargetAmount] = useState('')
  const [hasDate, setHasDate] = useState(false)
  const [targetDate, setTargetDate] = useState('')
  const [notes, setNotes] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')

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

function EditWantModal({ want, bucket, account, onClose, onUpdateState, onAddToSavings, onDelete }: {
  want: Want; bucket?: any; account?: any
  onClose: () => void; onUpdateState: (s: WantState) => void
  onAddToSavings: (amount: number) => void; onDelete: () => void
}) {
  const [addAmount, setAddAmount] = useState('')
  const saved = bucket?.allocatedAmount ?? 0
  const pct = want.targetAmount > 0 ? Math.min(100, (saved / want.targetAmount) * 100) : 0
  const meta = CAT_META[want.category]

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
          {/* Progress */}
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

          {/* Add to savings */}
          {bucket && account && (
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-2">
                Add to savings ({account.name} · {formatCurrency(account.balance - (bucket?.allocatedAmount ?? 0))} unallocated)
              </label>
              <div className="flex gap-2">
                <input value={addAmount} onChange={e => setAddAmount(e.target.value)} type="number" placeholder="Amount to allocate"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
                <button onClick={() => { if (addAmount) { onAddToSavings(Number(addAmount)); setAddAmount('') } }}
                  disabled={!addAmount}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-semibold px-4 rounded-xl transition-colors">
                  Add
                </button>
              </div>
            </div>
          )}

          {/* State toggle */}
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
