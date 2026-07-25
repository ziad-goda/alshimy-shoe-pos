import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { useQuery } from "@/lib/useDb";
import { EGP, NUM, catLabel } from "@/lib/format";
import { Boxes, AlertTriangle, PackageX, Wallet } from "lucide-react";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "المخزون — AL SHIMY" },
      { name: "description", content: "متابعة الأرصدة والمنتجات قاربت على الانتهاء ونفدت." },
      { property: "og:title", content: "المخزون — AL SHIMY" },
      { property: "og:description", content: "الجرد الحالي وقيمة المخزون." },
    ],
  }),
  component: Inventory,
});

type Row = { id: number; name: string; category: string; brand: string | null; size: string | null;
  color: string | null; quantity: number; min_stock: number; purchase_price: number; selling_price: number; value: number };

function Inventory() {
  const kpi = useQuery<{ k: string; v: number }>(`
    SELECT 'total_qty' k, COALESCE(SUM(quantity),0) v FROM products
    UNION ALL SELECT 'low', COUNT(*) FROM products WHERE quantity>0 AND quantity<=min_stock
    UNION ALL SELECT 'out', COUNT(*) FROM products WHERE quantity=0
    UNION ALL SELECT 'value', COALESCE(SUM(purchase_price*quantity),0) FROM products
  `);
  const k = Object.fromEntries(kpi.data.map((r) => [r.k, r.v])) as Record<string, number>;

  const rows = useQuery<Row>(
    `SELECT id,name,category,brand,size,color,quantity,min_stock,purchase_price,selling_price,
       purchase_price*quantity value FROM products ORDER BY quantity ASC`
  );

  return (
    <AppShell>
      <PageHeader title="المخزون" subtitle="الأرصدة الحالية وحالة كل صنف" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard title="إجمالي الوحدات" value={NUM(k.total_qty || 0)} icon={<Boxes className="size-5" />} />
        <StatCard title="قاربت على الانتهاء" value={NUM(k.low || 0)} icon={<AlertTriangle className="size-5" />} tone={(k.low || 0) > 0 ? "warning" : "default"} />
        <StatCard title="نفدت" value={NUM(k.out || 0)} icon={<PackageX className="size-5" />} tone={(k.out || 0) > 0 ? "destructive" : "default"} />
        <StatCard title="قيمة المخزون" value={EGP(k.value || 0)} icon={<Wallet className="size-5" />} tone="accent" />
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60">
            <tr className="text-right">
              <th className="p-3 text-xs">الصنف</th><th className="p-3 text-xs">التصنيف</th>
              <th className="p-3 text-xs">الماركة</th><th className="p-3 text-xs">المقاس</th>
              <th className="p-3 text-xs">اللون</th><th className="p-3 text-xs">الكمية</th>
              <th className="p-3 text-xs">حد التنبيه</th><th className="p-3 text-xs">قيمة المخزون</th>
              <th className="p-3 text-xs">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.data.map((p) => {
              const out = p.quantity === 0;
              const low = p.quantity <= p.min_stock;
              return (
                <tr key={p.id} className="border-t hover:bg-muted/40">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3">{catLabel(p.category)}</td>
                  <td className="p-3">{p.brand || "—"}</td>
                  <td className="p-3">{p.size || "—"}</td>
                  <td className="p-3">{p.color || "—"}</td>
                  <td className="p-3 font-bold">{NUM(p.quantity)}</td>
                  <td className="p-3">{NUM(p.min_stock)}</td>
                  <td className="p-3">{EGP(p.value)}</td>
                  <td className="p-3">
                    <span className={"px-2 py-0.5 rounded-full text-xs font-semibold " + (out ? "bg-destructive/15 text-destructive" : low ? "bg-warning/20 text-[oklch(0.35_0.1_60)]" : "bg-success/15 text-[oklch(0.4_0.16_155)]")}>
                      {out ? "نفد" : low ? "قارب على الانتهاء" : "متوفر"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
