import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function parseLocal(s: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DatePicker({ value, onChange, placeholder = 'Select date', min }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  min?: string
}) {
  const selected = parseLocal(value)
  const today    = new Date()
  const minDate  = min ? parseLocal(min) : null

  const [open, setOpen]         = useState(false)
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const isDisabled = (day: number) => {
    if (!minDate) return false
    return new Date(viewYear, viewMonth, day) < minDate
  }
  const isSelected = (day: number) =>
    !!selected && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day
  const isToday = (day: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day

  const selectDay = (day: number) => {
    onChange(toDateStr(new Date(viewYear, viewMonth, day)))
    setOpen(false)
  }

  const canGoToToday = !minDate || today >= minDate

  const displayValue = selected
    ? selected.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
    : placeholder

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-left flex items-center justify-between hover:border-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
      >
        <span className={selected ? 'text-white' : 'text-slate-500'}>{displayValue}</span>
        <Calendar size={15} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 right-0 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-4">
          {/* Month / year nav */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold">{MONTH_LABELS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-xs text-slate-500 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => (
              <div key={i} className="flex items-center justify-center">
                {day !== null && (
                  <button
                    type="button"
                    onClick={() => !isDisabled(day) && selectDay(day)}
                    disabled={isDisabled(day)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                      isSelected(day)  ? 'bg-blue-600 text-white' :
                      isToday(day)     ? 'ring-1 ring-blue-500 text-blue-400' :
                      isDisabled(day)  ? 'text-slate-600 cursor-not-allowed' :
                                         'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Today shortcut */}
          {canGoToToday && (
            <button
              type="button"
              onClick={() => { onChange(toDateStr(today)); setOpen(false) }}
              className="mt-3 w-full py-1.5 rounded-xl text-xs font-semibold text-blue-400 hover:bg-slate-700 transition-colors border border-slate-700"
            >
              Today
            </button>
          )}
        </div>
      )}
    </div>
  )
}
