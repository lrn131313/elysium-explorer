// Etherscan's "Download Page Data": the rows on screen, as a CSV file built in the browser. Pure; no server imports.

export interface Sheet {
  /** File name offered to the browser. */
  name: string
  header: string[]
  rows: string[][]
}

/**
 * One CSV cell. Quoted when it holds a comma, quote or line break. Token names, symbols and name tags are chosen by
 * whoever deployed a contract, so a cell that a spreadsheet would read as a formula (=, +, -, @, tab, CR first) gets a
 * leading apostrophe and is kept as text.
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function toCsv(sheet: Sheet): string {
  return [sheet.header, ...sheet.rows].map((row) => row.map(cell).join(',')).join('\r\n')
}

/**
 * Reads CSV text (RFC 4180: quoted fields, "" for a quote, CRLF or LF line ends) into rows of cells. A trailing line
 * break does not make an extra empty row. Throws on a quote left open, which means the text was cut short.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (quoted) throw new Error('CSV ends inside a quoted field')
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}
