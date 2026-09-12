/**
 * How instants and USD amounts read on screen.
 *
 * The contract publishes ISO-8601 instants with fractional seconds and USD
 * amounts with exactly six fraction digits. Those are the wire shape the BFF
 * forwards. The Console is English, so neither belongs in a sentence a reader
 * is meant to use.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

const USD_AMOUNT = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/

const instantFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

const asLocalDay = (year: string, month: string, day: string): Date =>
  new Date(Number(year), Number(month) - 1, Number(day))

export const formatInstant = (value: string): string => {
  const dateOnly = DATE_ONLY.exec(value)
  if (dateOnly === null) {
    const instant = Date.parse(value)
    if (Number.isNaN(instant)) return value
    return instantFormat.format(new Date(instant))
  }

  const year = dateOnly[1]
  const month = dateOnly[2]
  const day = dateOnly[3]
  if (year === undefined || month === undefined || day === undefined) return value
  return dayFormat.format(asLocalDay(year, month, day))
}

export const formatUsdAmount = (amount: string): string => {
  if (!USD_AMOUNT.test(amount)) return amount
  if (!amount.includes(".")) return amount
  const trimmed = amount.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
  return trimmed
}

export const formatUsd = (amount: string): string => `USD ${formatUsdAmount(amount)}`
