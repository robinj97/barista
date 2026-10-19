/** Every query key in one place, so a screen that changes something can name exactly what it made stale. */
export const keys = {
  profile: (userId: string) => ['profile', userId] as const,
  features: (userId: string) => ['features', userId] as const,
  grinders: {
    catalogue: ['grinders', 'catalogue'] as const,
    mine: (userId: string) => ['grinders', 'mine', userId] as const,
  },
  filters: {
    catalogue: ['filters', 'catalogue'] as const,
    mine: (userId: string) => ['filters', 'mine', userId] as const,
  },
  bags: ['bags', 'mine'] as const,
  beans: {
    search: (query: string) => ['beans', 'search', query] as const,
    /** Every search, whatever was typed. */
    searches: ['beans', 'search'] as const,
    catalogue: ['beans', 'catalogue'] as const,
    roasters: ['beans', 'roasters'] as const,
  },
  drafts: ['drafts'] as const,
  recipes: ['recipes'] as const,
  friends: ['friends'] as const,
  friendRecipes: ['friend-recipes'] as const,
  invites: ['invites'] as const,
  invite: (token: string) => ['invite', token] as const,
}
