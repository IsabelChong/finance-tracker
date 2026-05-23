import { useState } from 'react'
import { Pencil, X, Check, Plus, Trash2, Home, Info, TrendingUp, TrendingDown } from 'lucide-react'
import DatePicker from '../components/DatePicker'
import { Timestamp } from 'firebase/firestore'
import { useCPF } from '../hooks/useCPF'
import { useInvestments } from '../hooks/useInvestments'
import { useFXRates } from '../contexts/FXRatesContext'
import { HousingGoal } from '../types'
import { formatCurrency, formatDate, formatWithCurrency, formatPercent } from '../lib/utils'

type AccountKey = 'ordinary' | 'special' | 'medisave'

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-slate-400">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      {label}
    </div>
  )
}

const CPF_ACCOUNTS: { key: AccountKey; label: string; short: string; desc: string; rate: number; rateStr: string; color: string }[] = [
  { key: 'ordinary', label: 'Ordinary Account', short: 'OA', desc: 'For housing, education & investments', rate: 0.025, rateStr: '2.5%', color: '#3b82f6' },
  { key: 'special',  label: 'Special Account',  short: 'SA', desc: 'For retirement savings',               rate: 0.04,  rateStr: '4%',   color: '#8b5cf6' },
  { key: 'medisave', label: 'MediSave Account', short: 'MA', desc: 'For healthcare expenses',              rate: 0.04,  rateStr: '4%',   color: '#22c55e' },
]

function tsToDate(ts: Timestamp | undefined): Date | null {
  if (!ts) return null
  return ts.toDate ? ts.toDate() : new Date(ts as any)
}

const GRANTS = [
  { key: 'grantEHG',        label: 'Enhanced CPF Housing Grant (EHG)',  max: 120000, desc: 'Up to $120,000 for first-timers (income-based). BTO or resale.' },
  { key: 'grantCPFHousing', label: 'CPF Housing Grant (Family Grant)',   max: 80000,  desc: 'Up to $80,000 for first-timers buying resale. Income-based.' },
  { key: 'grantProximity',  label: 'Proximity Housing Grant (PHG)',      max: 30000,  desc: 'Up to $30,000 for buying near/with parents or children. Resale only.' },
  { key: 'grantStepUp',     label: 'Step-Up CPF Housing Grant',          max: 15000,  desc: '$15,000 for second-timers moving from 2-room or 3-room flat.' },
] as const

// ─── Housing Goal Modal ───────────────────────────────────────────────────────

function HousingGoalModal({ goal, oaBalance, onSave, onClose }: {
  goal: HousingGoal | null
  oaBalance: number
  onSave: (data: Omit<HousingGoal, 'id' | 'createdAt'>) => Promise<void>
  onClose: () => void
}) {
  const [name, setName]               = useState(goal?.name ?? '')
  const [targetPrice, setTargetPrice] = useState(goal ? String(goal.targetPrice) : '')
  const [oaPlanned, setOaPlanned]     = useState(goal ? String(goal.cpfOAPlanned) : '')
  const [cashDP, setCashDP]           = useState(goal ? String(goal.cashDownPayment) : '')
  const [grantEHG, setGrantEHG]               = useState(goal?.grantEHG ? String(goal.grantEHG) : '')
  const [grantCPFHousing, setGrantCPFHousing] = useState(goal?.grantCPFHousing ? String(goal.grantCPFHousing) : '')
  const [grantProximity, setGrantProximity]   = useState(goal?.grantProximity ? String(goal.grantProximity) : '')
  const [grantStepUp, setGrantStepUp]         = useState(goal?.grantStepUp ? String(goal.grantStepUp) : '')
  const [targetDate, setTargetDate]   = useState(
    goal?.targetDate ? tsToDate(goal.targetDate)?.toISOString().split('T')[0] ?? '' : ''
  )
  const [notes, setNotes]   = useState(goal?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const grantSetters: Record<string, React.Dispatch<React.SetStateAction<string>>> = {
    grantEHG: setGrantEHG, grantCPFHousing: setGrantCPFHousing,
    grantProximity: setGrantProximity, grantStepUp: setGrantStepUp,
  }
  const grantValues: Record<string, string> = {
    grantEHG, grantCPFHousing, grantProximity, grantStepUp,
  }

  const totalGrants  = [grantEHG, grantCPFHousing, grantProximity, grantStepUp].reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const price        = parseFloat(targetPrice) || 0
  const oa           = parseFloat(oaPlanned) || 0
  const cash         = parseFloat(cashDP) || 0
  const afterGrants  = Math.max(0, price - totalGrants)
  const loanNeeded   = Math.max(0, afterGrants - oa - cash)

  const handleSave = async () => {
    if (!name || !targetPrice) return
    setSaving(true)
    await onSave({
      name,
      targetPrice: price,
      cpfOAPlanned: oa,
      cashDownPayment: cash,
      grantEHG: parseFloat(grantEHG) || undefined,
      grantCPFHousing: parseFloat(grantCPFHousing) || undefined,
      grantProximity: parseFloat(grantProximity) || undefined,
      grantStepUp: parseFloat(grantStepUp) || undefined,
      targetDate: targetDate ? Timestamp.fromDate(new Date(targetDate)) : undefined,
      notes,
    })
    onClose()
  }

  const numInput = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500'

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between sticky top-0 bg-slate-900 pb-1">
          <h2 className="font-bold text-lg">{goal ? 'Edit Goal' : 'Add Housing Goal'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Goal name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. BTO in Woodlands"
              className={numInput} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Target property price (SGD)</label>
            <input value={targetPrice} onChange={e => setTargetPrice(e.target.value)} type="number" placeholder="450000"
              onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
              className={numInput} />
          </div>

          {/* Grants section */}
          <div className="bg-slate-800/50 rounded-2xl p-3 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-green-400">HDB Grants</p>
              <p className="text-xs text-slate-500">— all credited to your CPF OA</p>
            </div>
            {GRANTS.map(g => (
              <div key={g.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-300 font-medium">{g.label}</label>
                  <span className="text-xs text-slate-500">max {formatCurrency(g.max)}</span>
                </div>
                <p className="text-xs text-slate-500 mb-1.5">{g.desc}</p>
                <input value={grantValues[g.key]} onChange={e => grantSetters[g.key](e.target.value)}
                  type="number" placeholder="0"
                  onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                  className={numInput} />
              </div>
            ))}
            {totalGrants > 0 && (
              <div className="flex justify-between text-sm pt-1 border-t border-slate-700">
                <span className="text-slate-400">Total grants</span>
                <span className="font-bold text-green-400">+{formatCurrency(totalGrants)}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Planned OA usage — your own savings (SGD)
              {oaBalance > 0 && <span className="text-blue-400 ml-2">OA now: {formatCurrency(oaBalance)}</span>}
            </label>
            <input value={oaPlanned} onChange={e => setOaPlanned(e.target.value)} type="number" placeholder="80000"
              onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
              className={numInput} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Cash down payment (SGD)</label>
            <input value={cashDP} onChange={e => setCashDP(e.target.value)} type="number" placeholder="22500"
              onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
              className={numInput} />
          </div>

          {/* Live summary */}
          {price > 0 && (
            <div className="bg-slate-800 rounded-xl p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Flat price</span><span>{formatCurrency(price)}</span></div>
              {totalGrants > 0 && <div className="flex justify-between"><span className="text-slate-400">Grants (to OA)</span><span className="text-green-400">− {formatCurrency(totalGrants)}</span></div>}
              {totalGrants > 0 && <div className="flex justify-between border-t border-slate-700 pt-1.5"><span className="text-slate-300 font-medium">Amount to fund</span><span className="font-bold">{formatCurrency(afterGrants)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-400">OA (your savings{totalGrants > 0 ? ' + grants' : ''})</span><span className="text-blue-400">{formatCurrency(oa + totalGrants)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Cash down</span><span className="text-yellow-400">{formatCurrency(cash)}</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-1.5">
                <span className="text-slate-300 font-medium">Estimated loan</span>
                <span className={`font-bold ${loanNeeded === 0 ? 'text-green-400' : 'text-orange-400'}`}>{formatCurrency(loanNeeded)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Target date (optional)</label>
            <DatePicker value={targetDate} onChange={setTargetDate} placeholder="Pick a target date" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="HDB loan vs bank loan, etc."
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
  const { investments } = useInvestments()
  const { toSGD } = useFXRates()

  const cpfInvestments = investments.filter(i => i.fundedBy === 'cpf-oa')

  // Group CPFIS by ticker for display
  const cpfTickerMap: Record<string, typeof cpfInvestments> = {}
  for (const inv of cpfInvestments) {
    if (!cpfTickerMap[inv.ticker]) cpfTickerMap[inv.ticker] = []
    cpfTickerMap[inv.ticker].push(inv)
  }
  const cpfGroups = Object.entries(cpfTickerMap).map(([ticker, lots]) => {
    const totalShares = lots.reduce((s, l) => s + l.shares, 0)
    const costSGD  = lots.reduce((s, l) => s + toSGD(l.shares * l.purchasePrice, l.currency), 0)
    const valueSGD = lots.reduce((s, l) => s + toSGD(l.shares * l.currentPrice,  l.currency), 0)
    const gl = valueSGD - costSGD
    const glPct = costSGD > 0 ? (gl / costSGD) * 100 : 0
    const currency = lots[0]?.currency ?? 'SGD'
    const name = lots.find(l => l.name)?.name ?? ''
    return { ticker, name, currency, lots, totalShares, costSGD, valueSGD, gl, glPct }
  })

  const cpfOaInvestedCostSGD  = cpfGroups.reduce((s, g) => s + g.costSGD,  0)
  const cpfOaCurrentValueSGD  = cpfGroups.reduce((s, g) => s + g.valueSGD, 0)
  const cpfOaGainLossSGD = cpfOaCurrentValueSGD - cpfOaInvestedCostSGD
  const cpfOaGainLossPct = cpfOaInvestedCostSGD > 0 ? (cpfOaGainLossSGD / cpfOaInvestedCostSGD) * 100 : 0
  const availableOA = Math.max(0, (cpf?.ordinaryBalance ?? 0) - 20000)

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
          <p className="text-2xl font-bold">{formatCurrency(totalCPF + cpfOaCurrentValueSGD)}</p>
          {cpfOaCurrentValueSGD > 0 && (
            <p className="text-xs text-slate-500">incl. {formatCurrency(cpfOaCurrentValueSGD)} CPFIS</p>
          )}
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

      {/* CPFIS Portfolio */}
      {cpfGroups.length > 0 && (
        <div>
          <h2 className="font-bold mb-3">CPFIS Portfolio</h2>

          {/* Summary card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3">
            <div className="grid grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Invested (cost)</p>
                <p className="font-bold">{formatCurrency(cpfOaInvestedCostSGD)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Current value</p>
                <p className="font-bold">{formatCurrency(cpfOaCurrentValueSGD)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Gain / Loss</p>
                <div className="flex items-center gap-1">
                  {cpfOaGainLossSGD >= 0
                    ? <TrendingUp size={13} className="text-green-400 shrink-0" />
                    : <TrendingDown size={13} className="text-red-400 shrink-0" />}
                  <p className={`font-bold text-xs ${cpfOaGainLossSGD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {cpfOaGainLossSGD >= 0 ? '+' : ''}{formatCurrency(cpfOaGainLossSGD)}<br />
                    ({formatPercent(cpfOaGainLossPct)})
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
              <div>
                <p className="text-xs text-blue-300 font-medium">Available OA for investment</p>
                <p className="text-xs text-slate-500">Uninvested OA − $20,000 minimum floor</p>
              </div>
              <p className="font-bold text-blue-300">{formatCurrency(availableOA)}</p>
            </div>
          </div>

          {/* Holdings list */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800 overflow-hidden">
            {cpfGroups.map(g => (
              <div key={g.ticker} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-blue-400">{g.ticker.slice(0, 4)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{g.ticker}</span>
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">CPF OA</span>
                      {g.lots.length > 1 && (
                        <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">{g.lots.length} lots</span>
                      )}
                    </div>
                    {g.name && <p className="text-xs text-slate-500 truncate">{g.name}</p>}
                    <p className="text-xs text-slate-500">{g.totalShares} shares · {formatWithCurrency(g.lots[0]?.currentPrice ?? 0, g.currency)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatCurrency(g.valueSGD)}</p>
                    <p className={`text-xs font-semibold ${g.gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {g.gl >= 0 ? '+' : ''}{formatCurrency(g.gl)} ({formatPercent(g.glPct)})
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              const totalGrants  = (goal.grantEHG ?? 0) + (goal.grantCPFHousing ?? 0) + (goal.grantProximity ?? 0) + (goal.grantStepUp ?? 0)
              const afterGrants  = Math.max(0, goal.targetPrice - totalGrants)
              const oaWithGrants = goal.cpfOAPlanned + totalGrants
              const loanNeeded   = Math.max(0, afterGrants - goal.cpfOAPlanned - goal.cashDownPayment)
              const totalCovered = oaWithGrants + goal.cashDownPayment
              const pct          = goal.targetPrice > 0 ? Math.min(100, (totalCovered / goal.targetPrice) * 100) : 0
              const addedDate    = tsToDate(goal.createdAt)
              const targetDate   = tsToDate(goal.targetDate ?? undefined)

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
                      <p className="text-xs text-slate-400">Flat Price</p>
                      <p className="font-bold">{formatCurrency(goal.targetPrice)}</p>
                    </div>
                    {totalGrants > 0 ? (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2.5">
                        <p className="text-xs text-green-400">Grants (to OA)</p>
                        <p className="font-bold text-green-400">+{formatCurrency(totalGrants)}</p>
                      </div>
                    ) : (
                      <div className="bg-slate-800/60 rounded-xl p-2.5">
                        <p className="text-xs text-slate-400">Grants</p>
                        <p className="font-bold text-slate-500">None added</p>
                      </div>
                    )}
                    <div className="bg-slate-800/60 rounded-xl p-2.5">
                      <p className="text-xs text-slate-400">OA {totalGrants > 0 ? '+ Grants' : 'Planned'}</p>
                      <p className="font-bold text-blue-400">{formatCurrency(oaWithGrants)}</p>
                      {totalGrants > 0 && <p className="text-xs text-slate-500">Your OA: {formatCurrency(goal.cpfOAPlanned)}</p>}
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-2.5">
                      <p className="text-xs text-slate-400">Cash Down</p>
                      <p className="font-bold text-yellow-400">{formatCurrency(goal.cashDownPayment)}</p>
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-2.5 col-span-2">
                      <p className="text-xs text-slate-400">Estimated Loan Needed</p>
                      <p className={`font-bold ${loanNeeded === 0 ? 'text-green-400' : 'text-orange-400'}`}>{formatCurrency(loanNeeded)}</p>
                    </div>
                  </div>

                  {/* Progress bar — (OA + grants + cash) vs total price */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Downpayment covered</span>
                      <span className="font-semibold">{pct.toFixed(0)}% of flat price</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                      {/* CPF OA (personal) portion */}
                      {goal.cpfOAPlanned > 0 && (
                        <div className="h-full bg-blue-500 transition-all"
                          style={{ width: `${Math.min(100, (goal.cpfOAPlanned / goal.targetPrice) * 100)}%` }} />
                      )}
                      {/* Grants portion */}
                      {totalGrants > 0 && (
                        <div className="h-full bg-green-500 transition-all"
                          style={{ width: `${Math.min(100, (totalGrants / goal.targetPrice) * 100)}%` }} />
                      )}
                      {/* Cash portion */}
                      {goal.cashDownPayment > 0 && (
                        <div className="h-full bg-yellow-500 transition-all"
                          style={{ width: `${Math.min(100, (goal.cashDownPayment / goal.targetPrice) * 100)}%` }} />
                      )}
                    </div>
                    {totalGrants > 0 && (
                      <div className="flex gap-3 mt-1.5">
                        <LegendDot color="#3b82f6" label="Your OA" />
                        <LegendDot color="#22c55e" label="Grants" />
                        <LegendDot color="#eab308" label="Cash" />
                      </div>
                    )}
                  </div>

                  {/* Grant breakdown if any */}
                  {totalGrants > 0 && (
                    <div className="mt-3 bg-green-500/5 border border-green-500/15 rounded-xl p-3 space-y-1">
                      <p className="text-xs font-semibold text-green-400 mb-1.5">Grant breakdown</p>
                      {GRANTS.filter(g => (goal[g.key as keyof HousingGoal] as number) > 0).map(g => (
                        <div key={g.key} className="flex justify-between text-xs">
                          <span className="text-slate-400">{g.label}</span>
                          <span className="font-semibold text-green-300">{formatCurrency((goal[g.key as keyof HousingGoal] as number) ?? 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}

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
