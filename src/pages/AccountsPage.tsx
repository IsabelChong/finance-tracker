import { useState } from 'react'
import { Plus, X, ChevronRight, Shield, Star, Pencil, GripVertical, Check } from 'lucide-react'
import { useAccounts } from '../hooks/useAccounts'
import { useWants } from '../hooks/useWants'
import { useTransactions } from '../hooks/useTransactions'
import { formatCurrency, formatDate } from '../lib/utils'
import { useFXRates } from '../contexts/FXRatesContext'
import { Account, AccountBucket } from '../types'
import DatePicker from '../components/DatePicker'

type Modal = null | 'addAccount' | { type: 'accountDetail'; accountId: string } | { type: 'addBucket'; accountId: string } | { type: 'editBucket'; bucket: AccountBucket }

const COLORS = ['#3b82f6','#22c55e','#ef4444','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316']

interface DragState { section: 'bank' | 'broker' | 'credit'; from: number; over: number }

export default function AccountsPage() {
  const { accounts, buckets, addAccount, updateAccount, deleteAccount, reorderAccounts, addBucket, updateBucket, deleteBucket, reorderBuckets, addTransaction, bucketsForAccount, allocatedForAccount } = useAccounts()
  const { wants, updateWant } = useWants()
  const { transactions } = useTransactions()
  const { toSGD } = useFXRates()
  const [modal, setModal] = useState<Modal>(null)
  const [reorderMode, setReorderMode] = useState(false)
  const [dragState, setDragState] = useState<DragState | null>(null)

  const bankAccounts   = accounts.filter(a => a.type === 'savings' || a.type === 'cash')
  const brokerAccounts = accounts.filter(a => a.type === 'investment')
  const creditAccounts = accounts.filter(a => a.type === 'credit')
  const totalSavings = accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + toSGD(a.balance, a.currency), 0)
  const totalDebt    = creditAccounts.reduce((s, a) => s + toSGD(a.balance, a.currency), 0)

  const handleDrop = (section: 'bank' | 'broker' | 'credit', toIdx: number) => {
    if (!dragState || dragState.section !== section || dragState.from === toIdx) { setDragState(null); return }
    const items = section === 'bank' ? [...bankAccounts] : section === 'broker' ? [...brokerAccounts] : [...creditAccounts]
    const [moved] = items.splice(dragState.from, 1)
    items.splice(toIdx, 0, moved)
    reorderAccounts(items.map(a => a.id))
    setDragState(null)
  }

  const dragProps = (section: 'bank' | 'broker' | 'credit', idx: number) => reorderMode ? {
    draggable: true,
    onDragStart: () => setDragState({ section, from: idx, over: idx }),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragState(d => d ? { ...d, over: idx } : null) },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); handleDrop(section, idx) },
    onDragEnd: () => setDragState(null),
  } : {}

  const isDragOver = (section: 'bank' | 'broker' | 'credit', idx: number) =>
    reorderMode && dragState?.section === section && dragState.over === idx && dragState.from !== idx

  const isDragging = (section: 'bank' | 'broker' | 'credit', idx: number) =>
    reorderMode && dragState?.section === section && dragState.from === idx

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Accounts</h1>
        <div className="flex gap-2">
          {accounts.length > 1 && (
            <button
              onClick={() => { setReorderMode(r => !r); setDragState(null) }}
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl transition-colors ${reorderMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
            >
              {reorderMode ? <><Check size={14} /> Done</> : <><GripVertical size={14} /> Reorder</>}
            </button>
          )}
          {!reorderMode && (
            <button onClick={() => setModal('addAccount')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus size={16} /> Add
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Total Savings</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(totalSavings)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Total Debt</p>
          <p className="text-xl font-bold text-red-400">{formatCurrency(totalDebt)}</p>
        </div>
      </div>

      {bankAccounts.length > 0 && (
        <Section title="Bank Accounts">
          {bankAccounts.map((acc, i) => (
            <div
              key={acc.id}
              {...dragProps('bank', i)}
              className={[
                isDragOver('bank', i) ? 'border-t-2 border-blue-500' : '',
                isDragging('bank', i) ? 'opacity-40' : '',
              ].join(' ')}
            >
              <AccountRow
                account={acc}
                allocated={allocatedForAccount(acc.id)}
                onClick={() => !reorderMode && setModal({ type: 'accountDetail', accountId: acc.id })}
                reorderMode={reorderMode}
              />
            </div>
          ))}
        </Section>
      )}

      {brokerAccounts.length > 0 && (
        <Section title="Broker Accounts">
          {brokerAccounts.map((acc, i) => (
            <div
              key={acc.id}
              {...dragProps('broker', i)}
              className={[
                isDragOver('broker', i) ? 'border-t-2 border-blue-500' : '',
                isDragging('broker', i) ? 'opacity-40' : '',
              ].join(' ')}
            >
              <AccountRow
                account={acc}
                allocated={allocatedForAccount(acc.id)}
                onClick={() => !reorderMode && setModal({ type: 'accountDetail', accountId: acc.id })}
                reorderMode={reorderMode}
              />
            </div>
          ))}
        </Section>
      )}

      {creditAccounts.length > 0 && (
        <Section title="Credit Cards">
          {creditAccounts.map((acc, i) => (
            <div
              key={acc.id}
              {...dragProps('credit', i)}
              className={[
                isDragOver('credit', i) ? 'border-t-2 border-blue-500' : '',
                isDragging('credit', i) ? 'opacity-40' : '',
              ].join(' ')}
            >
              <AccountRow
                account={acc}
                allocated={0}
                onClick={() => !reorderMode && setModal({ type: 'accountDetail', accountId: acc.id })}
                reorderMode={reorderMode}
              />
            </div>
          ))}
        </Section>
      )}

      {accounts.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500">
          Add your first account to get started
        </div>
      )}

      {/* Modals */}
      {modal === 'addAccount' && (
        <AddAccountModal onClose={() => setModal(null)} onSave={(data) => { setModal(null); addAccount(data) }} />
      )}
      {modal && typeof modal === 'object' && modal.type === 'accountDetail' && (() => {
        const liveAccount = accounts.find(a => a.id === modal.accountId)
        if (!liveAccount) return null
        return (
          <AccountDetailModal
            account={liveAccount}
            buckets={bucketsForAccount(liveAccount.id)}
            transactions={transactions.filter(t => t.accountId === liveAccount.id || t.toAccountId === liveAccount.id)}
            wants={wants}
            onClose={() => setModal(null)}
            onAddBucket={() => setModal({ type: 'addBucket', accountId: liveAccount.id })}
            onUpdateBucket={updateBucket}
            onDeleteBucket={deleteBucket}
            onReorderBuckets={reorderBuckets}
            onReconcile={(id, bal) => updateAccount(id, { balance: bal })}
            onDelete={(id) => { setModal(null); deleteAccount(id) }}
            onLogSpending={async (amount, date, payee) => {
              await addTransaction({
                date, amount, type: 'expense',
                categoryName: 'Credit Spending', categoryIcon: '💳', categoryColor: '#6366F1',
                accountId: liveAccount.id, accountName: liveAccount.name,
                payee, notes: '',
              })
            }}
          />
        )
      })()}
      {modal && typeof modal === 'object' && modal.type === 'addBucket' && (() => {
        const liveAccount = accounts.find(a => a.id === modal.accountId)
        if (!liveAccount) return null
        return (
          <AddBucketModal
            account={liveAccount}
            wants={wants.filter(w => !w.bucketId)}
            onClose={() => setModal(null)}
            onSave={(data, wantId) => {
              setModal(null)
              if (wantId) addBucket(data).then(ref => ref && updateWant(wantId, { bucketId: ref.id }))
              else addBucket(data)
            }}
          />
        )
      })()}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</h2>
      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">{children}</div>
    </div>
  )
}

function AccountRow({ account, allocated, onClick, reorderMode }: {
  account: Account; allocated: number
  onClick: () => void
  reorderMode?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-4 w-full text-left transition-colors rounded-xl ${reorderMode ? 'cursor-grab active:cursor-grabbing' : 'hover:bg-slate-800/50 cursor-pointer'}`}
    >
      {reorderMode
        ? <GripVertical size={16} className="text-slate-500 shrink-0" />
        : null}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: account.colorHex + '22' }}>
        <span className="text-xl">{account.type === 'credit' ? '💳' : account.type === 'investment' ? '📊' : '🏦'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{account.name}</p>
        <p className="text-xs text-slate-400">{account.institution || account.type}</p>
        {account.type !== 'credit' && allocated > 0 && (
          <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(allocated)} allocated · {formatCurrency(account.balance - allocated)} free</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={`font-bold ${account.type === 'credit' ? 'text-red-400' : ''}`}>{formatCurrency(account.balance, account.currency)}</p>
        {account.type === 'credit' && <p className="text-xs text-red-400">owed</p>}
      </div>
      {!reorderMode && <ChevronRight size={16} className="text-slate-600" />}
    </div>
  )
}

function AccountDetailModal({ account, buckets, transactions, wants, onClose, onAddBucket, onUpdateBucket, onDeleteBucket, onReorderBuckets, onReconcile, onDelete, onLogSpending }: {
  account: Account; buckets: AccountBucket[]; transactions: any[]; wants: any[]
  onClose: () => void; onAddBucket: () => void
  onUpdateBucket: (id: string, d: Partial<AccountBucket>) => void
  onDeleteBucket: (id: string) => void
  onReorderBuckets: (ids: string[]) => void
  onReconcile: (id: string, balance: number) => void
  onDelete: (id: string) => void
  onLogSpending?: (amount: number, date: Date, payee: string) => Promise<void>
}) {
  const [reconcile, setReconcile] = useState('')
  const [showReconcile, setShowReconcile] = useState(false)
  const [showLogSpending, setShowLogSpending] = useState(false)
  const [bucketReorder, setBucketReorder] = useState(false)
  const [bucketDrag, setBucketDrag] = useState<{ from: number; over: number } | null>(null)

  const allocated = buckets.reduce((s, b) => s + b.allocatedAmount, 0)
  const unallocated = account.balance - allocated

  const emergencyBuckets = buckets.filter(b => b.isEmergencyFund)
  const regularBuckets = buckets.filter(b => !b.isEmergencyFund)

  const dropBucket = (toIdx: number) => {
    if (!bucketDrag || bucketDrag.from === toIdx) { setBucketDrag(null); return }
    const items = [...regularBuckets]
    const [moved] = items.splice(bucketDrag.from, 1)
    items.splice(toIdx, 0, moved)
    onReorderBuckets(items.map(b => b.id))
    setBucketDrag(null)
  }

  const bucketDragProps = (idx: number) => bucketReorder ? {
    draggable: true,
    onDragStart: () => setBucketDrag({ from: idx, over: idx }),
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setBucketDrag(d => d ? { ...d, over: idx } : null) },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); dropBucket(idx) },
    onDragEnd: () => setBucketDrag(null),
  } : {}

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-lg rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <div>
            <h2 className="text-lg font-bold">{account.name}</h2>
            <p className="text-xs text-slate-400">{account.institution || account.type}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Balance */}
          <div className="text-center">
            <p className="text-xs text-slate-400 mb-1">{account.type === 'credit' ? 'Balance Owed' : 'Balance'}</p>
            <p className={`text-4xl font-bold ${account.type === 'credit' ? 'text-red-400' : ''}`}>{formatCurrency(account.balance, account.currency)}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {!showReconcile && (
                <button onClick={() => setShowReconcile(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-blue-400 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                  <Pencil size={11} /> Reconcile
                </button>
              )}
              {account.type === 'credit' && !showReconcile && (
                <button onClick={() => setShowLogSpending(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors">
                  💳 Log spending
                </button>
              )}
            </div>
            {showReconcile && (
              <div className="flex gap-2 mt-3 justify-center">
                <input value={reconcile} onChange={e => setReconcile(e.target.value)} placeholder={String(account.balance)} type="number"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm w-36 text-center outline-none focus:border-blue-500" />
                <button onClick={() => { if (reconcile) { onReconcile(account.id, Number(reconcile)); setShowReconcile(false) } }}
                  className="bg-blue-600 text-white text-sm px-3 rounded-lg">Save</button>
                <button onClick={() => setShowReconcile(false)} className="text-slate-400 text-sm px-2">✕</button>
              </div>
            )}
          </div>

          {/* Buckets */}
          {account.type !== 'credit' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">Buckets</h3>
                <div className="flex items-center gap-2">
                  {regularBuckets.length > 1 && (
                    <button
                      onClick={() => { setBucketReorder(r => !r); setBucketDrag(null) }}
                      className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${bucketReorder ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:text-white'}`}
                    >
                      {bucketReorder ? <><Check size={11} /> Done</> : <><GripVertical size={11} /> Reorder</>}
                    </button>
                  )}
                  {!bucketReorder && (
                    <button onClick={onAddBucket} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={12} /> Add bucket</button>
                  )}
                </div>
              </div>
              {buckets.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No buckets — add one to allocate savings</p>
              ) : (
                <div className="space-y-2">
                  {/* Emergency fund — always first, pinned */}
                  {emergencyBuckets.map(b => (
                    <BucketItem key={b.id} bucket={b} wants={wants} pinned onUpdate={onUpdateBucket} onDelete={onDeleteBucket} />
                  ))}

                  {/* Regular buckets — reorderable */}
                  {regularBuckets.map((b, i) => (
                    <div
                      key={b.id}
                      {...bucketDragProps(i)}
                      className={[
                        bucketReorder && bucketDrag?.over === i && bucketDrag.from !== i ? 'border-t-2 border-blue-500 rounded-xl' : '',
                        bucketReorder && bucketDrag?.from === i ? 'opacity-40' : '',
                      ].join(' ')}
                    >
                      <BucketItem
                        bucket={b} wants={wants} reorderMode={bucketReorder}
                        onUpdate={onUpdateBucket} onDelete={onDeleteBucket}
                      />
                    </div>
                  ))}

                  <div className="flex justify-between text-sm px-1 pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Unallocated</span>
                    <span className={`font-semibold ${unallocated < 0 ? 'text-red-400' : 'text-green-400'}`}>{formatCurrency(unallocated)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent transactions */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Recent Transactions</h3>
            {transactions.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No transactions</p>
            ) : (
              <div className="space-y-1">
                {transactions.slice(0, 10).map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 py-2">
                    <span className="text-base">{tx.categoryIcon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{tx.payee || tx.categoryName}</p>
                      <p className="text-xs text-slate-500">{formatDate(tx.date, { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <span className={`text-xs font-semibold ${tx.type === 'income' ? 'text-green-400' : ''}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => { if (confirm(`Delete ${account.name}?`)) onDelete(account.id) }}
            className="w-full text-red-400 text-sm py-2 hover:bg-red-400/10 rounded-xl transition-colors">
            Delete account
          </button>
        </div>
      </div>

      {showLogSpending && onLogSpending && (
        <CreditSpendingModal
          account={account}
          onClose={() => setShowLogSpending(false)}
          onSave={async (amount, date, payee) => {
            await onLogSpending(amount, date, payee)
            setShowLogSpending(false)
          }}
        />
      )}
    </div>
  )
}

function CreditSpendingModal({ account, onClose, onSave }: {
  account: Account
  onClose: () => void
  onSave: (amount: number, date: Date, payee: string) => Promise<void>
}) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [payee, setPayee] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    await onSave(Number(amount), new Date(date), payee)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-sm rounded-t-2xl lg:rounded-2xl border border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold">Log Credit Spending</h2>
            <p className="text-xs text-slate-400 mt-0.5">{account.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 bg-slate-800 rounded-xl px-3 py-2.5">
            Use this to log a lump-sum of credit card spending — e.g. your monthly statement total. It increases your balance owed.
          </p>

          <div className="bg-slate-800 rounded-xl p-4">
            <label className="text-xs text-slate-400 font-medium block mb-1">Amount (SGD)</label>
            <input
              type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
              onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
              autoFocus
              className="w-full bg-transparent text-3xl font-bold text-white outline-none placeholder-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Date</label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Description (optional)</label>
              <input value={payee} onChange={e => setPayee(e.target.value)} placeholder="e.g. March bill"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!amount || Number(amount) <= 0 || saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : 'Log Spending'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BucketItem({ bucket, wants, pinned, reorderMode, onUpdate, onDelete }: {
  bucket: AccountBucket; wants: any[]
  pinned?: boolean
  reorderMode?: boolean
  onUpdate: (id: string, d: Partial<AccountBucket>) => void
  onDelete: (id: string) => void
}) {
  const want = wants.find(w => w.bucketId === bucket.id || w.id === bucket.wantId)
  const pct = want ? Math.min(100, (bucket.allocatedAmount / want.targetAmount) * 100) : 0
  return (
    <div className="bg-slate-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {reorderMode && <GripVertical size={14} className="text-slate-500 cursor-grab" />}
          {pinned && <Shield size={12} className="text-orange-400" />}
          {!reorderMode && bucket.isEmergencyFund && <Shield size={12} className="text-orange-400" />}
          {want && <Star size={12} className="text-purple-400" />}
          <span className="text-sm font-medium">{bucket.name}</span>
          {pinned && <span className="text-xs text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded font-medium">Priority</span>}
        </div>
        <div className="flex items-center gap-3">
          <BucketAmountEditor bucket={bucket} onUpdate={onUpdate} />
          {!reorderMode && <button onClick={() => onDelete(bucket.id)} className="text-slate-600 hover:text-red-400"><X size={14} /></button>}
        </div>
      </div>
      {want && (
        <div className="mt-1.5">
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{pct.toFixed(0)}% of {formatCurrency(want.targetAmount)} goal</p>
        </div>
      )}
    </div>
  )
}

function BucketAmountEditor({ bucket, onUpdate }: { bucket: AccountBucket; onUpdate: (id: string, d: Partial<AccountBucket>) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  if (editing) {
    return (
      <div className="flex gap-1">
        <input value={val} onChange={e => setVal(e.target.value)} type="number" placeholder={String(bucket.allocatedAmount)}
          className="bg-slate-700 rounded px-2 py-0.5 text-xs w-24 outline-none" autoFocus />
        <button onClick={() => { if (val) onUpdate(bucket.id, { allocatedAmount: Number(val) }); setEditing(false) }}
          className="text-blue-400 text-xs">✓</button>
      </div>
    )
  }
  return (
    <button onClick={() => { setVal(String(bucket.allocatedAmount)); setEditing(true) }}
      className="text-sm font-semibold hover:text-blue-400 transition-colors">{formatCurrency(bucket.allocatedAmount)}</button>
  )
}

const ACCOUNT_CURRENCIES = ['SGD', 'MYR', 'JPY', 'USD', 'HKD', 'GBP', 'EUR']

function AddAccountModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'savings' | 'cash' | 'investment' | 'credit'>('savings')
  const [institution, setInstitution] = useState('')
  const [balance, setBalance] = useState('')
  const [currency, setCurrency] = useState('SGD')
  const [colorHex, setColorHex] = useState('#3b82f6')

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-bold">Add Account</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. OCBC 360"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Institution</label>
            <input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="e.g. OCBC"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {([['savings', '🏦 Savings'], ['cash', '💵 Cash'], ['investment', '📊 Broker'], ['credit', '💳 Credit']] as const).map(([t, label]) => (
                <button key={t} onClick={() => setType(t)}
                  className={`py-2 rounded-xl text-sm font-medium transition-colors ${type === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Currency</label>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_CURRENCIES.map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${currency === c ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">
              {type === 'credit' ? `Current balance owed (${currency})` : type === 'investment' ? `Idle cash balance (${currency})` : `Opening balance (${currency})`}
            </label>
            <input value={balance} onChange={e => setBalance(e.target.value)} type="number" placeholder="0.00"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">Colour</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColorHex(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${colorHex === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <button onClick={() => onSave({ name, type, institution, balance: Number(balance) || 0, currency, colorHex })}
            disabled={!name}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors">
            Add Account
          </button>
        </div>
      </div>
    </div>
  )
}

function AddBucketModal({ account, wants, onClose, onSave }: { account: Account; wants: any[]; onClose: () => void; onSave: (data: any, wantId?: string) => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [isEmergency, setIsEmergency] = useState(false)
  const [linkedWantId, setLinkedWantId] = useState('')

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-bold">Add Bucket to {account.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Bucket name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Japan Trip"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Initial amount (SGD)</label>
            <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="0.00"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setIsEmergency(!isEmergency)}
              className={`w-10 h-6 rounded-full transition-colors ${isEmergency ? 'bg-orange-500' : 'bg-slate-700'} relative`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${isEmergency ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-slate-300">Emergency fund</span>
          </label>
          {wants.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Link to a want (optional)</label>
              <select value={linkedWantId} onChange={e => setLinkedWantId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500">
                <option value="">None</option>
                {wants.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
          <button onClick={() => onSave({ name, allocatedAmount: Number(amount) || 0, accountId: account.id, isEmergencyFund: isEmergency }, linkedWantId || undefined)}
            disabled={!name}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors">
            Add Bucket
          </button>
        </div>
      </div>
    </div>
  )
}
