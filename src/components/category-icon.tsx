import { cx, withAlpha } from '@/lib/utils'

const SIZES = {
  sm: 'size-10 rounded-xl text-xl',
  md: 'size-11 rounded-xl text-2xl',
  lg: 'size-14 rounded-2xl text-3xl',
}

export function CategoryIcon({ icon, color, size = 'md' }: { icon: string; color: string; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden
      className={cx('grid shrink-0 place-items-center leading-none', SIZES[size])}
      style={{ backgroundColor: withAlpha(color, 0.16) }}
    >
      {icon}
    </span>
  )
}
