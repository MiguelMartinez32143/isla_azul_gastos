import { card } from '@/lib/styles'
import { cx } from '@/lib/utils'

type EmptyStateProps = {
  emoji: string
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ emoji, title, description, action }: EmptyStateProps) {
  return (
    <div className={cx(card, 'flex flex-col items-center px-6 py-10 text-center')}>
      <span className="text-5xl" aria-hidden>
        {emoji}
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-xs text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
