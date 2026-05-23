import { createContext, useContext, useState } from 'react'

type FXRates = Record<string, number>

// 1 foreign unit = X SGD
const DEFAULTS: FXRates = { SGD: 1, USD: 1.35, HKD: 0.17, GBP: 1.72, EUR: 1.47, MYR: 0.30, JPY: 0.0088 }

interface FXRatesCtx {
  rates: FXRates
  updateRate: (currency: string, rate: number) => void
  toSGD: (amount: number, currency: string) => number
}

const Ctx = createContext<FXRatesCtx>({
  rates: DEFAULTS,
  updateRate: () => {},
  toSGD: (a) => a,
})

export function FXRatesProvider({ children }: { children: React.ReactNode }) {
  const [rates, setRates] = useState<FXRates>(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('fxRates') || '{}') } }
    catch { return DEFAULTS }
  })

  const updateRate = (currency: string, rate: number) => {
    const next = { ...rates, [currency]: rate }
    setRates(next)
    localStorage.setItem('fxRates', JSON.stringify(next))
  }

  const toSGD = (amount: number, currency: string) =>
    amount * (rates[currency] ?? 1)

  return <Ctx.Provider value={{ rates, updateRate, toSGD }}>{children}</Ctx.Provider>
}

export function useFXRates() { return useContext(Ctx) }
