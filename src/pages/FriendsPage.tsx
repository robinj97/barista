import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { formatDMY, toISODate } from '../beans/dates'
import { useCancelInvite, useCreateInvite, useFriends, useMyInvites, useRemoveFriend } from '../data/hooks'
import type { Friend } from '../data/types'
import { PageHeader } from '../layout/PageHeader'
import { Button } from '../components/Button'
import { LoadingNote } from '../components/LoadingNote'
import { SectionHeading } from '../components/SectionHeading'
import { TextField } from '../components/TextField'

const DAY_MS = 24 * 3600 * 1000

/** "expires in 3 days", for an invite that is still open. */
function expiry(expiresAt: string, now: number): string {
  const days = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / DAY_MS))
  return days < 1 ? 'expires today' : days === 1 ? 'expires tomorrow' : `expires in ${days} days`
}

const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`

/** Friends: invite someone, see who you are friends with, withdraw an invite that is still open. */
export function FriendsPage() {
  const friends = useFriends()
  const invites = useMyInvites()
  const createInvite = useCreateInvite()
  const cancelInvite = useCancelInvite()
  const removeFriend = useRemoveFriend()
  const toast = useToast()
  const [removing, setRemoving] = useState<Friend | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  const invite = () =>
    createInvite.mutate(undefined, {
      onSuccess: (token) => setLink(inviteUrl(token)),
      onError: () => toast.show("Couldn't make an invite. Check your connection and try again."),
    })

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.show('Link copied')
    } catch {
      toast.show("Couldn't copy. Press and hold the link to copy it.")
    }
  }
  const share = () => {
    if (link) void navigator.share({ title: 'Barista', text: 'Join me on Barista to share coffee recipes.', url: link }).catch(() => {})
  }

  const loading = friends.isPending || invites.isPending
  const list = friends.data ?? []
  const pending = invites.data ?? []

  return (
    <>
      <PageHeader title="Friends" subtitle="See each other's locked recipes. Brews and notes stay private." />

      <Button
        onClick={invite}
        disabled={createInvite.isPending}
        className="mt-6"
      >
        Invite a friend
      </Button>

      {loading && (
        <LoadingNote />
      )}

      {pending.length > 0 && (
        <section aria-label="Pending invites" className="mt-6">
          <SectionHeading>Pending invites</SectionHeading>
          <ul className="squircle mt-2 rounded-4xl bg-soft p-2">
            {pending.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-3xl px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">Invite link</span>
                  <span className="block text-xs text-muted">
                    {expiry(item.expiresAt, now)} · {formatDMY(toISODate(new Date(item.expiresAt)))}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => cancelInvite.mutate(item.id)}
                  className="h-10 rounded-full bg-bg px-4 text-sm"
                  aria-label={`Cancel the invite that ${expiry(item.expiresAt, now)}`}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-2 text-xs text-muted">A link can't be shown again once it's made. Cancel it and make a new one if you lose it.</p>
        </section>
      )}

      {!loading && (
        <section aria-label="Your friends" className="mt-6">
          <SectionHeading>Your friends</SectionHeading>
          {list.length === 0 ? (
            <p className="squircle mt-2 rounded-4xl bg-soft px-5 py-4 text-sm text-muted">No friends yet. Invite someone to see their locked recipes.</p>
          ) : (
            <ul className="squircle mt-2 rounded-4xl bg-soft p-2">
              {list.map((friend) => (
                <li key={friend.id} className="flex items-center gap-3 rounded-3xl px-3 py-2">
                  <Avatar name={friend.name} url={friend.avatarUrl} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{friend.name}</span>
                    <span className="block text-xs text-muted">Friends since {formatDMY(toISODate(new Date(friend.since)))}</span>
                  </span>
                  <button type="button" onClick={() => setRemoving(friend)} aria-label={`Remove ${friend.name}`} className="h-10 rounded-full px-3 text-sm text-muted">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ConfirmSheet
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? 'this friend'}?`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={() => {
          const target = removing
          setRemoving(null)
          if (target) removeFriend.mutate(target.id, { onError: () => toast.show("Couldn't remove them. Check your connection and try again.") })
        }}
      >
        You'll stop seeing each other's locked recipes. Recipes you've already brewed from theirs stay yours. To be friends again, one of you sends a new invite.
      </ConfirmSheet>

      <Sheet open={link !== null} onOpenChange={(open) => !open && setLink(null)} title="Your invite link">
        <div className="px-3 pb-3">
          <p className="px-1 text-sm text-muted">Send this to one friend. It works once and for 7 days. You won't be able to see it again after you close this.</p>
          <TextField readOnly value={link ?? ''} aria-label="Invite link" onFocus={(event) => event.currentTarget.select()} className="mt-3 text-sm" />
          <Button onClick={() => void copy()} className="mt-3">
            Copy link
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button onClick={share} variant="soft" className="mt-2">
              Share…
            </Button>
          )}
        </div>
      </Sheet>
    </>
  )
}
