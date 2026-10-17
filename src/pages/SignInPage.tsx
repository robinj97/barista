import { useAuth } from '../auth/AuthContext'

export function SignInPage() {
  const { signInWithGoogle, error } = useAuth()

  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center justify-items-center gap-6 px-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center">
      <span className="pebble-2 size-24 bg-accent-soft" aria-hidden />
      <div>
        <h1 className="text-[2rem] leading-tight font-medium tracking-tight">Barista</h1>
        <p className="mt-1 text-muted">Dial in every bag.</p>
      </div>
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className="h-14 w-full max-w-xs rounded-full bg-ink px-6 font-medium text-bg transition-transform active:scale-[0.98]"
      >
        Continue with Google
      </button>
      {error && (
        <p role="alert" className="max-w-xs text-sm text-accent">
          {error}
        </p>
      )}
    </main>
  )
}
