import { useState } from 'react'
import { Plus, X, RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronRight, ArrowDownToLine, Pencil, GripVertical, Check } from 'lucide-react'
import { Account } from '../types'
import DatePicker from '../components/DatePicker'
import { useInvestments } from '../hooks/useInvestments'
import { useAccounts } from '../hooks/useAccounts'
import { useCPF } from '../hooks/useCPF'
import { useFXRates } from '../contexts/FXRatesContext'
import { formatCurrency, formatWithCurrency, formatPercent, formatDate } from '../lib/utils'
import { Investment } from '../types'
import { Timestamp } from 'firebase/firestore'

interface TickerGroup {
  ticker: string
  name: string
  currency: string
  lots: Investment[]
  totalShares: number
  totalCost: number
  totalValue: number
  totalValueSGD: number
  weightedAvgCost: number
  gainLoss: number
  gainLossPct: number
  hasCPFLots: boolean
}

function groupByTicker(investments: Investment[], toSGD: (amount: number, currency: string) => number): TickerGroup[] {
  const map: Record<string, Investment[]> = {}
  for (const inv of investments) {
    if (!map[inv.ticker]) map[inv.ticker] = []
    map[inv.ticker].push(inv)
  }
  return Object.entries(map).map(([ticker, lots]) => {
    const currency = lots[0]?.currency ?? 'USD'
    const totalShares = lots.reduce((s, l) => s + l.shares, 0)
    const totalCost = lots.reduce((s, l) => s + l.shares * l.purchasePrice, 0)
    const totalValue = lots.reduce((s, l) => s + l.shares * l.currentPrice, 0)
    const totalValueSGD = toSGD(totalValue, currency)
    const weightedAvgCost = totalShares > 0 ? totalCost / totalShares : 0
    const gainLoss = totalValue - totalCost
    const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0
    const name = lots.find(l => l.name)?.name ?? ''
    const hasCPFLots = lots.some(l => l.fundedBy === 'cpf-oa')
    return { ticker, name, currency, lots, totalShares, totalCost, totalValue, totalValueSGD, weightedAvgCost, gainLoss, gainLossPct, hasCPFLots }
  }).sort((a, b) => {
    const sa = Math.min(...a.lots.map(l => l.sortOrder ?? 999999))
    const sb = Math.min(...b.lots.map(l => l.sortOrder ?? 999999))
    return sa - sb
  })
}

export default function InvestmentsPage() {
  const { investments, addInvestment, updateInvestment, deleteInvestment, updatePricesByTicker, reorderInvestmentGroups, totalCostSGD, totalValueSGD, totalGainLossSGD, totalGainLossPct } = useInvestments()
  const { accounts, addTransaction } = useAccounts()
  const { cpf, incrementOABalance } = useCPF()
  const { rates, updateRate, toSGD } = useFXRates()
  const [showAdd, setShowAdd] = useState(false)
  const [showUpdatePrices, setShowUpdatePrices] = useState(false)
  const [selected, setSelected] = useState<Investment | null>(null)
  const [showFund, setShowFund] = useState(false)
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set())
  const [editingFX, setEditingFX] = useState(false)
  const [fxDraft, setFxDraft] = useState<Record<string, string>>({})
  const [reorderMode, setReorderMode] = useState(false)
  const [dragState, setDragState] = useState<{ from: number; over: number } | null>(null)
  const [filterBy, setFilterBy] = useState<'all' | 'cash' | 'cpf-oa'>('all')

  const groups = groupByTicker(investments, toSGD)
  const hasCPFInvestments = groups.some(g => g.hasCPFLots)
  const filteredGroups = filterBy === 'all' ? groups
    : filterBy === 'cpf-oa' ? groups.filter(g => g.hasCPFLots)
    : groups.filter(g => !g.hasCPFLots)

  const handleGroupDrop = (toIdx: number) => {
    if (!dragState || dragState.from === toIdx) { setDragState(null); return }
    const reordered = [...groups]
    const [moved] = reordered.splice(dragState.from, 1)
    reordered.splice(toIdx, 0, moved)
    reorderInvestmentGroups(reordered.map(g => g.ticker))
    setDragState(null)
  }

  const FX_CURRENCIES = ['USD', 'HKD', 'GBP', 'EUR']

  const startEditFX = () => {
    setFxDraft(Object.fromEntries(FX_CURRENCIES.map(c => [c, String(rates[c] ?? '')])))
    setEditingFX(true)
  }
  const saveFX = () => {
    for (const c of FX_CURRENCIES) {
      const v = Number(fxDraft[c])
      if (v > 0) updateRate(c, v)
    }
    setEditingFX(false)
  }

  const toggleTicker = (ticker: string) => {
    setExpandedTickers(prev => {
      const next = new Set(prev)
      next.has(ticker) ? next.delete(ticker) : next.add(ticker)
      return next
    })
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Investments</h1>
        <div className="flex gap-2">
          {groups.length > 1 && (
            <button
              onClick={() => { setReorderMode(r => !r); setDragState(null); setFilterBy('all') }}
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl transition-colors ${reorderMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
            >
              {reorderMode
                ? <><Check size={14} /><span className="hidden sm:inline"> Done</span></>
                : <><GripVertical size={14} /><span className="hidden sm:inline"> Reorder</span></>}
            </button>
          )}
          {!reorderMode && groups.length > 0 && (
            <button onClick={() => setShowUpdatePrices(true)} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors">
              <RefreshCw size={15} /><span className="hidden sm:inline"> Update Prices</span>
            </button>
          )}
          {!reorderMode && (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors">
              <Plus size={16} /><span className="hidden sm:inline"> Add</span>
            </button>
          )}
        </div>
      </div>

      {/* FX rates widget */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400">Exchange Rates (to SGD)</span>
          {editingFX
            ? <button onClick={saveFX} className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">Save</button>
            : <button onClick={startEditFX} className="text-slate-500 hover:text-slate-300 transition-colors"><Pencil size={13} /></button>
          }
        </div>
        {editingFX ? (
          <div className="grid grid-cols-4 gap-2">
            {FX_CURRENCIES.map(c => (
              <div key={c}>
                <label className="text-xs text-slate-500 block mb-1">1 {c} =</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number" value={fxDraft[c]} min="0" step="0.0001"
                    onChange={e => setFxDraft(prev => ({ ...prev, [c]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveFX()}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500 text-right"
                  />
                  <span className="text-xs text-slate-500 shrink-0">SGD</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 flex-wrap">
            {FX_CURRENCIES.map(c => (
              <span key={c} className="text-xs text-slate-300">
                <span className="font-mono font-semibold text-purple-400">{c}</span>
                <span className="text-slate-500"> = </span>
                {formatCurrency(rates[c] ?? 1)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Portfolio summary */}
      <div className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-2xl p-6">
        <p className="text-purple-200 text-sm font-medium">Portfolio Value (SGD)</p>
        <p className="text-4xl font-bold mt-1">{formatCurrency(totalValueSGD)}</p>
        <div className="flex items-center gap-2 mt-2">
          {totalGainLossSGD >= 0 ? <TrendingUp size={16} className="text-green-300" /> : <TrendingDown size={16} className="text-red-300" />}
          <span className={`text-sm font-semibold ${totalGainLossSGD >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {totalGainLossSGD >= 0 ? '+' : ''}{formatCurrency(totalGainLossSGD)} ({formatPercent(totalGainLossPct)})
          </span>
          <span className="text-purple-300 text-xs">vs cost {formatCurrency(totalCostSGD)}</span>
        </div>
        <button onClick={() => setShowFund(true)} className="mt-4 text-sm font-semibold bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-lg transition-colors">
          Fund from account
        </button>
      </div>

      {/* Filter tabs */}
      {hasCPFInvestments && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {([['all', 'All'], ['cash', '💵 Cash'], ['cpf-oa', '🏛️ CPF OA']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilterBy(val)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterBy === val ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Holdings grouped by ticker */}
      {groups.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500">
          No investments yet. Add your first holding.
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500">
          No {filterBy === 'cpf-oa' ? 'CPF OA' : 'cash'} investments.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map((group, gi) => {
            const expanded = expandedTickers.has(group.ticker)
            const multipleLots = group.lots.length > 1
            const isDraggedOver = reorderMode && dragState?.over === gi && dragState.from !== gi
            const isDragging = reorderMode && dragState?.from === gi
            return (
              <div
                key={group.ticker}
                draggable={reorderMode}
                onDragStart={reorderMode ? () => setDragState({ from: gi, over: gi }) : undefined}
                onDragOver={reorderMode ? (e) => { e.preventDefault(); setDragState(d => d ? { ...d, over: gi } : null) } : undefined}
                onDrop={reorderMode ? (e) => { e.preventDefault(); handleGroupDrop(gi) } : undefined}
                onDragEnd={() => setDragState(null)}
                className={[
                  'bg-slate-900 border border-slate-800 rounded-xl overflow-hidden',
                  isDraggedOver ? 'border-t-2 border-t-blue-500' : '',
                  isDragging ? 'opacity-40' : '',
                ].join(' ')}
              >
                {/* Ticker summary row */}
                <button
                  onClick={() => { if (reorderMode) return; multipleLots ? toggleTicker(group.ticker) : setSelected(group.lots[0]) }}
                  className="flex items-center gap-4 px-4 py-4 w-full text-left hover:bg-slate-800/50 transition-colors"
                >
                  {reorderMode && <GripVertical size={16} className="text-slate-500 shrink-0 -ml-1 cursor-grab" />}
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-purple-400">{group.ticker.slice(0, 4)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{group.ticker}</span>
                      {group.hasCPFLots && (
                        <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">CPF OA</span>
                      )}
                      {multipleLots && (
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                          {group.lots.length} lots
                        </span>
                      )}
                    </div>
                    {group.name && <p className="text-xs text-slate-500 truncate">{group.name}</p>}
                    <p className="text-xs text-slate-500">
                      {group.totalShares} shares · avg {formatWithCurrency(group.weightedAvgCost, group.currency)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">{formatWithCurrency(group.totalValue, group.currency)}</p>
                    {group.currency !== 'SGD' && (
                      <p className="text-xs text-slate-500">≈ {formatCurrency(group.totalValueSGD)}</p>
                    )}
                    <p className={`text-xs font-semibold ${group.gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {group.gainLoss >= 0 ? '+' : ''}{formatWithCurrency(group.gainLoss, group.currency)} ({formatPercent(group.gainLossPct)})
                    </p>
                  </div>
                  {multipleLots && !reorderMode && (
                    <div className="ml-1 text-slate-500">
                      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  )}
                </button>

                {/* Individual lots (expanded) */}
                {multipleLots && expanded && (
                  <div className="border-t border-slate-800 divide-y divide-slate-800/50">
                    {group.lots.map(inv => {
                      const cost = inv.shares * inv.purchasePrice
                      const value = inv.shares * inv.currentPrice
                      const gl = value - cost
                      const glPct = cost > 0 ? (gl / cost) * 100 : 0
                      return (
                        <button
                          key={inv.id}
                          onClick={() => setSelected(inv)}
                          className="flex items-center gap-3 pl-14 pr-4 py-3 w-full text-left hover:bg-slate-800/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-300">
                                {inv.shares} @ {formatWithCurrency(inv.purchasePrice, inv.currency)}
                              </span>
                              {inv.broker && (
                                <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                                  {inv.broker}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">Bought {formatDate(inv.purchaseDate, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold">{formatWithCurrency(value, inv.currency)}</p>
                            {inv.currency !== 'SGD' && (
                              <p className="text-xs text-slate-500">≈ {formatCurrency(toSGD(value, inv.currency))}</p>
                            )}
                            <p className={`text-xs ${gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {gl >= 0 ? '+' : ''}{formatPercent(glPct)}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAdd && <AddInvestmentModal existingGroups={groups} accounts={accounts.filter(a => a.type !== 'credit')} oaBalance={cpf?.ordinaryBalance ?? 0} toSGD={toSGD} onClose={() => setShowAdd(false)} onSave={async (d) => {
        setShowAdd(false)
        const { deductAccountId, ...investmentData } = d
        await addInvestment(investmentData)
        const sgdCost = toSGD((d.shares as number) * (d.purchasePrice as number), d.currency as string)
        if (d.fundedBy === 'cpf-oa') {
          await incrementOABalance(-sgdCost)
        } else if (deductAccountId) {
          const acc = accounts.find(a => a.id === deductAccountId)
          await addTransaction({
            date: new Date(),
            amount: sgdCost,
            type: 'expense',
            categoryName: 'Investment',
            categoryIcon: '📈',
            categoryColor: '#22C55E',
            accountId: deductAccountId,
            accountName: acc?.name ?? '',
            payee: d.ticker as string,
            notes: `Purchase of ${d.shares} ${d.ticker} shares`,
          })
        }
      }} />}
      {showUpdatePrices && (
        <UpdatePricesModal
          groups={groups}
          onClose={() => setShowUpdatePrices(false)}
          onSave={async (prices) => { await updatePricesByTicker(prices); setShowUpdatePrices(false) }}
        />
      )}
      {selected && (
        <EditInvestmentModal
          investment={selected}
          accounts={accounts.filter(a => a.type !== 'credit')}
          onClose={() => setSelected(null)}
          onUpdate={updateInvestment}
          onOAIncrement={incrementOABalance}
          onDelete={async (id, saleData, returnToOA) => {
            if (returnToOA && saleData) {
              await incrementOABalance(saleData.amount)
            } else if (saleData) {
              const acc = accounts.find(a => a.id === saleData.accountId)
              await addTransaction({
                date: saleData.date,
                amount: saleData.amount,
                type: 'income',
                categoryName: 'Investment Returns',
                categoryIcon: '📈',
                categoryColor: '#22C55E',
                accountId: saleData.accountId,
                accountName: acc?.name ?? '',
                payee: selected.ticker,
                notes: `Sale of ${selected.shares} ${selected.ticker} shares`,
              })
            }
            await deleteInvestment(id)
            setSelected(null)
          }}
        />
      )}
      {showFund && <FundModal accounts={accounts.filter(a => a.type !== 'credit')} onClose={() => setShowFund(false)} onSave={async (accountId, accountName, amount) => {
        await addTransaction({ date: new Date(), amount, type: 'expense', categoryName: 'Investments', categoryIcon: '📈', categoryColor: '#22C55E', accountId, accountName, payee: 'Investment Funding', notes: '' })
        setShowFund(false)
      }} />}
    </div>
  )
}


function AddInvestmentModal({ existingGroups, accounts, oaBalance, toSGD, onClose, onSave }: {
  existingGroups: TickerGroup[]
  accounts: Account[]
  oaBalance: number
  toSGD: (amount: number, currency: string) => number
  onClose: () => void
  onSave: (d: any) => void
}) {
  const [pinnedTicker, setPinnedTicker] = useState<TickerGroup | null>(null)

  const [ticker, setTicker]             = useState('')
  const [name, setName]                 = useState('')
  const [shares, setShares]             = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [brokerAccountId, setBrokerAccountId] = useState('')
  const [currency, setCurrency]         = useState('USD')
  const [notes, setNotes]               = useState('')
  const [fundedBy, setFundedBy]         = useState<'cash' | 'cpf-oa'>('cash')
  const [deductOnSave, setDeductOnSave] = useState(true)

  const brokerAccounts = accounts.filter(a => a.type === 'investment')

  const selectExisting = (g: TickerGroup) => {
    setPinnedTicker(g)
    setTicker(g.ticker)
    setName(g.name)
    setCurrency(g.lots[0]?.currency ?? 'USD')
    setCurrentPrice(String(g.lots[0]?.currentPrice ?? ''))
    const lotBroker = g.lots[0]?.broker ?? ''
    if (g.hasCPFLots) {
      setFundedBy('cpf-oa')
    } else {
      const match = brokerAccounts.find(a => a.name.toLowerCase() === lotBroker.toLowerCase())
      if (match) setBrokerAccountId(match.id)
    }
  }

  const clearExisting = () => {
    setPinnedTicker(null)
    setTicker(''); setName(''); setCurrentPrice(''); setBrokerAccountId(''); setCurrency('USD'); setFundedBy('cash'); setDeductOnSave(true)
  }

  const cost  = (Number(shares) || 0) * (Number(purchasePrice) || 0)
  const value = (Number(shares) || 0) * (Number(currentPrice) || 0)
  const isLocked = !!pinnedTicker

  const inputCls = (locked?: boolean) =>
    `w-full bg-slate-800 border rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-colors ${
      locked ? 'border-slate-700 text-slate-400 cursor-not-allowed' : 'border-slate-700 focus:border-blue-500'
    }`

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <h2 className="text-lg font-bold">Add Investment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">

          {/* Existing ticker quick-select */}
          {existingGroups.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 font-medium mb-2">Add to existing holding</p>
              <div className="flex flex-wrap gap-2">
                {existingGroups.map(g => (
                  <button key={g.ticker} onClick={() => pinnedTicker?.ticker === g.ticker ? clearExisting() : selectExisting(g)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
                      pinnedTicker?.ticker === g.ticker
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-purple-500 hover:text-white'
                    }`}>
                    <span className="font-mono">{g.ticker}</span>
                    <span className="text-xs font-normal opacity-70">{g.lots.length} lot{g.lots.length > 1 ? 's' : ''}</span>
                  </button>
                ))}
                {pinnedTicker && (
                  <button onClick={clearExisting} className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800 border border-slate-700 transition-colors">
                    + New ticker
                  </button>
                )}
              </div>
              {pinnedTicker && (
                <p className="text-xs text-slate-500 mt-2">
                  Ticker, name, currency and current price are inherited from existing lots — update price later via "Update Prices".
                </p>
              )}
              <div className="border-t border-slate-800 mt-3" />
            </div>
          )}

          {/* Ticker + currency (locked when existing selected) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Ticker</label>
              <input value={ticker} onChange={e => !isLocked && setTicker(e.target.value.toUpperCase())}
                readOnly={isLocked} placeholder="VWRA"
                className={inputCls(isLocked) + ' font-mono'} />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Currency</label>
              <select value={currency} onChange={e => !isLocked && setCurrency(e.target.value)} disabled={isLocked}
                className={inputCls(isLocked)}>
                {['SGD','USD','HKD','GBP','EUR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Name (locked when existing selected) */}
          {!isLocked && (
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Full name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Vanguard FTSE All-World ETF"
                className={inputCls()} />
            </div>
          )}

          {/* Broker + date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Broker / Platform</label>
              {brokerAccounts.length > 0 ? (
                <select value={brokerAccountId} onChange={e => setBrokerAccountId(e.target.value)}
                  className={inputCls()}>
                  <option value="">Select broker</option>
                  {brokerAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ) : (
                <select disabled className={inputCls(true)}>
                  <option>Add a broker account first</option>
                </select>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Date bought</label>
              <DatePicker value={purchaseDate} onChange={setPurchaseDate} />
            </div>
          </div>

          {/* Shares / purchase price / current price */}
          <div className={`grid gap-3 ${isLocked ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Shares</label>
              <input value={shares} onChange={e => setShares(e.target.value)} type="number" placeholder="0"
                onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                className={inputCls()} />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Purchase price</label>
              <input value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} type="number" placeholder="0.00"
                onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                className={inputCls()} />
            </div>
            {!isLocked && (
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">Current price</label>
                <input value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} type="number" placeholder="0.00"
                  onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                  className={inputCls()} />
              </div>
            )}
          </div>

          {/* Live P/L summary */}
          {shares && purchasePrice && currentPrice && (
            <div className="bg-slate-800 rounded-xl p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Cost</span><span>{formatWithCurrency(cost, currency)}</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-400">Value</span><span className="font-semibold">{formatWithCurrency(value, currency)}</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-400">G/L</span>
                <span className={`font-semibold ${value - cost >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {value - cost >= 0 ? '+' : ''}{formatWithCurrency(value - cost, currency)}
                </span>
              </div>
            </div>
          )}

          {/* Funded by toggle */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Funded by</label>
            <div className="flex gap-2">
              {(['cash', 'cpf-oa'] as const).map(opt => (
                <button key={opt} onClick={() => !pinnedTicker && setFundedBy(opt)}
                  disabled={!!pinnedTicker}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    fundedBy === opt
                      ? opt === 'cpf-oa' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-600 border-slate-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  } ${pinnedTicker ? 'cursor-not-allowed opacity-70' : ''}`}>
                  {opt === 'cash' ? '💵 Cash' : '🏛️ CPF OA'}
                </button>
              ))}
            </div>
            {fundedBy === 'cpf-oa' && (
              <div className="mt-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
                <p className="text-xs text-blue-300">Stored OA: <span className="font-bold">{formatCurrency(oaBalance)}</span>
                  <span className="text-slate-500"> · Available: </span>
                  <span className="font-bold">{formatCurrency(Math.max(0, oaBalance - 20000))}</span>
                  <span className="text-slate-500"> (after $20k floor)</span>
                </p>
                {shares && purchasePrice && (
                  <p className="text-xs text-blue-300 mt-0.5">
                    This lot costs ≈ <span className="font-bold">{formatCurrency(toSGD(Number(shares) * Number(purchasePrice), currency))}</span> SGD — OA will be decremented automatically.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Deduct on save toggle (cash only, when broker selected) */}
          {fundedBy === 'cash' && brokerAccountId && (
            <div className="bg-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">Deduct on save</p>
                {shares && purchasePrice && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    ≈ <span className="font-semibold text-slate-300">{formatCurrency(toSGD(Number(shares) * Number(purchasePrice), currency))}</span> SGD from {brokerAccounts.find(a => a.id === brokerAccountId)?.name}
                  </p>
                )}
              </div>
              <button onClick={() => setDeductOnSave(v => !v)}
                className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${deductOnSave ? 'bg-blue-600' : 'bg-slate-600'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${deductOnSave ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
            className={inputCls()} />

          <button
            onClick={() => {
              const brokerName = brokerAccounts.find(a => a.id === brokerAccountId)?.name ?? ''
              onSave({
                ticker, name, shares: Number(shares), purchasePrice: Number(purchasePrice),
                currentPrice: Number(currentPrice), purchaseDate: Timestamp.fromDate(new Date(purchaseDate)),
                broker: brokerName, currency, notes, fundedBy,
                deductAccountId: (fundedBy === 'cash' && deductOnSave && brokerAccountId) ? brokerAccountId : undefined,
              })
            }}
            disabled={!ticker || !shares || !purchasePrice || !currentPrice || !brokerAccountId}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors">
            Add {pinnedTicker ? `${pinnedTicker.ticker} Lot` : 'Investment'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditInvestmentModal({ investment, accounts, onClose, onUpdate, onDelete, onOAIncrement }: {
  investment: Investment
  accounts: Account[]
  onClose: () => void
  onUpdate: (id: string, d: any) => void
  onDelete: (id: string, saleData?: { amount: number; accountId: string; date: Date }, returnToOA?: boolean) => void
  onOAIncrement: (amount: number) => Promise<void>
}) {
  const isCPF = investment.fundedBy === 'cpf-oa'
  const { toSGD } = useFXRates()
  const cost  = investment.shares * investment.purchasePrice
  const value = investment.shares * investment.currentPrice
  const valueSGD = toSGD(value, investment.currency)
  const gl    = value - cost

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [withSale, setWithSale]           = useState(true)
  const [saleAmount, setSaleAmount]       = useState(valueSGD.toFixed(2))
  const [saleAccountId, setSaleAccountId] = useState(accounts[0]?.id ?? '')
  const [saleDate, setSaleDate]           = useState(new Date().toISOString().split('T')[0])
  const [deleting, setDeleting]           = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    if (isCPF) {
      const saleData = withSale ? { amount: Number(saleAmount), accountId: '', date: new Date(saleDate) } : undefined
      await onDelete(investment.id, saleData, withSale)
    } else {
      const saleData = withSale && saleAccountId
        ? { amount: Number(saleAmount), accountId: saleAccountId, date: new Date(saleDate) }
        : undefined
      await onDelete(investment.id, saleData, false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <div><h2 className="text-lg font-bold">{investment.ticker}</h2><p className="text-xs text-slate-400">{investment.name}</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {!confirmDelete ? (
            <>
              <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Shares</span><span>{investment.shares}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Cost / share</span><span>{formatWithCurrency(investment.purchasePrice, investment.currency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Current price</span><span className="font-semibold">{formatWithCurrency(investment.currentPrice, investment.currency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Broker</span><span>{investment.broker || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Bought</span><span>{formatDate(investment.purchaseDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                <div className="flex justify-between border-t border-slate-700 pt-2">
                  <span className="text-slate-400">P/L</span>
                  <span className={`font-bold ${gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {gl >= 0 ? '+' : ''}{formatWithCurrency(gl, investment.currency)} ({formatPercent(cost > 0 ? (gl / cost) * 100 : 0)})
                  </span>
                </div>
              </div>
              {investment.notes && <p className="text-sm text-slate-400 italic">"{investment.notes}"</p>}
              <p className="text-xs text-slate-500 text-center">To update the current price, use "Update Prices" on the main page.</p>
              <button onClick={() => setConfirmDelete(true)}
                className="w-full text-red-400 text-sm py-2 hover:bg-red-400/10 rounded-xl transition-colors">
                Delete holding
              </button>
            </>
          ) : (
            <>
              <div className="bg-slate-800 rounded-xl p-4">
                <p className="font-semibold text-sm mb-1">Delete {investment.ticker} lot</p>
                <p className="text-xs text-slate-400">{investment.shares} shares · current value {formatWithCurrency(value, investment.currency)}</p>
                {isCPF && <p className="text-xs text-blue-400 mt-0.5">Funded by CPF OA</p>}
              </div>

              {/* Option toggle */}
              <div className="space-y-2">
                <button onClick={() => setWithSale(false)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${!withSale ? 'border-slate-500 bg-slate-800' : 'border-slate-700 hover:border-slate-600'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${!withSale ? 'border-blue-500' : 'border-slate-600'}`}>
                    {!withSale && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Just remove from tracker</p>
                    <p className="text-xs text-slate-500">No transaction recorded</p>
                  </div>
                </button>

                <button onClick={() => setWithSale(true)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${withSale ? 'border-slate-500 bg-slate-800' : 'border-slate-700 hover:border-slate-600'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${withSale ? 'border-blue-500' : 'border-slate-600'}`}>
                    {withSale && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {isCPF ? 'Return proceeds to CPF OA' : 'Transfer sale proceeds to account'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {isCPF ? 'Increments your OA balance by the sale amount' : 'Records an income transaction'}
                    </p>
                  </div>
                </button>
              </div>

              {/* Sale details */}
              {withSale && (
                <div className="space-y-3 bg-slate-800/50 rounded-2xl p-3">
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1.5">
                      {isCPF ? 'Amount returned to OA (SGD)' : 'Amount received (SGD)'}
                    </label>
                    <input
                      type="number" value={saleAmount}
                      onChange={e => setSaleAmount(e.target.value)}
                      onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  {!isCPF && (
                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-1.5">Transfer into account</label>
                      <select value={saleAccountId} onChange={e => setSaleAccountId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500">
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1.5">Sale date</label>
                    <DatePicker value={saleDate} onChange={setSaleDate} />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting || (withSale && (!saleAmount || Number(saleAmount) <= 0 || (!isCPF && !saleAccountId)))}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white transition-colors flex items-center justify-center gap-2">
                  {deleting ? 'Processing…' : withSale
                    ? <><ArrowDownToLine size={14} /> {isCPF ? 'Delete & Return to OA' : 'Delete & Transfer'}</>
                    : 'Confirm Delete'
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function UpdatePricesModal({ groups, onClose, onSave }: {
  groups: TickerGroup[]
  onClose: () => void
  onSave: (prices: Record<string, number>) => Promise<void>
}) {
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(groups.map(g => [g.ticker, String(g.lots[0].currentPrice)]))
  )
  const [fetching, setFetching] = useState<Record<string, boolean>>({})
  const [apiKey, setApiKey] = useState(localStorage.getItem('avApiKey') || '')
  const [saving, setSaving] = useState(false)

  const fetchOne = async (ticker: string) => {
    const key = apiKey.trim()
    if (!key) { alert('Enter an Alpha Vantage API key first.'); return }
    localStorage.setItem('avApiKey', key)
    setFetching(prev => ({ ...prev, [ticker]: true }))
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${key}`)
      const json = await res.json()
      const price = json['Global Quote']?.['05. price']
      if (price) setPrices(prev => ({ ...prev, [ticker]: price }))
      else alert(`${ticker}: not found or API limit reached.`)
    } catch { alert('Network error') }
    setFetching(prev => ({ ...prev, [ticker]: false }))
  }

  const fetchAll = async () => {
    for (const g of groups) await fetchOne(g.ticker)
  }

  const handleSave = async () => {
    setSaving(true)
    const changed: Record<string, number> = {}
    for (const g of groups) {
      const val = Number(prices[g.ticker])
      if (val > 0) changed[g.ticker] = val
    }
    await onSave(changed)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <h2 className="text-lg font-bold">Update Prices</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Alpha Vantage API key */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Alpha Vantage API key (free, 25 req/day)</label>
            <div className="flex gap-2">
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Get a free key at alphavantage.co"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 placeholder-slate-600 font-mono" />
              <button onClick={fetchAll} className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold px-3 rounded-xl transition-colors whitespace-nowrap">
                Fetch all
              </button>
            </div>
          </div>

          {/* One row per ticker */}
          <div className="space-y-2">
            {groups.map(g => (
              <div key={g.ticker} className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3">
                <div className="w-12 h-8 bg-slate-700 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-purple-400">{g.ticker.slice(0, 4)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold">{g.ticker}</p>
                    <span className="text-xs text-purple-400 font-mono">{g.currency}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {g.lots.length} {g.lots.length === 1 ? 'lot' : 'lots'} · {g.totalShares} shares
                  </p>
                </div>
                <input
                  type="number" value={prices[g.ticker] ?? ''} min="0" step="0.01"
                  onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                  onChange={e => setPrices(prev => ({ ...prev, [g.ticker]: e.target.value }))}
                  className="w-28 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-blue-500 text-right"
                />
                <button onClick={() => fetchOne(g.ticker)} disabled={fetching[g.ticker]}
                  className="text-slate-400 hover:text-white transition-colors p-1 shrink-0">
                  <RefreshCw size={14} className={fetching[g.ticker] ? 'animate-spin' : ''} />
                </button>
              </div>
            ))}
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors">
            {saving ? 'Saving…' : 'Save All Prices'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FundModal({ accounts, onClose, onSave }: { accounts: any[]; onClose: () => void; onSave: (accountId: string, accountName: string, amount: number) => void }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const acc = accounts.find(a => a.id === accountId)
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-sm rounded-t-2xl lg:rounded-2xl border border-slate-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-bold">Fund Investments</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">From account</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Amount (SGD)</label>
            <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="0.00"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>
          <p className="text-xs text-slate-500">This deducts from your bank account and records it as an investment expense.</p>
          <button onClick={() => { if (acc && amount) onSave(acc.id, acc.name, Number(amount)) }}
            disabled={!accountId || !amount}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors">
            Transfer
          </button>
        </div>
      </div>
    </div>
  )
}
