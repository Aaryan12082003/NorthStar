import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

export function iso(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function calendarDay(value: Date | string, timeZone: string) {
  return formatInTimeZone(new Date(value), timeZone, 'yyyy-MM-dd')
}

export function dayDiff(deadline: Date | string, timeZone: string, now = new Date()) {
  const start = new Date(`${calendarDay(now, timeZone)}T00:00:00Z`)
  const end = new Date(`${calendarDay(deadline, timeZone)}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

export function zonedDateTime(date: string, time: string, timeZone: string) {
  return fromZonedTime(`${date}T${time}:00`, timeZone)
}

export function addInterval(value: Date, frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY', interval: number) {
  const next = new Date(value)
  if (frequency === 'DAILY') next.setUTCDate(next.getUTCDate() + interval)
  if (frequency === 'WEEKLY') next.setUTCDate(next.getUTCDate() + interval * 7)
  if (frequency === 'MONTHLY') next.setUTCMonth(next.getUTCMonth() + interval)
  return next
}

export function hoursBetween(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(0, ms / 3_600_000)
}
