import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { useQuery } from "@/lib/useDb";
import { EGP } from "@/lib/format";
import { DollarSign, ShoppingCart, Wallet, Coins, PiggyBank, Boxes, HandCoins, Sparkles } from "lucide-react";

export const Route = createFileRoute("/financial")({
  head: () => ({
    meta: [
      { title: "الملخص المالي — AL SHIMY" },
      { name: "description", content: "إجماليات مالية شاملة: مبيعات ومشتريات ومصروفات وأرباح." },
      { property: "og:title", content: "الملخص المالي — AL SHIMY" },
      { property: "og:description", content: "حالة الأموال في المحل." },
    ],
  }),
  component: Financial,
});

function Financial() {
  const rows = useQuery<{ k: string; v: number }>(`
    SELECT 'sales' k, COALESCE(SUM(total),0) v FROM sales WHERE returned=0
    UNION ALL SELECT 'cost', COALESCE(SUM(cost*quantity),0) FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.returned=0
    UNION ALL SELECT 'purchases', COALESCE(SUM(total),0) FROM purchases
    UNION ALL SELECT 'purchase_paid', COALESCE(SUM(paid),0) FROM purchases
    UNION ALL SELECT 'expenses', COALESCE(SUM(amount),0) FROM expenses
    UNION ALL SELECT 'sup_pay', COALESCE(SUM(amount),0) FROM supplier_payments
    UNION ALL SELECT 'inventory_value', COALESCE(SUM(purchase_price*quantity),0) FROM products
    UNION ALL SELECT 'expected_profit', COALESCE(SUM((selling_price-purchase_price)*quantity),0) FROM products
  `);
  const k = Object.fromEntries(rows.data.map((r) => [r.k, r.v])) as Record<string, number>;

  const gross = (k.sales || 0) - (k.cost || 0);
  const net = gross - (k.expenses || 0);
  const owed = (k.purchases || 0) - (k.purchase_paid || 0) - (k.sup_pay || 0);
  const cash = (k.sales || 0) - (k.expenses || 0) - (k.purchase_paid || 0) - (k.sup_pay || 0);

  return (
    <AppShell>
      <PageHeader title="الملخص المالي" subtitle="نظرة شاملة على أموال المحل" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard title="إجمالي المبيعات" value={EGP(k.sales || 0)} icon={<DollarSign className="size-5" />} tone="accent" />
        <StatCard title="إجمالي المشتريات" value={EGP(k.purchases || 0)} icon={<ShoppingCart className="size-5" />} />
        <StatCard title="إجمالي المصروفات" value={EGP(k.expenses || 0)} icon={<Wallet className="size-5" />} />
        <StatCard title="الربح الإجمالي" value={EGP(gross)} icon={<Coins className="size-5" />} tone="success" />
        <StatCard title="صافي الربح" value={EGP(net)} icon={<PiggyBank className="size-5" />} tone={net >= 0 ? "success" : "destructive"} />
        <StatCard title="النقدية بالخزنة" value={EGP(cash)} icon={<HandCoins className="size-5" />} />
        <StatCard title="مطلوب للموردين" value={EGP(Math.max(0, owed))} icon={<Wallet className="size-5" />} tone={owed > 0 ? "warning" : "default"} />
        <StatCard title="قيمة المخزون" value={EGP(k.inventory_value || 0)} icon={<Boxes className="size-5" />} />
        <StatCard title="الربح المتوقع من المخزون" value={EGP(k.expected_profit || 0)} icon={<Sparkles className="size-5" />} tone="accent" />
      </div>
    </AppShell>
  );
}
