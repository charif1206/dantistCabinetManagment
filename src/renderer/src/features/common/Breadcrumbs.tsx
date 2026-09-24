import React from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { useNavigation } from '../../context/NavigationContext'
import { BreadcrumbItem } from '../../context/NavigationContext'

export const Breadcrumbs: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { breadcrumbs } = useNavigation()

  if (breadcrumbs.length === 0) return null

  return (
    <nav
      className={`flex items-center space-x-1.5 text-xs text-on-surface-variant font-medium select-none ${className}`}
      aria-label="Fil d'ariane"
    >
      {breadcrumbs.map((crumb: BreadcrumbItem, idx: number) => {
        const isFirst = idx === 0
        const isLast = idx === breadcrumbs.length - 1

        return (
          <React.Fragment key={`${crumb.label}-${idx}`}>
            {idx > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-outline/60 shrink-0 mx-0.5" />
            )}

            {isLast ? (
              <span
                className="font-bold text-on-surface truncate max-w-[200px]"
                aria-current="page"
                title={crumb.label}
              >
                {crumb.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={crumb.action}
                className="inline-flex items-center gap-1 hover:text-secondary hover:underline transition-colors cursor-pointer truncate max-w-[160px]"
                title={`Aller à ${crumb.label}`}
              >
                {isFirst && <Home className="h-3.5 w-3.5 shrink-0 mb-0.5" />}
                <span>{crumb.label}</span>
              </button>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

export default Breadcrumbs
