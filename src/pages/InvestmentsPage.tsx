import { useState } from 'react'
import { Plus, X, RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react'
import { useInvestments } from '../hooks/useInvestments'
import { useAccounts } from '../hooks/useAccounts'
import { formatCurrency, formatPercent, formatDate } from '../lib/utils'
import { Investment } from '../types'
import { Timestamp } from 'firebase/firestore'

interface TickerGroup {
  ticker: string
  name: string
  lots: Investment[]
  totalShares: number
  totalCost: number
  totalValue: number
  weightedAvgCost: number
  gainLoss: number
  gainLossPct: number
}

function groupByTicker(investments: Investment[]): TickerGroup[] {
  const map: Record<string, Investment[]> = {}
  for (const inv of investments) {
    if (!map[inv.ticker]) map[inv.ticker] = []
    map[inv.ticker].push(inv)
  }
  return Object.entries(map).map(([ticker, lots]) => {
    const totalShares = lots.reduce((s, l) => s + l.shares, 0)
    const totalCost = lots.reduce((s, l) => s + l.shares * l.purchasePrice, 0)
    const totalValue = lots.reduce((s, l) => s + l.shares * l.currentPrice, 0)
    const weightedAvgCost = totalShares > 0 ? totalCost / totalShares : 0
    const gainLoss = totalValue - totalCost
    const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0
    const name = lots.find(l => l.name)?.name ?? ''
    return { ticker, name, lots, totalShares, totalCost, totalValue, weightedAvgCost, gainLoss, gainLossPct }
  })
}

export default function InvestmentsPage() {
  const { investments, addInvestment, updateInvestment, deleteInvestment, updatePricesByTicker, totalCost, totalValue, totalGainLoss, totalGainLossPct } = useInvestments()
  const { accounts, addTransaction } = useAccounts()
  const [showAdd, setShowAdd] = useState(false)
  const [showUpdatePrices, setShowUpdatePrices] = useState(false)
  const [selected, setSelected] = useState<Investment | null>(null)
  const [showFund, setShowFund] = useState(false)
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set())

  const groups = groupByTicker(investments)

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
          {groups.length > 0 && (
            <button onClick={() => setShowUpdatePrices(true)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <RefreshCw size={15} /> Update Prices
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* Portfolio summary */}
      <div className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-2xl p-6">
        <p className="text-purple-200 text-sm font-medium">Portfolio Value</p>
        <p className="text-4xl font-bold mt-1">{formatCurrency(totalValue)}</p>
        <div className="flex items-center gap-2 mt-2">
          {totalGainLoss >= 0 ? <TrendingUp size={16} className="text-green-300" /> : <TrendingDown size={16} className="text-red-300" />}
          <span className={`text-sm font-semibold ${totalGainLoss >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss)} ({formatPercent(totalGainLossPct)})
          </span>
          <span className="text-purple-300 text-xs">vs cost {formatCurrency(totalCost)}</span>
        </div>
        <button onClick={() => setShowFund(true)} className="mt-4 text-sm font-semibold bg-white/10 hover:bg-white/20 px-4 py-1.5 rounded-lg transition-colors">
          Fund from account
        </button>
      </div>

      {/* Holdings grouped by ticker */}
      {groups.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500">
          No investments yet. Add your first holding.
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(group => {
            const expanded = expandedTickers.has(group.ticker)
            const multipleLots = group.lots.length > 1
            return (
              <div key={group.ticker} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {/* Ticker summary row */}
                <button
                  onClick={() => multipleLots ? toggleTicker(group.ticker) : setSelected(group.lots[0])}
                  className="flex items-center gap-4 px-4 py-4 w-full text-left hover:bg-slate-800/50 transition-colors"
                >
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-purple-400">{group.ticker.slice(0, 4)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{group.ticker}</span>
                      {multipleLots && (
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                          {group.lots.length} lots
                        </span>
                      )}
                    </div>
                    {group.name && <p className="text-xs text-slate-500 truncate">{group.name}</p>}
                    <p className="text-xs text-slate-500">
                      {group.totalShares} shares · avg cost {formatCurrency(group.weightedAvgCost)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">{formatCurrency(group.totalValue)}</p>
                    <p className={`text-xs font-semibold ${group.gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {group.gainLoss >= 0 ? '+' : ''}{formatCurrency(group.gainLoss)} ({formatPercent(group.gainLossPct)})
                    </p>
                  </div>
                  {multipleLots && (
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
                                {inv.shares} shares @ {formatCurrency(inv.purchasePrice)}
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
                            <p className="text-xs font-semibold">{formatCurrency(value)}</p>
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

      {showAdd && <AddInvestmentModal onClose={() => setShowAdd(false)} onSave={async (d) => { await addInvestment(d); setShowAdd(false) }} />}
      {showUpdatePrices && (
        <UpdatePricesModal
          groups={groups}
          onClose={() => setShowUpdatePrices(false)}
          onSave={async (prices) => { await updatePricesByTicker(prices); setShowUpdatePrices(false) }}
        />
      )}
      {selected && <EditInvestmentModal investment={selected} onClose={() => setSelected(null)} onUpdate={updateInvestment} onDelete={async (id) => { await deleteInvestment(id); setSelected(null) }} />}
      {showFund && <FundModal accounts={accounts.filter(a => a.type !== 'credit')} onClose={() => setShowFund(false)} onSave={async (accountId, accountName, amount) => {
        await addTransaction({ date: new Date(), amount, type: 'expense', categoryName: 'Investments', categoryIcon: '📈', categoryColor: '#22C55E', accountId, accountName, payee: 'Investment Funding', notes: '' })
        setShowFund(false)
      }} />}
    </div>
  )
}


function AddInvestmentModal({ onClose, onSave }: { onClose: () => void; onSave: (d: any) => void }) {
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [shares, setShares] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [broker, setBroker] = useState('')
  const [currency, setCurrency] = useState('SGD')
  const [notes, setNotes] = useState('')

  const cost = (Number(shares) || 0) * (Number(purchasePrice) || 0)
  const value = (Number(shares) || 0) * (Number(currentPrice) || 0)

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <h2 className="text-lg font-bold">Add Investment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Ticker</label>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="VWRA"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600 font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
                {['SGD','USD','HKD','GBP','EUR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Full name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Vanguard FTSE All-World ETF"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Broker / Platform</label>
            <input value={broker} onChange={e => setBroker(e.target.value)} placeholder="e.g. IBKR, Tiger Brokers"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Shares</label>
              <input value={shares} onChange={e => setShares(e.target.value)} type="number" placeholder="0"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Avg cost</label>
              <input value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} type="number" placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Current</label>
              <input value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} type="number" placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
            </div>
          </div>
          {shares && purchasePrice && currentPrice && (
            <div className="bg-slate-800 rounded-xl p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Cost</span><span>{formatCurrency(cost)}</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-400">Value</span><span className="font-semibold">{formatCurrency(value)}</span></div>
              <div className="flex justify-between mt-1"><span className="text-slate-400">G/L</span>
                <span className={`font-semibold ${value - cost >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {value - cost >= 0 ? '+' : ''}{formatCurrency(value - cost)}
                </span>
              </div>
            </div>
          )}
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600" />
          <button onClick={() => onSave({ ticker, name, shares: Number(shares), purchasePrice: Number(purchasePrice), currentPrice: Number(currentPrice), purchaseDate: Timestamp.now(), broker, currency, notes })}
            disabled={!ticker || !shares || !purchasePrice || !currentPrice}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors">
            Add Investment
          </button>
        </div>
      </div>
    </div>
  )
}

function EditInvestmentModal({ investment, onClose, onDelete }: { investment: Investment; onClose: () => void; onUpdate: (id: string, d: any) => void; onDelete: (id: string) => void }) {
  const cost = investment.shares * investment.purchasePrice
  const value = investment.shares * investment.currentPrice
  const gl = value - cost

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <div><h2 className="text-lg font-bold">{investment.ticker}</h2><p className="text-xs text-slate-400">{investment.name}</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Shares</span><span>{investment.shares}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Avg cost</span><span>{formatCurrency(investment.purchasePrice)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Current price</span><span className="font-semibold">{formatCurrency(investment.currentPrice)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Broker</span><span>{investment.broker || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Bought</span><span>{formatDate(investment.purchaseDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <span className="text-slate-400">P/L</span>
              <span className={`font-bold ${gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {gl >= 0 ? '+' : ''}{formatCurrency(gl)} ({formatPercent(cost > 0 ? (gl / cost) * 100 : 0)})
              </span>
            </div>
          </div>
          {investment.notes && <p className="text-sm text-slate-400 italic">"{investment.notes}"</p>}
          <p className="text-xs text-slate-500 text-center">To update the current price, use "Update Prices" on the main page.</p>
          <button onClick={() => { if (confirm(`Delete this ${investment.ticker} lot?`)) onDelete(investment.id) }}
            className="w-full text-red-400 text-sm py-2 hover:bg-red-400/10 rounded-xl transition-colors">
            Delete holding
          </button>
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
                  <p className="text-xs font-semibold">{g.ticker}</p>
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
