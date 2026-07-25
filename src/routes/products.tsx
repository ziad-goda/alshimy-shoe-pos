import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useQuery } from "@/lib/useDb";
import { exec } from "@/lib/db";
import { EGP, NUM, CATEGORIES, catLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "المنتجات — AL SHIMY" },
      { name: "description", content: "إدارة كاملة لأصناف الأحذية والشباشب والأحزمة." },
      { property: "og:title", content: "المنتجات — AL SHIMY" },
      { property: "og:description", content: "إضافة وتعديل وحذف والبحث عن المنتجات." },
    ],
  }),
  component: ProductsPage,
});

type Product = {
  id: number;
  name: string;
  barcode: string | null;
  category: string;
  brand: string | null;
  size: string | null;
  color: string | null;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  min_stock: number;
  supplier_id: number | null;
  image: string | null;
  notes: string | null;
};

const empty: Partial<Product> = {
  name: "",
  barcode: "",
  category: "shoes",
  brand: "",
  size: "",
  color: "",
  purchase_price: 0,
  selling_price: 0,
  quantity: 0,
  min_stock: 5,
  supplier_id: null,
  image: "",
  notes: "",
};

function ProductsPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Product>>(empty);

  const like = `%${q}%`;
  const where = q
    ? "WHERE (name LIKE ? OR barcode LIKE ? OR brand LIKE ?)"
    : "";
  const params = q ? [like, like, like] : [];
  const catWhere = cat !== "all" ? (where ? " AND category=?" : "WHERE category=?") : "";
  if (cat !== "all") params.push(cat);

  const products = useQuery<Product>(
    `SELECT * FROM products ${where}${catWhere} ORDER BY id DESC`,
    params
  );
  const suppliers = useQuery<{ id: number; name: string }>(`SELECT id, name FROM suppliers ORDER BY name`);

  const save = async () => {
    if (!form.name) return toast.error("الرجاء إدخال اسم المنتج");
    try {
      if (form.id) {
        await exec(
          `UPDATE products SET name=?, barcode=?, category=?, brand=?, size=?, color=?,
           purchase_price=?, selling_price=?, quantity=?, min_stock=?, supplier_id=?, image=?, notes=?
           WHERE id=?`,
          [
            form.name, form.barcode || null, form.category, form.brand || null, form.size || null,
            form.color || null, +Number(form.purchase_price || 0), +Number(form.selling_price || 0),
            +Number(form.quantity || 0), +Number(form.min_stock || 0), form.supplier_id || null,
            form.image || null, form.notes || null, form.id,
          ]
        );
        toast.success("تم تحديث المنتج");
      } else {
        await exec(
          `INSERT INTO products (name,barcode,category,brand,size,color,purchase_price,selling_price,quantity,min_stock,supplier_id,image,notes)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            form.name, form.barcode || null, form.category, form.brand || null, form.size || null,
            form.color || null, +Number(form.purchase_price || 0), +Number(form.selling_price || 0),
            +Number(form.quantity || 0), +Number(form.min_stock || 0), form.supplier_id || null,
            form.image || null, form.notes || null,
          ]
        );
        toast.success("تمت إضافة المنتج");
      }
      setOpen(false);
      setForm(empty);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("خطأ: " + msg);
    }
  };

  const del = async (id: number) => {
    if (!confirm("هل تريد حذف المنتج؟")) return;
    await exec("DELETE FROM products WHERE id=?", [id]);
    toast.success("تم الحذف");
  };

  return (
    <AppShell>
      <PageHeader
        title="المنتجات"
        subtitle="إدارة الأصناف وأسعارها ومخزونها"
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button className="gradient-accent text-white">
                <Plus className="size-4 ml-1" /> إضافة منتج
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" dir="rtl">
              <DialogHeader>
                <DialogTitle>{form.id ? "تعديل منتج" : "منتج جديد"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field label="الاسم *"><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="الباركود"><Input value={form.barcode ?? ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
                <Field label="التصنيف">
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="الماركة"><Input value={form.brand ?? ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
                <Field label="المقاس"><Input value={form.size ?? ""} onChange={(e) => setForm({ ...form, size: e.target.value })} /></Field>
                <Field label="اللون"><Input value={form.color ?? ""} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
                <Field label="سعر الشراء"><Input type="number" value={form.purchase_price ?? 0} onChange={(e) => setForm({ ...form, purchase_price: +e.target.value })} /></Field>
                <Field label="سعر البيع"><Input type="number" value={form.selling_price ?? 0} onChange={(e) => setForm({ ...form, selling_price: +e.target.value })} /></Field>
                <Field label="الكمية"><Input type="number" value={form.quantity ?? 0} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} /></Field>
                <Field label="حد التنبيه"><Input type="number" value={form.min_stock ?? 0} onChange={(e) => setForm({ ...form, min_stock: +e.target.value })} /></Field>
                <Field label="المورد">
                  <Select value={form.supplier_id ? String(form.supplier_id) : "none"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "none" ? null : +v })}>
                    <SelectTrigger><SelectValue placeholder="اختر مورد" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون مورد</SelectItem>
                      {suppliers.data.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="صورة (رابط)"><Input value={form.image ?? ""} onChange={(e) => setForm({ ...form, image: e.target.value })} /></Field>
                <div className="col-span-2">
                  <Field label="ملاحظات"><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button className="gradient-accent text-white" onClick={save}>حفظ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="card-elevated p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pr-9" placeholder="ابحث بالاسم أو الباركود أو الماركة..." />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل التصنيفات</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60">
            <tr className="text-right">
              <Th>الصورة</Th><Th>الاسم</Th><Th>الباركود</Th><Th>التصنيف</Th>
              <Th>الماركة</Th><Th>المقاس</Th><Th>اللون</Th>
              <Th>سعر الشراء</Th><Th>سعر البيع</Th><Th>الكمية</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {products.data.length === 0 && (
              <tr><td colSpan={11} className="text-center py-10 text-muted-foreground">لا توجد منتجات</td></tr>
            )}
            {products.data.map((p) => {
              const low = p.quantity <= p.min_stock;
              const out = p.quantity === 0;
              return (
                <tr key={p.id} className="border-t hover:bg-muted/40">
                  <Td>
                    {p.image ? (
                      <img src={p.image} className="size-10 rounded-md object-cover" />
                    ) : (
                      <div className="size-10 rounded-md bg-secondary grid place-items-center text-[10px] text-muted-foreground">صورة</div>
                    )}
                  </Td>
                  <Td className="font-medium">{p.name}</Td>
                  <Td className="font-mono text-xs">{p.barcode || "—"}</Td>
                  <Td>{catLabel(p.category)}</Td>
                  <Td>{p.brand || "—"}</Td>
                  <Td>{p.size || "—"}</Td>
                  <Td>{p.color || "—"}</Td>
                  <Td>{EGP(p.purchase_price)}</Td>
                  <Td className="font-semibold">{EGP(p.selling_price)}</Td>
                  <Td>
                    <span className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
                      (out ? "bg-destructive/15 text-destructive" : low ? "bg-warning/20 text-[oklch(0.35_0.1_60)]" : "bg-success/15 text-[oklch(0.4_0.16_155)]")
                    }>{NUM(p.quantity)}</span>
                  </Td>
                  <Td>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => { setForm(p); setOpen(true); }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => del(p.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={"px-3 py-2.5 " + className}>{children}</td>;
}
