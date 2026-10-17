import { useAuth } from '../auth/AuthContext'

export function LibraryPage() {
  const { session, signOut } = useAuth()

  return (
    <>
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight">Library</h1>
      <p className="mt-1 text-sm text-muted">Your recipes and your friends' locked recipes will live here.</p>

      <section aria-label="Account" className="squircle mt-8 flex items-center gap-4 rounded-4xl bg-soft p-4 pl-5">
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">Signed in as</span>
          <span className="block truncate">{session?.user.email}</span>
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="h-10 rounded-full bg-bg px-4 text-sm transition-transform active:scale-[0.98]"
        >
          Sign out
        </button>
      </section>
    </>
  )
}
