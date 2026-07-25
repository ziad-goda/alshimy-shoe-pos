import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useQuery } from "@/lib/useDb";
import { exec } from "@/lib/db";
import { EGP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users, Wallet, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [
      { title: "الموردين — AL SHIMY" },
      { name: "description", content: "بيانات الموردين والمستحقات والمدفوعات." },
      { property: "og:title", content: "الموردين — AL SHIMY" },
      { property: "og:description", content: "احسب ما عليك لكل مورد." },
    ],
  }),
  component: SuppliersPage,
});

type Sup = { id: number; name: string; phone: string | null; address: string | null; notes: string | null;
  total_purchases: number; total_paid: number; extra_paid: number; balance: number };

function SuppliersPage() {
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [form, setForm] = useState<{ id?: number; name: string; phone: string; address: string; notes: string }>({ name: "", phone: "", address: "", notes: "" });

  const list = useQuery<Sup>(`
    SELECT s.id, s.name, s.phone, s.address, s.notes,
      COALESCE((SELECT SUM(total) FROM purchases WHERE supplier_id=s.id),0) total_purchases,
      COALESCE((SELECT SUM(paid)  FROM purchases WHERE supplier_id=s.id),0) total_paid,
      COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id=s.id),0) extra_paid,
      COALESCE((SELECT SUM(total) FROM purchases WHERE supplier_id=s.id),0)
        - COALESCE((SELECT SUM(paid) FROM purchases WHERE supplier_id=s.id),0)
        - COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id=s.id),0) balance
    FROM suppliers s ORDER BY s.name
  `);

  const save = async () => {
    if (!form.name) return toast.error("الاسم مطلوب");
    if (form.id) {
      await exec("UPDATE suppliers SET name=?, phone=?, address=?, notes=? WHERE id=?", [form.name, form.phone || null, form.address || null, form.notes || null, form.id]);
    } else {
      await exec("INSERT INTO suppliers (name, phone, address, notes) VALUES (?,?,?,?)", [form.name, form.phone || null, form.address || null, form.notes || null]);
    }
    toast.success("تم الحفظ");
    setOpen(false); setForm({ name: "", phone: "", address: "", notes: "" });
  };

  const del = async (id: number) => {
    if (!confirm("حذف المورد؟")) return;
    await exec("DELETE FROM suppliers WHERE id=?", [id]);
    toast.success("تم الحذف");
  };

  const pay = async (id: number) => {
    if (payAmount <= 0) return toast.error("مبلغ غير صحيح");
    await exec("INSERT INTO supplier_payments (supplier_id, date, amount) VALUES (?,?,?)", [id, new Date().toISOString(), payAmount]);
    toast.success("تم تسجيل الدفعة");
    setPayOpen(null); setPayAmount(0);
  };

  return (
    <AppShell>
      <PageHeader title="الموردين" subtitle="الحسابات المفتوحة مع الموردين" actions={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm({ name: "", phone: "", address: "", notes: "" }); }}>
          <DialogTrigger asChild><Button className="gradient-accent text-white"><Plus className="size-4 ml-1" />مورد جديد</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>{form.id ? "تعديل مورد" : "مورد جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">الاسم *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label className="text-xs">الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label className="text-xs">العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label className="text-xs">ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button className="gradient-accent text-white" onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.data.length === 0 && <div className="text-muted-foreground">لا يوجد موردين</div>}
        {list.data.map((s) => (
          <div key={s.id} className="card-elevated p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="size-11 rounded-xl gradient-brand grid place-items-center"><Users className="size-5 text-white" /></div>
                <div>
                  <div className="font-bold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.phone || "—"}</div>
                  <div className="text-xs text-muted-foreground">{s.address || "—"}</div>
                </div>
              </div>
              <button onClick={() => del(s.id)} className="text-destructive"><Trash2 className="size-4" /></button>
            </div>
            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">إجمالي المشتريات</span><span className="font-semibold">{EGP(s.total_purchases)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">المدفوع بالفواتير</span><span>{EGP(s.total_paid)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">دفعات إضافية</span><span>{EGP(s.extra_paid)}</span></div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold">المطلوب</span>
                <span className={"font-extrabold " + (s.balance > 0 ? "text-destructive" : "text-[oklch(0.4_0.16_155)]")}>{EGP(Math.max(0, s.balance))}</span>
              </div>
            </div>
            <Dialog open={payOpen === s.id} onOpenChange={(v) => setPayOpen(v ? s.id : null)}>
              <DialogTrigger asChild>
                <Button className="w-full mt-3 gradient-accent text-white"><Wallet className="size-4 ml-1" />تسجيل دفعة</Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>دفعة إلى {s.name}</DialogTitle></DialogHeader>
                <div><Label className="text-xs">المبلغ</Label><Input type="number" value={payAmount} onChange={(e) => setPayAmount(+e.target.value || 0)} /></div>
                <DialogFooter><Button variant="outline" onClick={() => setPayOpen(null)}>إلغاء</Button><Button className="gradient-accent text-white" onClick={() => pay(s.id)}>تسجيل</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
