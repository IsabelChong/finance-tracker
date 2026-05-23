import { useState } from 'react'
import { Pencil, X, Check, Plus, Trash2, Home, Info } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useCPF } from '../hooks/useCPF'
import { HousingGoal } from '../types'
import { formatCurrency, formatDate } from '../lib/utils'

type AccountKey = 'ordinary' | 'special' | 'medisave'

const CPF_ACCOUNTS: { key: AccountKey; label: string; short: string; desc: string; rate: number; rateStr: string; color: string }[] = [
  { key: 'ordinary', label: 'Ordinary Account', short: 'OA', desc: 'For housing, education & investments', rate: 0.025, rateStr: '2.5%', color: '#3b82f6' },
  { key: 'special',  label: 'Special Account',  short: 'SA', desc: 'For retirement savings',               rate: 0.04,  rateStr: '4%',   color: '#8b5cf6' },
  { key: 'medisave', label: 'MediSave Account', short: 'MA', desc: 'For healthcare expenses',              rate: 0.04,  rateStr: '4%',   color: '#22c55e' },
]

function tsToDate(ts: Timestamp | undefined): Date | null {
  if (!ts) return null
  return ts.toDate ? ts.toDate() : new Date(ts as any)
}

// ─── Housing Goal Modal ───────────────────────────────────────────────────────

function HousingGoalModal({ goal, oaBalance, onSave, onClose }: {
  goal: HousingGoal | null
  oaBalance: number
  onSave: (data: Omit<HousingGoal, 'id' | 'createdAt'>) => Promise<void>
  onClose: () => void
}) {
  const [name, setName]             = useState(goal?.name ?? '')
  const [targetPrice, setTargetPrice] = useState(goal ? String(goal.targetPrice) : '')
  const [oaPlanned, setOaPlanned]   = useState(goal ? String(goal.cpfOAPlanned) : '')
  const [cashDP, setCashDP]         = useState(goal ? String(goal.cashDownPayment) : '')
  const [targetDate, setTargetDate] = useState(
    goal?.targetDate ? tsToDate(goal.targetDate)?.toISOString().split('T')[0] ?? '' : ''
  )
  const [notes, setNotes]           = useState(goal?.notes ?? '')
  const [saving, setSaving]         = useState(false)

  const handleSave = async () => {
    if (!name || !targetPrice) return
    setSaving(true)
    await onSave({
      name,
      targetPrice: parseFloat(targetPrice) || 0,
      cpfOAPlanned: parseFloat(oaPlanned) || 0,
      cashDownPayment: parseFloat(cashDP) || 0,
      targetDate: targetDate ? Timestamp.fromDate(new Date(targetDate)) : undefined,
      notes,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">{goal ? 'Edit Goal' : 'Add Housing Goal'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Goal name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. BTO in Woodlands"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Target property price (SGD)</label>
            <input value={targetPrice} onChange={e => setTargetPrice(e.target.value)} type="number" placeholder="450000"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Planned OA usage (SGD)
              {oaBalance > 0 && <span className="text-blue-400 ml-2">OA balance: {formatCurrency(oaBalance)}</span>}
            </label>
            <input value={oaPlanned} onChange={e => setOaPlanned(e.target.value)} type="number" placeholder="80000"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Cash down payment (SGD)</label>
            <input value={cashDP} onChange={e => setCashDP(e.target.value)} type="number" placeholder="22500"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Target date (optional)</label>
            <input value={targetDate} onChange={e => setTargetDate(e.target.value)} type="date"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Grant eligibility, loan type..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || !name || !targetPrice}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors">
          {saving ? 'Saving…' : goal ? 'Save Changes' : 'Add Goal'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CPFPage() {
  const { cpf, loading, housingGoals, totalCPF, updateCPFBalance, addHousingGoal, updateHousingGoal, deleteHousingGoal } = useCPF()

  const [editing, setEditing]     = useState<AccountKey | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [saving, setSaving]       = useState(false)
  const [goalModal, setGoalModal] = useState<'add' | HousingGoal | null>(null)

  const startEdit = (key: AccountKey, currentBalance: number) => {
    setEditing(key)
    setEditAmount(currentBalance > 0 ? String(currentBalance) : '')
  }

  const saveBalance = async () => {
    if (!editing) return
    setSaving(true)
    await updateCPFBalance(editing, parseFloat(editAmount) || 0)
    setSaving(false)
    setEditing(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold">CPF</h1>
          <p className="text-slate-400 text-sm">Central Provident Fund</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Total CPF</p>
          <p className="text-2xl font-bold">{formatCurrency(totalCPF)}</p>
        </div>
      </div>

      {/* Sub-account cards */}
      <div className="space-y-3">
        {CPF_ACCOUNTS.map(acc => {
          const balance     = acc.key === 'ordinary' ? (cpf?.ordinaryBalance ?? 0)
                            : acc.key === 'special'  ? (cpf?.specialBalance  ?? 0)
                            : (cpf?.medisaveBalance ?? 0)
          const lastUpdated = acc.key === 'ordinary' ? cpf?.ordinaryLastUpdated
                            : acc.key === 'special'  ? cpf?.specialLastUpdated
                            : cpf?.medisaveLastUpdated
          const estInterest = balance * acc.rate
          const updatedDate = tsToDate(lastUpdated)
          const isEditing   = editing === acc.key

          return (
            <div key={acc.key} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: acc.color }} />
                  <div>
                    <p className="font-semibold text-sm">{acc.label} <span className="text-slate-500">({acc.short})</span></p>
                    <p className="text-xs text-slate-500">{acc.desc}</p>
                  </div>
                </div>
                {!isEditing && (
                  <button onClick={() => startEdit(acc.key, balance)}
                    className="text-slate-500 hover:text-white transition-colors p-1">
                    <Pencil size={15} />
                  </button>
                )}
              </div>

              {/* Balance */}
              {isEditing ? (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-slate-400 text-sm">SGD</span>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveBalance(); if (e.key === 'Escape') setEditing(null) }}
                    autoFocus
                    className="flex-1 bg-slate-800 border border-blue-500 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    placeholder="0.00"
                  />
                  <button onClick={saveBalance} disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white p-2 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <p className="text-2xl font-bold mt-1">{formatCurrency(balance)}</p>
              )}

              {/* Last updated */}
              <p className="text-xs text-slate-500 mt-1">
                {updatedDate ? `Last updated on ${formatDate(updatedDate)}` : 'Not yet updated'}
              </p>

              {/* Estimated interest */}
              <div className="mt-3 flex items-start gap-2 bg-slate-800/60 rounded-xl px-3 py-2.5">
                <Info size={13} className="text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-300">
                    Est. annual interest: <span className="font-semibold" style={{ color: acc.color }}>{formatCurrency(estInterest)}</span>
                    <span className="text-slate-500"> ({acc.rateStr} p.a.)</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Projection only — not added to balance</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Housing Goals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Housing Goals</h2>
          <button onClick={() => setGoalModal('add')}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors">
            <Plus size={15} /> Add Goal
          </button>
        </div>

        {housingGoals.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <Home size={32} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No housing goals yet</p>
            <p className="text-slate-600 text-xs mt-1">Track your BTO or resale flat savings plan</p>
          </div>
        ) : (
          <div className="space-y-3">
            {housingGoals.map(goal => {
              const total     = goal.cpfOAPlanned + goal.cashDownPayment
              const pct       = goal.targetPrice > 0 ? Math.min(100, (total / goal.targetPrice) * 100) : 0
              const remaining = Math.max(0, goal.targetPrice - total)
              const addedDate = tsToDate(goal.createdAt)
              const targetDate = tsToDate(goal.targetDate ?? undefined)

              return (
                <div key={goal.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">{goal.name}</p>
                      {addedDate && <p className="text-xs text-slate-500 mt-0.5">Added on {formatDate(addedDate)}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setGoalModal(goal)}
                        className="text-slate-500 hover:text-white p-1 transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => deleteHousingGoal(goal.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div className="bg-slate-800/60 rounded-xl p-2.5">
                      <p className="text-xs text-slate-400">Target Price</p>
                      <p className="font-bold">{formatCurrency(goal.targetPrice)}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-2.5">
                      <p className="text-xs text-slate-400">Still Needed</p>
                      <p className={`font-bold ${remaining === 0 ? 'text-green-400' : ''}`}>{formatCurrency(remaining)}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-2.5">
                      <p className="text-xs text-slate-400">OA Planned</p>
                      <p className="font-bold text-blue-400">{formatCurrency(goal.cpfOAPlanned)}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-2.5">
                      <p className="text-xs text-slate-400">Cash Down</p>
                      <p className="font-bold text-yellow-400">{formatCurrency(goal.cashDownPayment)}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Down payment progress</span>
                      <span className="font-semibold">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {(targetDate || goal.notes) && (
                    <div className="mt-3 space-y-1">
                      {targetDate && <p className="text-xs text-slate-400">Target date: <span className="text-slate-300">{formatDate(targetDate)}</span></p>}
                      {goal.notes && <p className="text-xs text-slate-500">{goal.notes}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {goalModal && (
        <HousingGoalModal
          goal={goalModal === 'add' ? null : goalModal}
          oaBalance={cpf?.ordinaryBalance ?? 0}
          onSave={async data => {
            if (goalModal === 'add') await addHousingGoal(data)
            else await updateHousingGoal(goalModal.id, data)
          }}
          onClose={() => setGoalModal(null)}
        />
      )}
    </div>
  )
}
