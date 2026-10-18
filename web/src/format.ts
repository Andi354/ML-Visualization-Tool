// German number formatting: decimal comma, narrow no-break space as thousands separator.
const THIN = " ";

let decimal = ",";

/** The decimal sign (setting `look.decimal`): "," (default) or ".". */
export const setDecimal = (sign: string) => {
  decimal = sign;
};

export function formatNumber(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const fixed = Math.abs(v).toFixed(digits);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
  const sign = v < 0 && Number(fixed) !== 0 ? "−" : "";
  return sign + grouped + (frac ? decimal + frac : "");
}

export function formatInt(v: number | null | undefined): string {
  return formatNumber(v, 0);
}
