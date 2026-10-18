import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { BeansApi } from '../api'
import { BROWSE_LIMIT, ScanError, type Bag, type BagStatus, type BeanMatch, type ScannedBag, type SimilarBean } from '../types'
import { fail, toBean, toBeanMatch, type BeanRow } from './shared'

export const beansApi: BeansApi = {
  async listRoasters() {
    const { data, error } = await supabase.from('beans').select('roaster')
    fail(error)
    return data.map((row) => row.roaster)
  },

  async listMyBags(): Promise<Bag[]> {
    const { data, error } = await supabase
      .from('user_beans')
      .select('id, roast_date, grams_remaining, status, created_at, finished_at, beans(*)')
      .order('created_at', { ascending: false })
    fail(error)
    return (
      data as unknown as {
        id: string
        roast_date: string | null
        grams_remaining: number | null
        status: string
        created_at: string
        finished_at: string | null
        beans: BeanRow
      }[]
    ).map((row) => ({
      id: row.id,
      bean: toBean(row.beans),
      roastDate: row.roast_date,
      gramsRemaining: row.grams_remaining,
      status: row.status as BagStatus,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
    }))
  },

  async scanBag(imageBase64): Promise<ScannedBag> {
    const { data, error } = await supabase.functions.invoke<ScannedBag>('scan-bag', { body: { image: imageBase64 } })
    if (error) {
      if (!(error instanceof FunctionsHttpError)) throw new ScanError('failed')
      const response = error.context as Response
      const code = await response.json().then((body: { error?: string }) => body?.error, () => undefined)
      if (code === 'daily_limit') throw new ScanError('limit')
      throw new ScanError(response.status === 422 ? 'unreadable' : response.status === 429 ? 'busy' : 'failed')
    }
    if (!data) throw new ScanError('failed')
    return data
  },

  async browseBeans(): Promise<BeanMatch[]> {
    const { data, error } = await supabase.rpc('browse_beans', { max_results: BROWSE_LIMIT })
    fail(error)
    return data.map(toBeanMatch)
  },

  async searchBeans(query): Promise<BeanMatch[]> {
    const { data, error } = await supabase.rpc('search_beans', { q: query })
    fail(error)
    return data.map(toBeanMatch)
  },

  async findSimilarBeans(roaster, name): Promise<SimilarBean[]> {
    const { data, error } = await supabase.rpc('similar_beans', { p_roaster: roaster, p_name: name })
    fail(error)
    return data.map((row) => ({ bean: toBeanMatch(row), exact: row.exact }))
  },

  async addBag(input) {
    const { newBean } = input
    const { error } = await supabase.rpc('add_bag', {
      p_bag_id: input.bagId,
      p_bean_id: input.beanId,
      p_new_bean_id: input.newBeanId,
      p_new_bean: newBean
        ? {
            roaster: newBean.roaster,
            name: newBean.name,
            origin: newBean.origin ?? null,
            region: newBean.region ?? null,
            producer: newBean.producer ?? null,
            variety: newBean.variety ?? null,
            process: newBean.process ?? null,
            altitude_m: newBean.altitudeM ?? null,
            roast_level: newBean.roastLevel ?? null,
            roaster_notes: newBean.roasterNotes,
          }
        : undefined,
      p_roast_date: input.roastDate ?? undefined,
      p_grams: input.grams ?? undefined,
    })
    fail(error)
  },

  async updateBag(bagId, patch) {
    const row = {
      ...(patch.gramsRemaining !== undefined ? { grams_remaining: patch.gramsRemaining } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.roastDate !== undefined ? { roast_date: patch.roastDate } : {}),
      ...(patch.finishedAt !== undefined ? { finished_at: patch.finishedAt } : {}),
    }
    const { error } = await supabase.from('user_beans').update(row).eq('id', bagId)
    fail(error)
  },

  async removeBag(bagId) {
    const { error } = await supabase.from('user_beans').delete().eq('id', bagId)
    fail(error)
  },
}
