import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, CreditCard, TrendingUp, Star, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/transactions',icon: ArrowLeftRight,  label: 'Transactions' },
  { to: '/accounts',    icon: CreditCard,      label: 'Accounts'     },
  { to: '/investments', icon: TrendingUp,      label: 'Investments'  },
  { to: '/wants',       icon: Star,            label: 'Wants'        },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-56 bg-slate-900 border-r border-slate-800 shrink-0">
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-lg font-bold text-white">Finance Tracker</h1>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{user?.displayName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <Outlet />
        </main>

        {/* Bottom nav — mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex safe-bottom">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-500'
                }`
              }
            >
              <Icon size={22} />
              <span className="text-[10px]">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
