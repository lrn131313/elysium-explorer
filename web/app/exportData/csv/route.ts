import type { NextRequest } from 'next/server'
import { toCsv } from '@/lib/csv'
import { buildExport, isDay, isExportType, NotAnErc20, TooManyRecords, type ExportError } from '@/lib/export'
import { isAddress } from '@/lib/format'

/** The /exportData form's target: the CSV file, or back to the form (fields kept) saying what was wrong. */
export async function GET(req: NextRequest): Promise<Response> {
  const q = req.nextUrl.searchParams
  const form = { type: q.get('type'), a: q.get('a'), start: q.get('start'), end: q.get('end') }
  const back = (error: ExportError) => {
    const to = new URL('/exportData', req.nextUrl.origin)
    for (const [k, v] of Object.entries(form)) if (v !== null) to.searchParams.set(k, v)
    to.searchParams.set('error', error)
    return Response.redirect(to, 303)
  }

  const { type, a, start, end } = form
  if (type === null || !isExportType(type)) return back('type')
  if (a === null || !isAddress(a)) return back('address')
  if (start === null || end === null || !isDay(start) || !isDay(end) || start > end) return back('dates')

  try {
    const sheet = await buildExport(type, a, start, end)
    // A UTF-8 byte-order mark makes Excel read names with accents or symbols correctly.
    return new Response(`﻿${toCsv(sheet)}`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${sheet.name}"`,
        'cache-control': 'no-store',
      },
    })
  } catch (e) {
    if (e instanceof TooManyRecords) return back('limit')
    if (e instanceof NotAnErc20) return back('token')
    throw e
  }
}
