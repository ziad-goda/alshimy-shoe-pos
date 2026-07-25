import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useQuery } from "@/lib/useDb";
import { exec, getDb } from "@/lib/db";
import { EGP, DATE } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Truck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/purchases")({
  head: () => ({
    meta: [
      { title: "المشتريات — AL SHIMY" },
      { name: "description", content: "تسجيل فواتير الشراء من الموردين وتحديث المخزون تلقائياً." },
      { property: "og:title", content: "المشتريات — AL SHIMY" },
      { property: "og:description", content: "إدارة مشتريات الأصناف من الموردين." },
    ],
  }),
  component: PurchasesPage,
});

function PurchasesPage() {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [paid, setPaid] = useState(0);

  const purchases = useQuery<{ id: number; date: string; supplier: string; total: number; paid: number; status: string }>(
    `SELECT p.id, p.date, COALESCE(s.name,'—') supplier, p.total, p.paid,
       CASE WHEN p.paid>=p.total THEN 'paid' WHEN p.paid>0 THEN 'partial' ELSE 'unpaid' END status
     FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id
     ORDER BY p.id DESC LIMIT 200`
  );
  const products = useQuery<{ id: number; name: string; purchase_price: number }>(`SELECT id, name, purchase_price FROM products ORDER BY name`);
  const suppliers = useQuery<{ id: number; name: string }>(`SELECT id, name FROM suppliers ORDER BY name`);

  const total = qty * price;

  const save = async () => {
    if (!productId) return toast.error("اختر المنتج");
    if (qty <= 0 || price < 0) return toast.error("قيم غير صحيحة");
    const db = await getDb();
    db.run("BEGIN");
    try {
      db.run(
        "INSERT INTO purchases (date, supplier_id, total, paid, status) VALUES (?,?,?,?,?)",
        [new Date().toISOString(), supplierId ? +supplierId : null, total, paid || 0, paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid"]
      );
      const pid = db.exec("SELECT last_insert_rowid() id")[0].values[0][0] as number;
      db.run("INSERT INTO purchase_items (purchase_id, product_id, quantity, price) VALUES (?,?,?,?)", [pid, +productId, qty, price]);
      db.run("UPDATE products SET quantity = quantity + ?, purchase_price=? WHERE id=?", [qty, price, +productId]);
      db.run("COMMIT");
      await exec("SELECT 1");
      toast.success("تم تسجيل فاتورة الشراء");
      setOpen(false); setProductId(""); setSupplierId(""); setQty(1); setPrice(0); setPaid(0);
    } catch (e: unknown) {
      db.run("ROLLBACK");
      toast.error("خطأ: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <AppShell>
      <PageHeader title="المشتريات" subtitle="فواتير الشراء من الموردين" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-accent text-white"><Plus className="size-4 ml-1" />فاتورة شراء</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>فاتورة شراء جديدة</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">المورد</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="اختر مورد" /></SelectTrigger>
                  <SelectContent>{suppliers.data.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">المنتج</Label>
                <Select value={productId} onValueChange={(v) => { setProductId(v); const p = products.data.find((x) => x.id === +v); if (p) setPrice(p.purchase_price); }}>
                  <SelectTrigger><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
                  <SelectContent>{products.data.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">الكمية</Label><Input type="number" value={qty} onChange={(e) => setQty(+e.target.value || 0)} /></div>
                <div><Label className="text-xs">سعر الشراء</Label><Input type="number" value={price} onChange={(e) => setPrice(+e.target.value || 0)} /></div>
              </div>
              <div className="flex justify-between text-sm bg-secondary p-3 rounded-lg">
                <span>إجمالي</span><span className="font-bold">{EGP(total)}</span>
              </div>
              <div><Label className="text-xs">المدفوع للمورد</Label><Input type="number" value={paid} onChange={(e) => setPaid(+e.target.value || 0)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button className="gradient-accent text-white" onClick={save}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60">
            <tr className="text-right">
              <th className="p-3 text-xs">#</th><th className="p-3 text-xs">التاريخ</th>
              <th className="p-3 text-xs">المورد</th><th className="p-3 text-xs">الإجمالي</th>
              <th className="p-3 text-xs">المدفوع</th><th className="p-3 text-xs">الباقي</th>
              <th className="p-3 text-xs">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {purchases.data.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد مشتريات</td></tr>}
            {purchases.data.map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/40">
                <td className="p-3 font-mono text-xs">#{p.id}</td>
                <td className="p-3">{DATE(p.date)}</td>
                <td className="p-3 flex items-center gap-1.5"><Truck className="size-3.5 text-muted-foreground" />{p.supplier}</td>
                <td className="p-3 font-semibold">{EGP(p.total)}</td>
                <td className="p-3">{EGP(p.paid)}</td>
                <td className="p-3 text-destructive font-semibold">{EGP(p.total - p.paid)}</td>
                <td className="p-3">
                  <span className={"px-2 py-0.5 rounded-full text-xs font-semibold " + (p.status === "paid" ? "bg-success/15 text-[oklch(0.4_0.16_155)]" : p.status === "partial" ? "bg-warning/20 text-[oklch(0.35_0.1_60)]" : "bg-destructive/15 text-destructive")}>
                    {p.status === "paid" ? "مدفوعة" : p.status === "partial" ? "جزئية" : "آجل"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
