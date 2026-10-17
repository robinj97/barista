// Placeholder data until the beans feature exists (build step 5).
export type SampleStatus = 'locked' | 'dialing' | 'new'

export interface SampleBean {
  id: string
  name: string
  roaster: string
  status: SampleStatus
  statusLabel: string
  tint: string
  pebble: string
  grams: number
}

export const sampleBeans: SampleBean[] = [
  { id: 'sample-1', name: 'Elto Arbegona', roaster: 'Coffea Circulor', status: 'locked', statusLabel: 'Locked', tint: 'bg-tint-sand', pebble: 'pebble-1', grams: 142 },
  { id: 'sample-2', name: 'Pink Bourbon', roaster: "Father's", status: 'dialing', statusLabel: 'Brew 3', tint: 'bg-tint-rose', pebble: 'pebble-2', grams: 220 },
  { id: 'sample-3', name: 'Tanzania Geisha', roaster: 'Placeholder Roasters', status: 'new', statusLabel: 'New', tint: 'bg-tint-sage', pebble: 'pebble-3', grams: 250 },
]
