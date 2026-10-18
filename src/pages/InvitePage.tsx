import { Link, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { useAcceptInvite, usePeekInvite } from '../data/hooks'
import { buttonClass } from '../components/buttonStyle'
import { Button } from '../components/Button'
import { LoadingNote } from '../components/LoadingNote'

/** Opened from an invite link: says who it is from and lets you accept or leave it. */
export function InvitePage() {
  const { token = '' } = useParams()
  const preview = usePeekInvite(token)
  const accept = useAcceptInvite()

  if (accept.isSuccess) {
    return (
      <Card>
        <Avatar name={accept.data.displayName} url={accept.data.avatarUrl} className="size-20" />
        <h1 className="mt-4 text-[1.75rem] leading-tight font-medium tracking-tight">You and {accept.data.displayName} are friends</h1>
        <p className="mt-2 text-sm text-muted">You can now see each other's locked recipes.</p>
        <Link to="/friends" className={`mt-6 ${buttonClass(undefined, true)}`}>
          See your friends
        </Link>
      </Card>
    )
  }

  if (preview.isPending) {
    return (
      <LoadingNote>Checking the invite…</LoadingNote>
    )
  }

  if (preview.isError) {
    return (
      <Card>
        <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight">This invite doesn't work</h1>
        <p className="mt-2 text-sm text-muted">It may have been used, cancelled or expired, or it may be your own. Ask your friend for a new link.</p>
        <Link to="/friends" className={`mt-6 ${buttonClass({ variant: 'soft' }, true)}`}>
          Go to Friends
        </Link>
      </Card>
    )
  }

  return (
    <Card>
      <Avatar name={preview.data.displayName} url={preview.data.avatarUrl} className="size-20" />
      <h1 className="mt-4 text-[1.75rem] leading-tight font-medium tracking-tight">{preview.data.displayName} invited you to be friends</h1>
      <p className="mt-2 text-sm text-muted">You'll see each other's locked recipes. Your brews and notes stay private.</p>
      {accept.isError && (
        <p role="alert" className="mt-3 text-sm text-accent">
          Couldn't accept that. The link may have just expired, or the connection dropped. Try again.
        </p>
      )}
      <Button
        onClick={() => accept.mutate(token)}
        disabled={accept.isPending}
        className="mt-6"
      >
        Accept
      </Button>
      <Link to="/beans" className={`mt-2 ${buttonClass({ variant: 'quiet', size: 'md' }, true)}`}>
        Not now
      </Link>
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="mt-6 flex flex-col items-center text-center">{children}</section>
}
