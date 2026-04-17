const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("en-IN");

export function formatINR(value: number | null | undefined): string {
  if (value == null) return "—";
  return `₹${inrFmt.format(value)}`;
}

export function formatPoints(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${numFmt.format(value)} pts`;
}
