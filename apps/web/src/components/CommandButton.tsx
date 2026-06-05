import { LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { ReactNode } from 'react'

interface CommandButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  children?: ReactNode
}

export function CommandButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
}: CommandButtonProps) {
  const variantClasses = {
    primary:
      'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500',
    secondary:
      'bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600',
    danger: 'bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'flex items-center gap-2 px-4 py-2 rounded-lg text-slate-50 font-medium transition-colors',
        variantClasses[variant]
      )}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-50" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      <span>{label}</span>
    </button>
  )
}
