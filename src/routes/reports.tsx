import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { useQuery } from "@/lib/useDb";
import { EGP, NUM } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "التقارير — AL SHIMY" },
      { name: "description", content: "تقارير المبيعات والمشتريات والمصروفات والأرباح." },
      { property: "og:title", content: "التقارير — AL SHIMY" },
      { property: "og:description", content: "يومي / أسبوعي / شهري / سنوي." },
    ],
  }),
  component: ReportsPage,
});

const RANGES = {
  today: "date(date)=date('now','localtime')",
  yesterday: "date(date)=date('now','-1 day','localtime')",
  week: "date(date)>=date('now','-6 day','localtime')",
  month: "date(date)>=date('now','start of month','localtime')",
  year: "date(date)>=date('now','start of year','localtime')",
} as const;

type RangeKey = keyof typeof RANGES;

function ReportsPage() {
  const [range, setRange] = useState<RangeKey>("today");

  const kpi = useQuery<{ k: string; v: number }>(
    `SELECT 'sales' k, COALESCE(SUM(total),0) v FROM sales WHERE returned=0 AND ${RANGES[range]}
     UNION ALL SELECT 'profit', COALESCE(SUM(profit),0) FROM sales WHERE returned=0 AND ${RANGES[range]}
     UNION ALL SELECT 'purchases', COALESCE(SUM(total),0) FROM purchases WHERE ${RANGES[range]}
     UNION ALL SELECT 'expenses', COALESCE(SUM(amount),0) FROM expenses WHERE ${RANGES[range]}
     UNION ALL SELECT 'invoices', COUNT(*) FROM sales WHERE returned=0 AND ${RANGES[range]}`,
    [], [range]
  );
  const k = Object.fromEntries(kpi.data.map((r) => [r.k, r.v])) as Record<string, number>;
  const net = (k.profit || 0) - (k.expenses || 0);

  const sales = useQuery<{ id: number; date: string; total: number; profit: number }>(
    `SELECT id, date, total, profit FROM sales WHERE returned=0 AND ${RANGES[range]} ORDER BY id DESC`, [], [range]
  );
  const purchases = useQuery<{ id: number; date: string; total: number; paid: number }>(
    `SELECT id, date, total, paid FROM purchases WHERE ${RANGES[range]} ORDER BY id DESC`, [], [range]
  );
  const expenses = useQuery<{ id: number; date: string; category: string; amount: number }>(
    `SELECT id, date, category, amount FROM expenses WHERE ${RANGES[range]} ORDER BY id DESC`, [], [range]
  );

  const exportCsv = (name: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = "\uFEFF" + [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const labels: Record<RangeKey, string> = {
    today: "اليوم", yesterday: "الأمس", week: "آخر أسبوع", month: "الشهر الحالي", year: "السنة الحالية",
  };

  return (
    <AppShell>
      <PageHeader title="التقارير" subtitle="تقارير جاهزة قابلة للطباعة والتصدير" actions={
        <Button variant="outline" onClick={() => window.print()}><Printer className="size-4 ml-1" />طباعة</Button>
      } />

      <div className="card-elevated p-3 mb-4">
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList className="grid grid-cols-5">
            {(Object.keys(RANGES) as RangeKey[]).map((r) => (
              <TabsTrigger key={r} value={r}>{labels[r]}</TabsTrigger>
            ))}
          </TabsList>
          {(Object.keys(RANGES) as RangeKey[]).map((r) => <TabsContent key={r} value={r} />)}
        </Tabs>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <StatCard title="المبيعات" value={EGP(k.sales || 0)} tone="accent" />
        <StatCard title="الربح الإجمالي" value={EGP(k.profit || 0)} tone="success" />
        <StatCard title="المشتريات" value={EGP(k.purchases || 0)} />
        <StatCard title="المصروفات" value={EGP(k.expenses || 0)} />
        <StatCard title="صافي الربح" value={EGP(net)} tone={net >= 0 ? "success" : "destructive"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ReportTable
          title={`المبيعات (${NUM(k.invoices || 0)} فاتورة)`}
          rows={sales.data}
          onExport={() => exportCsv("sales-" + range, sales.data)}
          columns={[
            { k: "id", label: "#" },
            { k: "date", label: "التاريخ", fmt: (v) => new Date(String(v)).toLocaleString("ar-EG") },
            { k: "total", label: "الإجمالي", fmt: (v) => EGP(Number(v)) },
            { k: "profit", label: "الربح", fmt: (v) => EGP(Number(v)) },
          ]}
        />
        <ReportTable
          title="المشتريات"
          rows={purchases.data}
          onExport={() => exportCsv("purchases-" + range, purchases.data)}
          columns={[
            { k: "id", label: "#" },
            { k: "date", label: "التاريخ", fmt: (v) => new Date(String(v)).toLocaleString("ar-EG") },
            { k: "total", label: "الإجمالي", fmt: (v) => EGP(Number(v)) },
            { k: "paid", label: "المدفوع", fmt: (v) => EGP(Number(v)) },
          ]}
        />
        <ReportTable
          title="المصروفات"
          rows={expenses.data}
          onExport={() => exportCsv("expenses-" + range, expenses.data)}
          columns={[
            { k: "date", label: "التاريخ", fmt: (v) => new Date(String(v)).toLocaleString("ar-EG") },
            { k: "category", label: "التصنيف" },
            { k: "amount", label: "المبلغ", fmt: (v) => EGP(Number(v)) },
          ]}
        />
      </div>
    </AppShell>
  );
}

function ReportTable({ title, rows, columns, onExport }: {
  title: string;
  rows: Record<string, unknown>[];
  columns: { k: string; label: string; fmt?: (v: unknown) => string }[];
  onExport: () => void;
}) {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b bg-secondary/40">
        <div className="font-bold">{title}</div>
        <Button size="sm" variant="outline" onClick={onExport}><FileSpreadsheet className="size-3.5 ml-1" />CSV</Button>
      </div>
      <div className="max-h-[52vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 sticky top-0"><tr className="text-right">
            {columns.map((c) => <th key={c.k} className="p-2 text-xs">{c.label}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={columns.length} className="text-center py-8 text-muted-foreground">لا توجد بيانات</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {columns.map((c) => <td key={c.k} className="p-2">{c.fmt ? c.fmt(r[c.k]) : String(r[c.k] ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
