import { notFound } from 'next/navigation'
import { NotFoundError } from './api'

/** Await an API call; a 404 from Blockscout renders the not-found page, anything else propagates. */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
}

/** Await an API call whose 404 is an answer (e.g. "this contract is not a token"): null then, anything else propagates. */
export async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p
  } catch (e) {
    if (e instanceof NotFoundError) return null
    throw e
  }
}

export type SP =Record<string, string | string[] | undefined>
export const one = (sp: SP, k: string): string | undefined => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
