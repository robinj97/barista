import { describe, expect, it, vi } from 'vitest'
import { createMockApi } from '../dev/mockApi'
import { enqueue, flushOutbox, isNetworkError, pendingCount, readOutbox } from './outbox'
import type { BrewResult, SaveDraftInput } from './types'

const choices = { bagId: 'bag-b-geisha', balance: 0, strength: 'medium', grinderId: null, filterId: null, cups: 2, edits: {} } as const
const result: BrewResult = { brewedAt: '2026-10-17T08:00:00Z', totalTimeS: 170, tastes: ['good'], improve: [], compared: null, yieldG: null, notes: '', firstPourG: 60 }
const draft = (extra: Partial<SaveDraftInput> = {}): SaveDraftInput => ({ beanId: 'b-geisha', method: 'v60', choices, ...extra })

describe('outbox', () => {
  it('keeps one entry per draft and keeps the last brew result when a newer draft has none', () => {
    enqueue({ key: 'draft:b-geisha:v60', kind: 'draft', input: draft({ lastBrew: result }) })
    enqueue({ key: 'draft:b-geisha:v60', kind: 'draft', input: draft({ choices: { ...choices, cups: 3 } }) })
    const [entry] = readOutbox()
    expect(readOutbox()).toHaveLength(1)
    expect(entry?.kind === 'draft' && entry.input.choices.cups).toBe(3)
    expect(entry?.kind === 'draft' && entry.input.lastBrew).toEqual(result)
  })

  it('adds up waiting changes to one bag, and never moves a locked bag back to dialing in', () => {
    enqueue({ key: 'bag:x', kind: 'bag', bagId: 'x', patch: { gramsRemaining: 230, status: 'locked' } })
    enqueue({ key: 'bag:x', kind: 'bag', bagId: 'x', patch: { gramsRemaining: 210, status: 'dialing_in' } })
    expect(readOutbox()).toHaveLength(1)
    expect(readOutbox()[0]).toMatchObject({ kind: 'bag', patch: { gramsRemaining: 210, status: 'locked' } })
  })

  it('recognises a dropped connection', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('bag_not_found'))).toBe(false)
  })

  it('sends what is waiting and empties the queue', async () => {
    const api = createMockApi()
    const save = vi.spyOn(api, 'saveDraft')
    enqueue({ key: 'a', kind: 'draft', input: draft() })
    expect(await flushOutbox(api)).toBe(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(pendingCount()).toBe(0)
  })

  it('stops at a dropped connection and keeps everything for later', async () => {
    let offline = true
    const api = createMockApi({ isOffline: () => offline })
    enqueue({ key: 'a', kind: 'draft', input: draft() })
    enqueue({ key: 'b', kind: 'draft', input: draft({ beanId: 'b-elto' }) })
    expect(await flushOutbox(api)).toBe(0)
    expect(pendingCount()).toBe(2)
    offline = false
    expect(await flushOutbox(api)).toBe(2)
    expect(pendingCount()).toBe(0)
  })

  it('drops an entry the server refuses for good, so it cannot block the rest', async () => {
    const api = createMockApi()
    vi.spyOn(api, 'saveDraft').mockRejectedValueOnce(new Error('invalid'))
    enqueue({ key: 'a', kind: 'draft', input: draft() })
    enqueue({ key: 'b', kind: 'draft', input: draft({ beanId: 'b-elto' }) })
    expect(await flushOutbox(api)).toBe(2)
    expect(pendingCount()).toBe(0)
  })
})
