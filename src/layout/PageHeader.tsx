import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/Avatar'

/** Page title with the profile button on the right. */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { session } = useAuth()
  const meta = session?.user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string } | undefined
  const name = meta?.full_name ?? meta?.name ?? session?.user.email ?? ''

  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[2rem] leading-tight font-medium tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <Link to="/profile" aria-label="Profile" className="mt-1 rounded-full transition-transform active:scale-95">
        <Avatar name={name} url={meta?.avatar_url ?? meta?.picture} className="size-11" />
      </Link>
    </header>
  )
}
