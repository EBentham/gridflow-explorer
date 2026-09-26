/**
 * Reading through a `DataSource`: the manifest (one read shared by every
 * page, kept five minutes) and rows (one request per dataset, aborted when
 * the window or query changes). While gridflow holds the store for a refresh
 * (`refresh_in_progress`) both ask again every 15 seconds, as the pinned
 * screens do.
 */
import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { REFRESH_RETRY_MS } from '../../hooks/latestDays'
import type { DataSource, Manifest, RowsRequest, RowsResponse } from '../contract'

export type LoadState = 'loading' | 'data' | 'error' | 'refreshing'

export interface Load<T> {
  state: LoadState
  value: T | null
  error: ApiError | null
}

const LOADING: Load<never> = { state: 'loading', value: null, error: null }

const toApiError = (err: unknown) => (err instanceof ApiError ? err : new ApiError('unknown_error', err instanceof Error ? err.message : String(err)))
const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError'

function failed<T>(err: unknown): Load<T> {
  const error = toApiError(err)
  return { state: error.code === 'refresh_in_progress' ? 'refreshing' : 'error', value: null, error }
}

const MANIFEST_TTL_MS = 5 * 60 * 1000
const manifests = new WeakMap<DataSource, { at: number; promise: Promise<Manifest> }>()

function readManifest(ds: DataSource): Promise<Manifest> {
  const hit = manifests.get(ds)
  if (hit && Date.now() - hit.at < MANIFEST_TTL_MS) return hit.promise
  const promise = ds.manifest()
  manifests.set(ds, { at: Date.now(), promise })
  // A failed read isn't kept: the next page, or the retry, asks again.
  promise.catch(() => manifests.delete(ds))
  return promise
}

export function useManifest(ds: DataSource): Load<Manifest> {
  const [load, setLoad] = useState<Load<Manifest>>(LOADING)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    readManifest(ds).then(
      (value) => live && setLoad({ state: 'data', value, error: null }),
      (err: unknown) => live && setLoad(failed(err)),
    )
    return () => {
      live = false
    }
  }, [ds, tick])

  useEffect(() => {
    if (load.state !== 'refreshing') return undefined
    const timer = window.setTimeout(() => setTick((n) => n + 1), REFRESH_RETRY_MS)
    return () => window.clearTimeout(timer)
  }, [load.state])

  return load
}

/**
 * Rows for every request in `requests`, in parallel, in the same order. The
 * list is compared by value, so a fresh array with the same requests doesn't
 * fetch again. A result for an earlier list reads as loading.
 */
export function useRowsList(ds: DataSource, requests: RowsRequest[]): Load<RowsResponse>[] {
  const key = JSON.stringify(requests)
  const [held, setHeld] = useState<{ key: string; loads: Load<RowsResponse>[] }>({ key: '', loads: [] })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const list = JSON.parse(key) as RowsRequest[]
    if (!list.length) return undefined
    const controller = new AbortController()
    setHeld({ key, loads: list.map(() => LOADING) })
    list.forEach((req, i) => {
      const put = (load: Load<RowsResponse>) =>
        setHeld((prev) => (prev.key === key ? { key, loads: prev.loads.map((l, j) => (j === i ? load : l)) } : prev))
      ds.rows(req, controller.signal).then(
        (value) => put({ state: 'data', value, error: null }),
        (err: unknown) => {
          if (!isAbort(err)) put(failed(err))
        },
      )
    })
    return () => controller.abort()
  }, [ds, key, tick])

  const current = held.key === key ? held.loads : null
  const refreshing = current?.some((l) => l.state === 'refreshing') ?? false
  useEffect(() => {
    if (!refreshing) return undefined
    const timer = window.setTimeout(() => setTick((n) => n + 1), REFRESH_RETRY_MS)
    return () => window.clearTimeout(timer)
  }, [refreshing])

  return current ?? requests.map(() => LOADING)
}
