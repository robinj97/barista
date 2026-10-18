import { useAuth } from '../../auth/AuthContext'

/** The signed-in person's id. Only screens behind the sign-in gate use it. */
export function useUserId(): string {
  const { session } = useAuth()
  if (!session) throw new Error('Signed-in screens need a session')
  return session.user.id
}
