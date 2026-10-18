import type {
  AddBagInput,
  Bag,
  BagPatch,
  BeanMatch,
  CatalogueGrinder,
  Draft,
  FilterRow,
  Friend,
  FriendRecipe,
  InviterPreview,
  LockedRecipe,
  LockRecipeInput,
  MyFilter,
  MyGrinder,
  NewFilter,
  PendingInvite,
  Profile,
  ProfilePatch,
  SaveDraftInput,
  ScannedBag,
  SimilarBean,
} from './types'

/**
 * What the app needs from the backend, in areas that each stand on their own. The real and the fake
 * implementation both provide all of it; hooks ask for just the area they use (see `ApiContext`), so a
 * profile hook cannot call a friends method.
 */

export interface ProfileApi {
  getProfile(userId: string): Promise<Profile>
  updateProfile(userId: string, patch: ProfilePatch): Promise<Profile>
}

/** Grinders and filters: the shared catalogues and the person's own lists. */
export interface GearApi {
  listGrinderCatalogue(): Promise<CatalogueGrinder[]>
  listMyGrinders(): Promise<MyGrinder[]>
  addMyGrinder(grinderId: string): Promise<void>
  removeMyGrinder(grinderId: string): Promise<void>

  listFilterCatalogue(): Promise<FilterRow[]>
  listMyFilters(): Promise<MyFilter[]>
  /**
   * Adds a catalogue filter to the user's list; it becomes the default when the list has none.
   * Adding one that is already in the list does nothing.
   */
  addMyFilter(filterId: string): Promise<void>
  /** Adds a new filter to the shared catalogue, or returns the existing match. */
  createFilter(input: NewFilter): Promise<FilterRow>
  setDefaultFilter(filterId: string): Promise<void>
  /** Removes a filter from the user's list. Removing the default promotes another one. */
  removeMyFilter(filterId: string): Promise<void>
}

/** The shared bean catalogue and the person's own bags. */
export interface BeansApi {
  /** Roasters that already exist in the shared catalogue, for matching and type-ahead. */
  listRoasters(): Promise<string[]>
  listMyBags(): Promise<Bag[]>
  /** Reads a bag photo (base64 JPEG) with Claude. Throws `ScanError` when the scan cannot run. */
  scanBag(imageBase64: string): Promise<ScannedBag>
  /** The catalogue in alphabetical order (roaster, then name), up to `BROWSE_LIMIT` beans. */
  browseBeans(): Promise<BeanMatch[]>
  /** Catalogue search: every word matches roaster + name in any order, tolerant of small typos. */
  searchBeans(query: string): Promise<BeanMatch[]>
  /** Catalogue beans that are the same coffee (same dedupe key) or look very alike, for the "is it one of these?" check before a new bean is created. */
  findSimilarBeans(roaster: string, name: string): Promise<SimilarBean[]>
  /**
   * Adds a bag, creating the shared bean first when needed. Idempotent for the same `bagId`.
   * An exact roaster + name match reuses the existing catalogue bean.
   */
  addBag(input: AddBagInput): Promise<void>
  removeBag(bagId: string): Promise<void>
  /** Changes what is yours about a bag: how much is left, or where you are with it. */
  updateBag(bagId: string, patch: BagPatch): Promise<void>
}

/** The person's own recipes: the working copy per bean, and the ones they have locked in. */
export interface RecipesApi {
  /** Your working recipes: one per bean and method, overwritten as you brew. */
  listMyDrafts(): Promise<Draft[]>
  /** Creates or overwrites the working recipe. Leaving `lastBrew` out keeps the stored one. */
  saveDraft(input: SaveDraftInput): Promise<void>
  /** The recipes you have locked in, with their current locked version. */
  listMyRecipes(): Promise<LockedRecipe[]>
  /** Locks a brew in as your recipe. Idempotent for the same `brewId`. */
  lockRecipe(input: LockRecipeInput): Promise<void>
  /** Stops friends seeing a locked recipe and removes it from your lists. Your brews are kept. */
  archiveRecipe(recipeId: string): Promise<void>
}

/** Friends, invite links, and the recipes friends have locked. */
export interface FriendsApi {
  listFriends(): Promise<Friend[]>
  /** Ends a friendship, for both of you. Recipes you already brewed from theirs stay yours. */
  removeFriend(friendId: string): Promise<void>
  /** Invite links you made that nobody has used yet and that have not expired. */
  listMyInvites(): Promise<PendingInvite[]>
  /** Makes a single-use link token. It is shown once: only a hash is stored. */
  createInvite(): Promise<string>
  cancelInvite(inviteId: string): Promise<void>
  /** Who an invite link is from. Fails the same way for every bad link. */
  peekInvite(token: string): Promise<InviterPreview>
  acceptInvite(token: string): Promise<InviterPreview>
  /** Locked recipes your friends have made, newest first. */
  listFriendRecipes(): Promise<FriendRecipe[]>
}

export interface Api extends ProfileApi, GearApi, BeansApi, RecipesApi, FriendsApi {}
