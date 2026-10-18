import type { ReactNode } from 'react'
import { beanCover } from './cover'

interface BeanHeaderProps {
  beanId: string
  title: ReactNode
  subtitle: ReactNode
  /** The back arrow, when the screen has one. */
  back?: ReactNode
}

/** The top of a screen about one bean: optional back arrow, its pebble, a title and a line under it. */
export function BeanHeader({ beanId, title, subtitle, back }: BeanHeaderProps) {
  const cover = beanCover(beanId)
  return (
    <div className="flex items-center gap-3">
      {back}
      <span className={`size-12 shrink-0 ${cover.tint} ${cover.pebble}`} aria-hidden />
      <div className="min-w-0">
        <h1 className="truncate text-lg leading-tight font-medium">{title}</h1>
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
    </div>
  )
}
