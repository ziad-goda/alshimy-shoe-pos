import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useQuery } from "@/lib/useDb";
import { EGP, NUM } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Printer, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/closing")({
  head: () => ({
    meta: [
      { title: "تقفيلة اليوم — AL SHIMY" },
      { name: "description", content: "تقرير نهاية اليوم مع توصيات ذكية للاستوك والتخفيضات." },
      { property: "og:title", content: "تقفيلة اليوم — AL SHIMY" },
      { property: "og:description", content: "ملخص يومي شامل." },
    ],
  }),
  component: Closing,
});

function Closing() {
  const kpi = useQuery<{ k: string; v: number }>(`
    SELECT 'sales' k, COALESCE(SUM(total),0) v FROM sales WHERE returned=0 AND date(date)=date('now','localtime')
    UNION ALL SELECT 'profit', COALESCE(SUM(profit),0) FROM sales WHERE returned=0 AND date(date)=date('now','localtime')
    UNION ALL SELECT 'expenses', COALESCE(SUM(amount),0) FROM expenses WHERE date(date)=date('now','localtime')
    UNION ALL SELECT 'purchases', COALESCE(SUM(total),0) FROM purchases WHERE date(date)=date('now','localtime')
    UNION ALL SELECT 'invoices', COUNT(*) FROM sales WHERE returned=0 AND date(date)=date('now','localtime')
    UNION ALL SELECT 'cash_all', COALESCE(SUM(total),0) FROM sales WHERE returned=0
    UNION ALL SELECT 'exp_all', COALESCE(SUM(amount),0) FROM expenses
    UNION ALL SELECT 'sup_paid_all', COALESCE(SUM(paid),0) FROM purchases
    UNION ALL SELECT 'sup_extra_all', COALESCE(SUM(amount),0) FROM supplier_payments
  `);
  const k = Object.fromEntries(kpi.data.map((r) => [r.k, r.v])) as Record<string, number>;
  const cash = (k.cash_all || 0) - (k.exp_all || 0) - (k.sup_paid_all || 0) - (k.sup_extra_all || 0);

  const best = useQuery<{ name: string; qty: number }>(
    `SELECT si.name, SUM(si.quantity) qty FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.returned=0 AND date(s.date)=date('now','localtime') GROUP BY si.name ORDER BY qty DESC LIMIT 1`
  );
  const mostProfit = useQuery<{ name: string; profit: number }>(
    `SELECT si.name, SUM((si.price-si.cost)*si.quantity) profit FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.returned=0 AND date(s.date)=date('now','localtime') GROUP BY si.name ORDER BY profit DESC LIMIT 1`
  );
  const lowStock = useQuery<{ name: string; quantity: number; size: string | null }>(
    `SELECT name, quantity, size FROM products WHERE quantity<=min_stock ORDER BY quantity ASC LIMIT 5`
  );
  const stale = useQuery<{ name: string; days: number }>(
    `SELECT p.name, CAST(julianday('now')-julianday(MAX(s.date)) AS INT) days FROM products p LEFT JOIN sale_items si ON si.product_id=p.id LEFT JOIN sales s ON s.id=si.sale_id AND s.returned=0 GROUP BY p.id HAVING days>=45 OR days IS NULL LIMIT 5`
  );

  return (
    <AppShell>
      <PageHeader title="تقفيلة اليوم" subtitle={new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={<Button variant="outline" onClick={() => window.print()}><Printer className="size-4 ml-1" />طباعة</Button>} />

      <div className="card-elevated p-6 max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <div className="text-3xl font-extrabold gradient-brand bg-clip-text text-transparent" style={{ WebkitBackgroundClip: "text" }}>AL SHIMY</div>
          <div className="text-sm text-muted-foreground">تقرير قفل اليوم</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Line label="مبيعات اليوم" value={EGP(k.sales || 0)} strong />
          <Line label="عدد الفواتير" value={NUM(k.invoices || 0)} />
          <Line label="أرباح اليوم" value={EGP(k.profit || 0)} strong />
          <Line label="مصروفات اليوم" value={EGP(k.expenses || 0)} />
          <Line label="مشتريات اليوم" value={EGP(k.purchases || 0)} />
          <Line label="النقدية المتبقية" value={EGP(cash)} strong />
        </div>

        <hr className="my-4" />
        <div className="space-y-2 text-sm">
          <Line label="الأكثر مبيعاً" value={best.data[0]?.name || "—"} />
          <Line label="الأعلى ربحاً" value={mostProfit.data[0]?.name || "—"} />
        </div>

        <hr className="my-4" />
        <div>
          <div className="font-bold mb-2">منتجات قاربت على الانتهاء</div>
          {lowStock.data.length === 0 ? <div className="text-sm text-muted-foreground">لا يوجد</div> : (
            <ul className="text-sm space-y-1">
              {lowStock.data.map((p) => (
                <li key={p.name}>• {p.name} {p.size ? `مقاس ${p.size}` : ""} — متبقي {NUM(p.quantity)}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 p-4 rounded-xl bg-[oklch(0.97_0.03_60)] border border-[oklch(0.85_0.12_60)]">
          <div className="flex items-center gap-2 font-bold mb-2 text-[oklch(0.35_0.1_60)]"><Lightbulb className="size-4" /> توصيات ذكية</div>
          <ul className="text-sm space-y-1 text-[oklch(0.3_0.08_60)]">
            {lowStock.data.map((p) => (<li key={"r" + p.name}>• قم بإعادة تعبئة {p.name} {p.size ? `مقاس ${p.size}` : ""}.</li>))}
            {stale.data.filter((s) => s.days >= 45).map((s) => (<li key={"s" + s.name}>• فكّر في تخفيض سعر {s.name} — لم يُبع منذ {s.days} يوماً.</li>))}
            {lowStock.data.length === 0 && stale.data.length === 0 && <li>الأداء جيد — لا توجد توصيات عاجلة.</li>}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function Line({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={"flex justify-between border-b py-2 " + (strong ? "font-bold text-base" : "")}>
      <span className="text-muted-foreground font-normal">{label}</span>
      <span>{value}</span>
    </div>
  );
}
