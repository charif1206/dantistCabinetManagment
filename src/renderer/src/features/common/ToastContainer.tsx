import React, { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast, ToastItem } from '../../context/ToastContext'

interface ToastCardProps {
  toast: ToastItem
  onClose: (id: string) => void
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false)

  const handleClose = (): void => {
    setIsExiting(true)
    setTimeout(() => {
      onClose(toast.id)
    }, 250)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose()
    }, toast.duration)

    return () => clearTimeout(timer)
  }, [toast.duration])

  // Configuration par type
  const config = {
    success: {
      bgColor: 'bg-emerald-50/95 dark:bg-emerald-950/90',
      borderColor: 'border-emerald-300 dark:border-emerald-800',
      textColor: 'text-emerald-950 dark:text-emerald-50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      barColor: 'bg-emerald-500 dark:bg-emerald-400',
      defaultTitle: 'Succès',
      Icon: CheckCircle2
    },
    error: {
      bgColor: 'bg-red-50/95 dark:bg-red-950/90',
      borderColor: 'border-red-300 dark:border-red-800',
      textColor: 'text-red-950 dark:text-red-50',
      iconColor: 'text-red-600 dark:text-red-400',
      barColor: 'bg-red-500 dark:bg-red-400',
      defaultTitle: 'Erreur',
      Icon: AlertCircle
    },
    warning: {
      bgColor: 'bg-amber-50/95 dark:bg-amber-950/90',
      borderColor: 'border-amber-300 dark:border-amber-800',
      textColor: 'text-amber-950 dark:text-amber-50',
      iconColor: 'text-amber-600 dark:text-amber-400',
      barColor: 'bg-amber-500 dark:bg-amber-400',
      defaultTitle: 'Attention',
      Icon: AlertTriangle
    },
    info: {
      bgColor: 'bg-blue-50/95 dark:bg-blue-950/90',
      borderColor: 'border-blue-300 dark:border-blue-800',
      textColor: 'text-blue-950 dark:text-blue-50',
      iconColor: 'text-[#005eb2] dark:text-blue-400',
      barColor: 'bg-[#005eb2] dark:bg-blue-400',
      defaultTitle: 'Information',
      Icon: Info
    }
  }[toast.type]

  const { Icon } = config
  const title = toast.title || config.defaultTitle

  return (
    <div
      className={`pointer-events-auto relative w-full overflow-hidden rounded-xl border shadow-lg backdrop-blur-md transition-all duration-200 ${config.bgColor} ${config.borderColor} ${config.textColor} ${
        isExiting ? 'animate-toast-out' : 'animate-toast-in'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3 p-3.5 pr-2">
        <div className={`mt-0.5 shrink-0 ${config.iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 pr-1">
          <h4 className="text-xs font-bold tracking-wide uppercase opacity-90">{title}</h4>
          <p className="mt-0.5 text-sm font-medium leading-snug">{toast.message}</p>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 rounded-lg p-1 text-on-surface/50 hover:bg-black/5 dark:hover:bg-white/10 hover:text-on-surface transition-colors cursor-pointer"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Barre de progression du timer */}
      <div className="h-1 w-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full ${config.barColor}`}
          style={{
            animation: `toastProgress ${toast.duration}ms linear forwards`
          }}
        />
      </div>
    </div>
  )
}

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  )
}

export default ToastContainer
