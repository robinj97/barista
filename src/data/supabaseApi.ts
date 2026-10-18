import type { Api } from './api'
import { beansApi } from './supabase/beans'
import { friendsApi } from './supabase/friends'
import { gearApi } from './supabase/gear'
import { profileApi } from './supabase/profile'
import { recipesApi } from './supabase/recipes'

/** The real backend: Supabase. Each area lives in its own file under `supabase/`. */
export const supabaseApi: Api = { ...profileApi, ...gearApi, ...beansApi, ...recipesApi, ...friendsApi }
