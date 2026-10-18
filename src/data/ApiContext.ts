import { createContext, useContext } from 'react'
import type { Api, BeansApi, FriendsApi, GearApi, ProfileApi, RecipesApi } from './api'

export const ApiContext = createContext<Api | null>(null)

export function useApi(): Api {
  const api = useContext(ApiContext)
  if (!api) throw new Error('useApi must be used inside an ApiContext provider')
  return api
}

// Each area of hooks asks for just its part of the backend, so a profile hook cannot call a friends method.
export const useProfileApi = (): ProfileApi => useApi()
export const useGearApi = (): GearApi => useApi()
export const useBeansApi = (): BeansApi => useApi()
export const useRecipesApi = (): RecipesApi => useApi()
export const useFriendsApi = (): FriendsApi => useApi()
