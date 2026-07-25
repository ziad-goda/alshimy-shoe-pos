import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useQuery } from "@/lib/useDb";
import { exec } from "@/lib/db";
import { EGP, DATE } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "المصروفات — AL SHIMY" },
      { name: "description", content: "تسجيل ومتابعة كافة مصروفات المحل." },
      { property: "og:title", content: "المصروفات — AL SHIMY" },
      { property: "og:description", content: "الإيجار والكهرباء والمرتبات وباقي المصروفات." },
    ],
  }),
  component: ExpensesPage,
});

const CATS = ["إيجار", "كهرباء", "مياه", "إنترنت", "مرتبات", "مواصلات", "أخرى"];

function ExpensesPage() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(CATS[0]);
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");

  const rows = useQuery<{ id: number; date: string; category: string; amount: number; notes: string }>(
    `SELECT * FROM expenses ORDER BY id DESC LIMIT 200`
  );
  const total = rows.data.reduce((s, r) => s + r.amount, 0);

  const save = async () => {
    if (amount <= 0) return toast.error("أدخل مبلغ صحيح");
    await exec("INSERT INTO expenses (date, category, amount, notes) VALUES (?,?,?,?)",
      [new Date().toISOString(), category, amount, notes || null]);
    toast.success("تم التسجيل");
    setOpen(false); setAmount(0); setNotes("");
  };

  const del = async (id: number) => {
    if (!confirm("حذف المصروف؟")) return;
    await exec("DELETE FROM expenses WHERE id=?", [id]);
  };

  return (
    <AppShell>
      <PageHeader title="المصروفات" subtitle={`إجمالي المصروفات المسجلة: ${EGP(total)}`} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-accent text-white"><Plus className="size-4 ml-1" />مصروف جديد</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>تسجيل مصروف</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">التصنيف</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(+e.target.value || 0)} /></div>
              <div><Label className="text-xs">ملاحظات</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button className="gradient-accent text-white" onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60"><tr className="text-right">
            <th className="p-3 text-xs">التاريخ</th><th className="p-3 text-xs">التصنيف</th>
            <th className="p-3 text-xs">المبلغ</th><th className="p-3 text-xs">ملاحظات</th><th></th>
          </tr></thead>
          <tbody>
            {rows.data.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">لا توجد مصروفات</td></tr>}
            {rows.data.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/40">
                <td className="p-3">{DATE(r.date)}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-secondary text-xs">{r.category}</span></td>
                <td className="p-3 font-semibold">{EGP(r.amount)}</td>
                <td className="p-3 text-muted-foreground">{r.notes || "—"}</td>
                <td className="p-3 text-left"><button onClick={() => del(r.id)}><Trash2 className="size-4 text-destructive" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
