import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useQuery } from "@/lib/useDb";
import { EGP, NUM, catLabel } from "@/lib/format";
import { Trophy, TrendingUp, Snowflake, PackageCheck, Ruler, Palette, Layers, Flame, AlertTriangle, PackagePlus, Percent } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "التحليل الذكي — AL SHIMY" },
      { name: "description", content: "تحليل تلقائي للأداء والمنتجات والأصناف." },
      { property: "og:title", content: "التحليل الذكي — AL SHIMY" },
      { property: "og:description", content: "أعلى مبيعات، أعلى ربح، منتجات راكدة، وأكثر." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const best = useQuery<{ name: string; qty: number }>(`SELECT si.name, SUM(si.quantity) qty FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.returned=0 GROUP BY si.name ORDER BY qty DESC LIMIT 5`);
  const worst = useQuery<{ name: string; qty: number }>(`SELECT si.name, SUM(si.quantity) qty FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.returned=0 GROUP BY si.name ORDER BY qty ASC LIMIT 5`);
  const mostProfit = useQuery<{ name: string; profit: number }>(`SELECT si.name, SUM((si.price-si.cost)*si.quantity) profit FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.returned=0 GROUP BY si.name ORDER BY profit DESC LIMIT 5`);
  const noSell30 = useQuery<{ name: string }>(`SELECT p.name FROM products p LEFT JOIN sale_items si ON si.product_id=p.id LEFT JOIN sales s ON s.id=si.sale_id AND s.returned=0 AND date(s.date)>=date('now','-30 day') GROUP BY p.id HAVING COALESCE(SUM(si.quantity),0)=0 LIMIT 10`);
  const bySize = useQuery<{ size: string; qty: number }>(`SELECT COALESCE(p.size,'—') size, SUM(si.quantity) qty FROM sale_items si JOIN products p ON p.id=si.product_id JOIN sales s ON s.id=si.sale_id WHERE s.returned=0 GROUP BY p.size ORDER BY qty DESC LIMIT 6`);
  const byColor = useQuery<{ color: string; qty: number }>(`SELECT COALESCE(p.color,'—') color, SUM(si.quantity) qty FROM sale_items si JOIN products p ON p.id=si.product_id JOIN sales s ON s.id=si.sale_id WHERE s.returned=0 GROUP BY p.color ORDER BY qty DESC LIMIT 6`);
  const catProfit = useQuery<{ category: string; profit: number }>(`SELECT p.category, SUM((si.price-si.cost)*si.quantity) profit FROM sale_items si JOIN products p ON p.id=si.product_id JOIN sales s ON s.id=si.sale_id WHERE s.returned=0 GROUP BY p.category ORDER BY profit DESC`);
  const catSales = useQuery<{ category: string; qty: number }>(`SELECT p.category, SUM(si.quantity) qty FROM sale_items si JOIN products p ON p.id=si.product_id JOIN sales s ON s.id=si.sale_id WHERE s.returned=0 GROUP BY p.category ORDER BY qty DESC`);
  const restock = useQuery<{ name: string; quantity: number; min_stock: number }>(`SELECT name, quantity, min_stock FROM products WHERE quantity<=min_stock ORDER BY quantity ASC LIMIT 10`);
  const overStock = useQuery<{ name: string; quantity: number }>(`SELECT name, quantity FROM products WHERE quantity > min_stock*5 AND min_stock>0 ORDER BY quantity DESC LIMIT 5`);
  const needDiscount = useQuery<{ name: string; days: number }>(`SELECT p.name, CAST(julianday('now') - julianday(MAX(s.date)) AS INT) days FROM products p JOIN sale_items si ON si.product_id=p.id JOIN sales s ON s.id=si.sale_id WHERE s.returned=0 GROUP BY p.id HAVING days>=45 ORDER BY days DESC LIMIT 5`);

  return (
    <AppShell>
      <PageHeader title="التحليل الذكي" subtitle="النظام يحلل بياناتك ويقدم رؤى تلقائية" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Panel title="الأعلى مبيعاً" icon={<Trophy className="size-5" />} tone="accent">
          {best.data.map((r) => <Row key={r.name} name={r.name} value={NUM(r.qty)} />)}
        </Panel>
        <Panel title="الأعلى ربحاً" icon={<TrendingUp className="size-5" />} tone="success">
          {mostProfit.data.map((r) => <Row key={r.name} name={r.name} value={EGP(r.profit)} />)}
        </Panel>
        <Panel title="الأقل مبيعاً" icon={<Snowflake className="size-5" />}>
          {worst.data.map((r) => <Row key={r.name} name={r.name} value={NUM(r.qty)} />)}
        </Panel>

        <Panel title="لم يُبع منذ 30 يوم" icon={<PackageCheck className="size-5" />}>
          {noSell30.data.length === 0 && <Empty />}
          {noSell30.data.map((r) => <Row key={r.name} name={r.name} value="—" />)}
        </Panel>
        <Panel title="أكثر المقاسات طلباً" icon={<Ruler className="size-5" />}>
          {bySize.data.map((r) => <Row key={r.size} name={r.size} value={NUM(r.qty)} />)}
        </Panel>
        <Panel title="أكثر الألوان طلباً" icon={<Palette className="size-5" />}>
          {byColor.data.map((r) => <Row key={r.color} name={r.color} value={NUM(r.qty)} />)}
        </Panel>

        <Panel title="أعلى تصنيف ربحاً" icon={<Layers className="size-5" />} tone="success">
          {catProfit.data.map((r) => <Row key={r.category} name={catLabel(r.category)} value={EGP(r.profit)} />)}
        </Panel>
        <Panel title="أعلى تصنيف مبيعاً" icon={<Flame className="size-5" />} tone="accent">
          {catSales.data.map((r) => <Row key={r.category} name={catLabel(r.category)} value={NUM(r.qty)} />)}
        </Panel>
        <Panel title="بحاجة إعادة تعبئة" icon={<AlertTriangle className="size-5" />} tone="warning">
          {restock.data.length === 0 && <Empty />}
          {restock.data.map((r) => <Row key={r.name} name={r.name} value={`${NUM(r.quantity)} / ${NUM(r.min_stock)}`} />)}
        </Panel>
        <Panel title="مخزون مرتفع" icon={<PackagePlus className="size-5" />}>
          {overStock.data.length === 0 && <Empty />}
          {overStock.data.map((r) => <Row key={r.name} name={r.name} value={NUM(r.quantity)} />)}
        </Panel>
        <Panel title="يحتاج تخفيض (45+ يوم)" icon={<Percent className="size-5" />} tone="warning">
          {needDiscount.data.length === 0 && <Empty />}
          {needDiscount.data.map((r) => <Row key={r.name} name={r.name} value={`${r.days} يوم`} />)}
        </Panel>
      </div>
    </AppShell>
  );
}

function Panel({ title, icon, tone = "default", children }: { title: string; icon: ReactNode; tone?: "default" | "accent" | "success" | "warning"; children: ReactNode }) {
  const t: Record<string, string> = {
    default: "bg-secondary/60 text-foreground",
    accent: "gradient-accent text-white",
    success: "bg-[oklch(0.62_0.16_155)] text-white",
    warning: "bg-[oklch(0.78_0.16_80)] text-[oklch(0.25_0.05_60)]",
  };
  return (
    <div className="card-elevated overflow-hidden">
      <div className={"flex items-center gap-2 p-3 " + t[tone]}>
        <div className="size-8 rounded-lg bg-white/25 grid place-items-center">{icon}</div>
        <div className="font-bold">{title}</div>
      </div>
      <div className="p-3 space-y-1.5 text-sm">{children}</div>
    </div>
  );
}
function Row({ name, value }: { name: string; value: ReactNode }) {
  return <div className="flex justify-between border-b last:border-0 py-1.5"><span className="truncate">{name}</span><span className="font-semibold">{value}</span></div>;
}
function Empty() { return <div className="text-muted-foreground text-center py-4 text-xs">لا توجد بيانات</div>; }
