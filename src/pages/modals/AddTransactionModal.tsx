import { useState } from 'react'
import { X } from 'lucide-react'
import { Account, Category, Transaction } from '../../types'
import DatePicker from '../../components/DatePicker'

type TxType = 'income' | 'expense' | 'transfer'

type TxData = {
  date: Date; amount: number; type: TxType
  categoryName: string; categoryIcon: string; categoryColor: string
  accountId: string; accountName: string
  toAccountId?: string; toAccountName?: string
  payee: string; notes: string
}

interface Props {
  accounts: Account[]
  expenseCategories: Category[]
  incomeCategories: Category[]
  initialTx?: Transaction
  onSave?: (tx: TxData) => Promise<string | undefined | void>
  onUpdate?: (txId: string, old: { amount: number; type: string; accountId: string; toAccountId?: string }, newTx: TxData) => Promise<void>
  onClose: () => void
}

function tsToDateStr(ts: any): string {
  if (!ts) return new Date().toISOString().split('T')[0]
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toISOString().split('T')[0]
}

export default function AddTransactionModal({ accounts, expenseCategories, incomeCategories, initialTx, onSave, onUpdate, onClose }: Props) {
  const isEdit = !!initialTx

  const [type, setType]           = useState<TxType>(initialTx?.type ?? 'expense')
  const [amount, setAmount]       = useState(initialTx ? String(initialTx.amount) : '')
  const [payee, setPayee]         = useState(initialTx?.payee ?? '')
  const [notes, setNotes]         = useState(initialTx?.notes ?? '')
  const [date, setDate]           = useState(tsToDateStr(initialTx?.date))
  const [accountId, setAccountId] = useState(initialTx?.accountId ?? accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(initialTx?.toAccountId ?? '')
  const [selectedCat, setSelectedCat] = useState<Category | null>(() => {
    if (!initialTx || initialTx.type === 'transfer') return null
    const cats = initialTx.type === 'income' ? incomeCategories : expenseCategories
    return cats.find(c => c.name === initialTx.categoryName) ?? null
  })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const cats = type === 'income' ? incomeCategories : expenseCategories
  const canSave = amount && Number(amount) > 0 && accountId &&
    (type === 'transfer' ? toAccountId && toAccountId !== accountId : selectedCat)

  const handleTypeChange = (t: TxType) => {
    setType(t)
    setSelectedCat(t === 'income' ? (incomeCategories.find(c => c.name === 'Salary') ?? null) : null)
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const acc   = accounts.find(a => a.id === accountId)!
      const toAcc = accounts.find(a => a.id === toAccountId)
      const txData: TxData = {
        date: new Date(date),
        amount: Number(amount),
        type,
        categoryName:  type === 'transfer' ? 'Transfer'  : (selectedCat?.name    ?? 'Other'),
        categoryIcon:  type === 'transfer' ? '↔️'        : (selectedCat?.icon    ?? '💸'),
        categoryColor: type === 'transfer' ? '#6B7280'   : (selectedCat?.colorHex ?? '#6B7280'),
        accountId,
        accountName: acc.name,
        toAccountId:   type === 'transfer' ? toAccountId   : undefined,
        toAccountName: type === 'transfer' ? toAcc?.name   : undefined,
        payee,
        notes,
      }
      if (isEdit && onUpdate && initialTx) {
        await onUpdate(initialTx.id, {
          amount: initialTx.amount,
          type: initialTx.type,
          accountId: initialTx.accountId,
          toAccountId: initialTx.toAccountId,
        }, txData)
      } else if (onSave) {
        await onSave(txData)
      }
      onClose()
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Type */}
          <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
            {(['expense', 'income', 'transfer'] as TxType[]).map(t => (
              <button key={t} onClick={() => handleTypeChange(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${type === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="bg-slate-800 rounded-xl p-4">
            <label className="text-xs text-slate-400 font-medium block mb-1">Amount (SGD)</label>
            <input
              type="number" value={amount} onChange={e => setAmount(e.target.value)}
              onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
              placeholder="0.00" step="0.01" min="0"
              className="w-full bg-transparent text-3xl font-bold text-white outline-none placeholder-slate-600"
            />
          </div>

          {/* Date + Payee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Date</label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Payee</label>
              <input value={payee} onChange={e => setPayee(e.target.value)} placeholder="Who?"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
            </div>
          </div>

          {/* Account */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">{type === 'transfer' ? 'From' : 'Account'}</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500">
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {type === 'transfer' && (
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">To</label>
              <select value={toAccountId} onChange={e => setToAccountId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500">
                <option value="">Select account</option>
                {accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          {/* Category grid */}
          {type !== 'transfer' && (
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-2">Category</label>
              <div className="grid grid-cols-4 gap-2">
                {cats.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCat(cat)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl text-center transition-all ${
                      selectedCat?.id === cat.id ? 'ring-2 ring-blue-500 bg-slate-800' : 'bg-slate-800 hover:bg-slate-700'
                    }`}>
                    <span className="text-xl leading-none">{cat.icon}</span>
                    <span className="text-[10px] text-slate-300 leading-tight">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            onClick={handleSave} disabled={!canSave || saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
