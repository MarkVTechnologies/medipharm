// Money arrives from the API as a float (cast once in the API Resource).
// Client-side arithmetic for cart previews is done in integer kobo.

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nairaCompact = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatNaira(value: number | null | undefined): string {
  return naira.format(value ?? 0);
}

export function formatNairaCompact(value: number | null | undefined): string {
  const v = value ?? 0;
  return Math.abs(v) < 100_000 ? formatNaira(v).replace(/\.00$/, "") : nairaCompact.format(v);
}

export function toKobo(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  return Math.round(Number(value) * 100);
}

export function fromKobo(kobo: number): number {
  return kobo / 100;
}

export function percentOf(kobo: number, percent: number): number {
  return Math.round((kobo * percent) / 100);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-NG").format(value ?? 0);
}
