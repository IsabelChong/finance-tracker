import { useState } from 'react'
import { Plus, X, ChevronRight, Shield, Star, Pencil } from 'lucide-react'
import { useAccounts } from '../hooks/useAccounts'
import { useWants } from '../hooks/useWants'
import { useTransactions } from '../hooks/useTransactions'
import { formatCurrency, formatDate } from '../lib/utils'
import { Account, AccountBucket } from '../types'

type Modal = null | 'addAccount' | { type: 'accountDetail'; account: Account } | { type: 'addBucket'; account: Account } | { type: 'editBucket'; bucket: AccountBucket }

const COLORS = ['#3b82f6','#22c55e','#ef4444','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316']

export default function AccountsPage() {
  const { accounts, buckets, addAccount, updateAccount, deleteAccount, addBucket, updateBucket, deleteBucket, bucketsForAccount, allocatedForAccount } = useAccounts()
  const { wants, updateWant } = useWants()
  const { transactions } = useTransactions()
  const [modal, setModal] = useState<Modal>(null)

  const bankAccounts = accounts.filter(a => a.type !== 'credit')
  const creditAccounts = accounts.filter(a => a.type === 'credit')
  const totalSavings = bankAccounts.reduce((s, a) => s + a.balance, 0)
  const totalDebt = creditAccounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Accounts</h1>
        <button onClick={() => setModal('addAccount')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={16} /> Add
        </button>
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
          {bankAccounts.map(acc => <AccountRow key={acc.id} account={acc} allocated={allocatedForAccount(acc.id)} onClick={() => setModal({ type: 'accountDetail', account: acc })} />)}
        </Section>
      )}

      {creditAccounts.length > 0 && (
        <Section title="Credit Cards">
          {creditAccounts.map(acc => <AccountRow key={acc.id} account={acc} allocated={0} onClick={() => setModal({ type: 'accountDetail', account: acc })} />)}
        </Section>
      )}

      {accounts.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500">
          Add your first account to get started
        </div>
      )}

      {/* Modals */}
      {modal === 'addAccount' && (
        <AddAccountModal onClose={() => setModal(null)} onSave={async (data) => { await addAccount(data); setModal(null) }} />
      )}
      {modal && typeof modal === 'object' && modal.type === 'accountDetail' && (
        <AccountDetailModal
          account={modal.account}
          buckets={bucketsForAccount(modal.account.id)}
          transactions={transactions.filter(t => t.accountId === modal.account.id || t.toAccountId === modal.account.id)}
          wants={wants}
          onClose={() => setModal(null)}
          onAddBucket={() => setModal({ type: 'addBucket', account: modal.account })}
          onUpdateBucket={updateBucket}
          onDeleteBucket={deleteBucket}
          onReconcile={(id, bal) => updateAccount(id, { balance: bal })}
          onDelete={async (id) => { await deleteAccount(id); setModal(null) }}
        />
      )}
      {modal && typeof modal === 'object' && modal.type === 'addBucket' && (
        <AddBucketModal
          account={modal.account}
          wants={wants.filter(w => !w.bucketId)}
          onClose={() => setModal(null)}
          onSave={async (data, wantId) => {
            const ref = await addBucket(data)
            if (ref && wantId) await updateWant(wantId, { bucketId: ref.id })
            setModal(null)
          }}
        />
      )}
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

function AccountRow({ account, allocated, onClick }: { account: Account; allocated: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-4 px-4 py-4 w-full text-left hover:bg-slate-800/50 transition-colors rounded-xl">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: account.colorHex + '22' }}>
        <span className="text-xl">{account.type === 'credit' ? '💳' : '🏦'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{account.name}</p>
        <p className="text-xs text-slate-400">{account.institution || account.type}</p>
        {account.type !== 'credit' && allocated > 0 && (
          <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(allocated)} allocated · {formatCurrency(account.balance - allocated)} free</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={`font-bold ${account.type === 'credit' ? 'text-red-400' : ''}`}>{formatCurrency(account.balance)}</p>
        {account.type === 'credit' && <p className="text-xs text-red-400">owed</p>}
      </div>
      <ChevronRight size={16} className="text-slate-600" />
    </button>
  )
}

function AccountDetailModal({ account, buckets, transactions, wants, onClose, onAddBucket, onUpdateBucket, onDeleteBucket, onReconcile, onDelete }: {
  account: Account; buckets: AccountBucket[]; transactions: any[]; wants: any[]
  onClose: () => void; onAddBucket: () => void
  onUpdateBucket: (id: string, d: Partial<AccountBucket>) => void
  onDeleteBucket: (id: string) => void
  onReconcile: (id: string, balance: number) => void
  onDelete: (id: string) => void
}) {
  const [reconcile, setReconcile] = useState('')
  const [showReconcile, setShowReconcile] = useState(false)
  const allocated = buckets.reduce((s, b) => s + b.allocatedAmount, 0)
  const unallocated = account.balance - allocated

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
            <p className="text-xs text-slate-400 mb-1">{account.type === 'credit' ? 'Amount Owed' : 'Balance'}</p>
            <p className={`text-4xl font-bold ${account.type === 'credit' ? 'text-red-400' : ''}`}>{formatCurrency(account.balance)}</p>
            {!showReconcile && (
              <button onClick={() => setShowReconcile(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-blue-400 mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                <Pencil size={11} /> Reconcile balance
              </button>
            )}
            {showReconcile && (
              <div className="flex gap-2 mt-3 justify-center">
                <input value={reconcile} onChange={e => setReconcile(e.target.value)} placeholder={String(account.balance)} type="number"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm w-36 text-center outline-none focus:border-blue-500" />
                <button onClick={() => { if (reconcile) { onReconcile(account.id, Number(reconcile)); setShowReconcile(false) } }}
                  className="bg-blue-600 text-white text-sm px-3 rounded-lg">Save</button>
              </div>
            )}
          </div>

          {/* Buckets */}
          {account.type !== 'credit' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">Buckets</h3>
                <button onClick={onAddBucket} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={12} /> Add bucket</button>
              </div>
              {buckets.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No buckets — add one to allocate savings</p>
              ) : (
                <div className="space-y-2">
                  {buckets.map(b => {
                    const want = wants.find(w => w.bucketId === b.id || w.id === b.wantId)
                    const pct = want ? Math.min(100, (b.allocatedAmount / want.targetAmount) * 100) : 0
                    return (
                      <div key={b.id} className="bg-slate-800 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {b.isEmergencyFund && <Shield size={12} className="text-orange-400" />}
                            {want && <Star size={12} className="text-purple-400" />}
                            <span className="text-sm font-medium">{b.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <BucketAmountEditor bucket={b} onUpdate={onUpdateBucket} />
                            <button onClick={() => onDeleteBucket(b.id)} className="text-slate-600 hover:text-red-400"><X size={14} /></button>
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
                  })}
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

function AddAccountModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'savings' | 'checking' | 'credit'>('savings')
  const [institution, setInstitution] = useState('')
  const [balance, setBalance] = useState('')
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
            <div className="flex gap-2">
              {(['savings', 'checking', 'credit'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${type === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">
              {type === 'credit' ? 'Current balance owed (SGD)' : 'Opening balance (SGD)'}
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
          <button onClick={() => onSave({ name, type, institution, balance: Number(balance) || 0, currency: 'SGD', colorHex })}
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
