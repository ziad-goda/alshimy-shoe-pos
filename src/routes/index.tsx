import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { useQuery } from "@/lib/useDb";
import { EGP, NUM } from "@/lib/format";
import {
  DollarSign,
  TrendingUp,
  Truck,
  Wallet,
  Receipt,
  AlertTriangle,
  Trophy,
  Award,
  Snowflake,
  PackageX,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — AL SHIMY" },
      { name: "description", content: "ملخص المبيعات والأرباح والمخزون اليومي لمحل AL SHIMY." },
      { property: "og:title", content: "لوحة التحكم — AL SHIMY" },
      { property: "og:description", content: "ملخص شامل ليومك من المبيعات والأرباح." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);

  const kpi = useQuery<{ k: string; v: number }>(
    `
    SELECT 'sales_today' k, COALESCE(SUM(total),0) v FROM sales WHERE date(date)=date('now','localtime') AND returned=0
    UNION ALL SELECT 'profit_today', COALESCE(SUM(profit),0) FROM sales WHERE date(date)=date('now','localtime') AND returned=0
    UNION ALL SELECT 'purchases_today', COALESCE(SUM(total),0) FROM purchases WHERE date(date)=date('now','localtime')
    UNION ALL SELECT 'invoices_today', COUNT(*) FROM sales WHERE date(date)=date('now','localtime') AND returned=0
    UNION ALL SELECT 'sales_total', COALESCE(SUM(total),0) FROM sales WHERE returned=0
    UNION ALL SELECT 'profit_total', COALESCE(SUM(profit),0) FROM sales WHERE returned=0
    UNION ALL SELECT 'purchases_total', COALESCE(SUM(total),0) FROM purchases
    UNION ALL SELECT 'expenses_total', COALESCE(SUM(amount),0) FROM expenses
    UNION ALL SELECT 'supplier_paid', COALESCE(SUM(paid),0) FROM purchases
    UNION ALL SELECT 'supplier_payments', COALESCE(SUM(amount),0) FROM supplier_payments
    UNION ALL SELECT 'inventory_value', COALESCE(SUM(purchase_price*quantity),0) FROM products
    `
  );
  const k = Object.fromEntries(kpi.data.map((r) => [r.k, r.v])) as Record<string, number>;
  const cashInHand = (k.sales_total || 0) - (k.expenses_total || 0) - (k.supplier_paid || 0) - (k.supplier_payments || 0);

  const lowStock = useQuery<{ c: number }>(
    `SELECT COUNT(*) c FROM products WHERE quantity <= min_stock AND quantity > 0`
  );
  const outStock = useQuery<{ c: number }>(
    `SELECT COUNT(*) c FROM products WHERE quantity = 0`
  );

  const best = useQuery<{ name: string; qty: number }>(
    `SELECT si.name, SUM(si.quantity) qty FROM sale_items si
     JOIN sales s ON s.id=si.sale_id WHERE s.returned=0
     GROUP BY si.name ORDER BY qty DESC LIMIT 1`
  );
  const mostProfit = useQuery<{ name: string; profit: number }>(
    `SELECT si.name, SUM((si.price - si.cost) * si.quantity) profit FROM sale_items si
     JOIN sales s ON s.id=si.sale_id WHERE s.returned=0
     GROUP BY si.name ORDER BY profit DESC LIMIT 1`
  );

  const daily = useQuery<{ d: string; sales: number; profit: number }>(
    `SELECT date(date) d, SUM(total) sales, SUM(profit) profit FROM sales
     WHERE returned=0 AND date(date) >= date('now','-13 day','localtime')
     GROUP BY date(date) ORDER BY d`
  );
  const purchasesChart = useQuery<{ d: string; total: number }>(
    `SELECT date(date) d, SUM(total) total FROM purchases
     WHERE date(date) >= date('now','-13 day','localtime')
     GROUP BY date(date) ORDER BY d`
  );

  const topProducts = useQuery<{ name: string; qty: number }>(
    `SELECT si.name, SUM(si.quantity) qty FROM sale_items si
     JOIN sales s ON s.id=si.sale_id WHERE s.returned=0
     GROUP BY si.name ORDER BY qty DESC LIMIT 6`
  );

  const slow = useQuery<{ name: string }>(
    `SELECT p.name FROM products p
     LEFT JOIN sale_items si ON si.product_id=p.id
     LEFT JOIN sales s ON s.id=si.sale_id AND s.returned=0 AND date(s.date)>=date('now','-30 day')
     GROUP BY p.id HAVING COALESCE(SUM(si.quantity),0)=0 LIMIT 5`
  );

  // Merge sales & purchases per day
  const dateMap = new Map<string, { d: string; sales: number; profit: number; purchases: number }>();
  daily.data.forEach((r) => dateMap.set(r.d, { d: r.d, sales: r.sales, profit: r.profit, purchases: 0 }));
  purchasesChart.data.forEach((r) => {
    const cur = dateMap.get(r.d) ?? { d: r.d, sales: 0, profit: 0, purchases: 0 };
    cur.purchases = r.total;
    dateMap.set(r.d, cur);
  });
  const series = Array.from(dateMap.values()).sort((a, b) => a.d.localeCompare(b.d));

  return (
    <AppShell>
      <PageHeader
        title="لوحة التحكم"
        subtitle={`مرحباً بك في AL SHIMY — ${today}`}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard title="مبيعات اليوم" value={EGP(k.sales_today || 0)} icon={<DollarSign className="size-5" />} tone="accent" />
        <StatCard title="أرباح اليوم" value={EGP(k.profit_today || 0)} icon={<TrendingUp className="size-5" />} tone="success" />
        <StatCard title="مشتريات اليوم" value={EGP(k.purchases_today || 0)} icon={<Truck className="size-5" />} />
        <StatCard title="عدد الفواتير" value={NUM(k.invoices_today || 0)} icon={<Receipt className="size-5" />} />
        <StatCard title="النقدية الحالية" value={EGP(cashInHand)} icon={<Wallet className="size-5" />} />
        <StatCard title="قيمة المخزون" value={EGP(k.inventory_value || 0)} icon={<PackageX className="size-5" />} />
        <StatCard
          title="تنبيهات مخزون منخفض"
          value={NUM(lowStock.data[0]?.c ?? 0)}
          icon={<AlertTriangle className="size-5" />}
          tone={(lowStock.data[0]?.c ?? 0) > 0 ? "warning" : "default"}
        />
        <StatCard
          title="منتجات نفدت"
          value={NUM(outStock.data[0]?.c ?? 0)}
          icon={<PackageX className="size-5" />}
          tone={(outStock.data[0]?.c ?? 0) > 0 ? "destructive" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Trophy className="size-4 text-accent" /> الأكثر مبيعاً
          </div>
          <div className="text-lg font-bold">{best.data[0]?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            الكمية: {NUM(best.data[0]?.qty ?? 0)}
          </div>
        </div>
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Award className="size-4 text-accent" /> الأعلى ربحاً
          </div>
          <div className="text-lg font-bold">{mostProfit.data[0]?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">
            الربح: {EGP(mostProfit.data[0]?.profit ?? 0)}
          </div>
        </div>
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Snowflake className="size-4 text-accent" /> منتجات راكدة (30 يوم)
          </div>
          {slow.data.length === 0 ? (
            <div className="text-sm text-muted-foreground">لا توجد</div>
          ) : (
            <ul className="text-sm space-y-1">
              {slow.data.map((s) => (
                <li key={s.name} className="truncate">• {s.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        <div className="card-elevated p-5 xl:col-span-2">
          <h3 className="font-bold mb-4">المبيعات والأرباح والمشتريات (آخر ١٤ يوم)</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="d" stroke="var(--color-muted-foreground)" fontSize={11} reversed />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="sales" name="مبيعات" stroke="var(--color-chart-1)" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" name="ربح" stroke="var(--color-chart-3)" strokeWidth={2} />
                <Line type="monotone" dataKey="purchases" name="مشتريات" stroke="var(--color-chart-2)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-elevated p-5">
          <h3 className="font-bold mb-4">أداء المنتجات</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={topProducts.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={10} interval={0} angle={-15} height={50} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="qty" name="كمية" fill="var(--color-chart-1)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
