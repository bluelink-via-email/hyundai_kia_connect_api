import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Car,
  History,
  Settings,
  Command,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useSignOut } from '../hooks/useAuth'
import { useState } from 'react'
import clsx from 'clsx'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const { user, sessionId } = useStore()
  const { mutate: signOut } = useSignOut()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!sessionId) {
    return <>{children}</>
  }

  const handleSignOut = () => {
    signOut()
    navigate('/signin')
  }

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Vehicles', icon: Car, href: '/vehicles' },
    { label: 'History', icon: History, href: '/history' },
    { label: 'Custom Commands', icon: Command, href: '/custom-commands' },
    { label: 'Settings', icon: Settings, href: '/settings' },
  ]

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-800 border-r border-slate-700 transform transition-transform lg:transform-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-6 h-6 text-blue-500" />
            <h1 className="text-xl font-bold text-slate-50">AutoControl</h1>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-slate-50"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => {
                navigate(item.href)
                setSidebarOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-slate-50 transition-colors"
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-slate-800 border-b border-slate-700 px-4 lg:px-8 py-4 flex items-center justify-between">
          <button
            className="lg:hidden text-slate-300 hover:text-slate-50"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <span className="text-slate-300">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-slate-900 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
