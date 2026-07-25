export const EGP = (n: number) =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

export const NUM = (n: number) =>
  new Intl.NumberFormat("ar-EG").format(Math.round(Number(n) || 0));

export const DATE = (iso: string | Date) => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

export const DATETIME = (iso: string | Date) => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
};

export const todayISO = () => new Date().toISOString();
export const isSameDay = (a: string, b: Date) =>
  new Date(a).toDateString() === b.toDateString();

export const CATEGORIES = [
  { value: "shoes", label: "أحذية" },
  { value: "slippers", label: "شباشب" },
  { value: "belts", label: "أحزمة" },
] as const;

export const catLabel = (v: string) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? v;
