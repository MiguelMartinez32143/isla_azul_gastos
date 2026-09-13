import { cx } from '@/lib/utils'

export function ProgressBar({
  ratio,
  color,
  trackClassName = 'bg-stone-100',
}: {
  ratio: number
  color: string
  trackClassName?: string
}) {
  const percent = Math.min(Math.max(ratio, 0), 1) * 100
  return (
    <div className={cx('h-2 overflow-hidden rounded-full', trackClassName)}>
      <div
        className="h-full rounded-full"
        style={{ width: `${percent}%`, minWidth: ratio > 0 ? '0.375rem' : 0, backgroundColor: color }}
      />
    </div>
  )
}
