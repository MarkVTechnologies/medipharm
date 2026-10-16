// Timestamps are UTC ISO 8601 from the API; render in Africa/Lagos (spec §6.3).

const TZ = "Africa/Lagos";

const dateFmt = new Intl.DateTimeFormat("en-NG", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-NG", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const timeFmt = new Intl.DateTimeFormat("en-NG", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  // Plain dates (YYYY-MM-DD) are calendar dates — don't shift them through a timezone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return dateFmt.format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFmt.format(new Date(value)) : "—";
}

export function formatTime(value: string | null | undefined): string {
  return value ? timeFmt.format(new Date(value)) : "—";
}

/** Today's date in Lagos as YYYY-MM-DD. */
export function lagosToday(offsetDays = 0): string {
  return isoDayFmt.format(new Date(Date.now() + offsetDays * 86_400_000));
}

export function relativeDays(days: number): string {
  if (days < 0) return `expired ${Math.abs(days)}d ago`;
  if (days === 0) return "expires today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDate(value);
}
