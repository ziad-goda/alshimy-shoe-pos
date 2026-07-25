import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useQuery } from "@/lib/useDb";
import { exec, getDb } from "@/lib/db";
import { EGP, NUM } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus, Printer, RotateCcw, Search, ShoppingCart, Barcode } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "نقطة البيع — AL SHIMY" },
      { name: "description", content: "شاشة الكاشير: ماسح باركود، سلة، خصم، طباعة فاتورة." },
      { property: "og:title", content: "نقطة البيع — AL SHIMY" },
      { property: "og:description", content: "بيع سريع بالباركود مع طباعة الفاتورة." },
    ],
  }),
  component: POS,
});

type Product = {
  id: number; name: string; barcode: string | null; selling_price: number;
  purchase_price: number; quantity: number;
};
type CartItem = { product_id: number; name: string; price: number; cost: number; quantity: number; stock: number };

function POS() {
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { barcodeRef.current?.focus(); }, []);

  const products = useQuery<Product>(
    q
      ? `SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? ORDER BY name LIMIT 40`
      : `SELECT * FROM products ORDER BY id DESC LIMIT 24`,
    q ? [`%${q}%`, `%${q}%`] : []
  );

  const addByBarcode = async (code: string) => {
    if (!code.trim()) return;
    const db = await getDb();
    const stmt = db.prepare("SELECT * FROM products WHERE barcode=? LIMIT 1");
    stmt.bind([code.trim()]);
    if (stmt.step()) add(stmt.getAsObject() as unknown as Product);
    else toast.error("لم يتم العثور على منتج بهذا الباركود");
    stmt.free();
    setQ("");
  };

  const add = (p: Product) => {
    if (p.quantity === 0) return toast.error("المنتج غير متوفر بالمخزون");
    setCart((c) => {
      const ex = c.find((i) => i.product_id === p.id);
      if (ex) {
        if (ex.quantity + 1 > p.quantity) { toast.error("الكمية أكبر من المخزون"); return c; }
        return c.map((i) => (i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...c, { product_id: p.id, name: p.name, price: p.selling_price, cost: p.purchase_price, quantity: 1, stock: p.quantity }];
    });
  };

  const setQty = (id: number, delta: number) => {
    setCart((c) => c.flatMap((i) => {
      if (i.product_id !== id) return [i];
      const q2 = i.quantity + delta;
      if (q2 <= 0) return [];
      if (q2 > i.stock) { toast.error("الكمية أكبر من المخزون"); return [i]; }
      return [{ ...i, quantity: q2 }];
    }));
  };

  const remove = (id: number) => setCart((c) => c.filter((i) => i.product_id !== id));

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const total = Math.max(0, subtotal - discount);
  const cost = cart.reduce((s, i) => s + i.cost * i.quantity, 0);
  const profit = total - cost;
  const change = paid > 0 ? paid - total : 0;

  const checkout = async (andPrint: boolean) => {
    if (cart.length === 0) return toast.error("السلة فارغة");
    const date = new Date().toISOString();
    const db = await getDb();
    db.run("BEGIN");
    try {
      db.run(
        "INSERT INTO sales (date, subtotal, discount, total, profit, paid) VALUES (?,?,?,?,?,?)",
        [date, subtotal, discount, total, profit, paid || total]
      );
      const saleId = (db.exec("SELECT last_insert_rowid() id")[0].values[0][0]) as number;
      for (const i of cart) {
        db.run(
          "INSERT INTO sale_items (sale_id, product_id, name, quantity, price, cost) VALUES (?,?,?,?,?,?)",
          [saleId, i.product_id, i.name, i.quantity, i.price, i.cost]
        );
        db.run("UPDATE products SET quantity = quantity - ? WHERE id=?", [i.quantity, i.product_id]);
      }
      db.run("COMMIT");
      await exec("SELECT 1"); // trigger persist + subscribers
      toast.success("تم إتمام البيع");
      if (andPrint) printInvoice({ id: saleId, date, items: cart, subtotal, discount, total, paid: paid || total });
      setCart([]); setDiscount(0); setPaid(0);
      barcodeRef.current?.focus();
    } catch (e: unknown) {
      db.run("ROLLBACK");
      toast.error("فشل الحفظ: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const returnLast = async () => {
    const db = await getDb();
    const last = db.exec("SELECT id FROM sales WHERE returned=0 ORDER BY id DESC LIMIT 1");
    if (!last[0]) return toast.error("لا توجد فاتورة قابلة للإرجاع");
    const id = last[0].values[0][0] as number;
    if (!confirm(`هل تريد إرجاع الفاتورة رقم ${id}؟`)) return;
    db.run("BEGIN");
    const items = db.exec("SELECT product_id, quantity FROM sale_items WHERE sale_id=?", [id])[0];
    items?.values.forEach((row) => {
      db.run("UPDATE products SET quantity = quantity + ? WHERE id=?", [row[1] as number, row[0] as number]);
    });
    db.run("UPDATE sales SET returned=1 WHERE id=?", [id]);
    db.run("COMMIT");
    await exec("SELECT 1");
    toast.success("تم الإرجاع");
  };

  return (
    <AppShell>
      <PageHeader title="نقطة البيع" subtitle="بيع سريع بالباركود أو البحث" actions={
        <Button variant="outline" onClick={returnLast}><RotateCcw className="size-4 ml-1" />إرجاع آخر فاتورة</Button>
      } />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="card-elevated p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-accent" />
                <Input
                  ref={barcodeRef}
                  placeholder="امسح الباركود أو اكتب واضغط Enter"
                  className="pr-9 h-11 font-mono"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addByBarcode(q);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="card-elevated p-3">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Search className="size-3" /> اضغط على المنتج لإضافته للسلة</div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[62vh] overflow-y-auto">
              {products.data.map((p) => (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  disabled={p.quantity === 0}
                  className="text-right p-3 rounded-lg border bg-card hover:border-accent hover:shadow-md transition disabled:opacity-40"
                >
                  <div className="text-sm font-semibold line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="font-mono text-muted-foreground">{p.barcode || "—"}</span>
                    <span className="text-accent font-bold">{EGP(p.selling_price)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">متاح: {NUM(p.quantity)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card-elevated sticky top-4">
            <div className="p-4 border-b flex items-center gap-2 gradient-brand text-white rounded-t-lg">
              <ShoppingCart className="size-5" />
              <div className="font-bold">سلة البيع ({cart.length})</div>
            </div>
            <div className="p-3 max-h-[45vh] overflow-y-auto space-y-2">
              {cart.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">السلة فارغة</div>}
              {cart.map((i) => (
                <div key={i.product_id} className="flex items-center gap-2 border rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.name}</div>
                    <div className="text-xs text-muted-foreground">{EGP(i.price)} × {i.quantity}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="size-7" onClick={() => setQty(i.product_id, -1)}><Minus className="size-3" /></Button>
                    <span className="w-6 text-center text-sm font-bold">{i.quantity}</span>
                    <Button size="icon" variant="outline" className="size-7" onClick={() => setQty(i.product_id, +1)}><Plus className="size-3" /></Button>
                  </div>
                  <div className="w-20 text-sm font-bold text-left">{EGP(i.price * i.quantity)}</div>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => remove(i.product_id)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t space-y-2 text-sm">
              <Row label="الإجمالي" value={EGP(subtotal)} />
              <div className="flex items-center justify-between">
                <span>خصم</span>
                <Input type="number" value={discount} onChange={(e) => setDiscount(+e.target.value || 0)} className="w-28 h-8 text-left" />
              </div>
              <Row label="الصافي" value={<span className="text-lg font-extrabold text-accent">{EGP(total)}</span>} />
              <div className="flex items-center justify-between">
                <span>المدفوع</span>
                <Input type="number" value={paid || ""} placeholder={String(total)} onChange={(e) => setPaid(+e.target.value || 0)} className="w-28 h-8 text-left" />
              </div>
              {paid > 0 && <Row label="الباقي للعميل" value={EGP(Math.max(0, change))} />}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={() => checkout(false)} disabled={cart.length === 0}>حفظ</Button>
                <Button className="gradient-accent text-white" onClick={() => checkout(true)} disabled={cart.length === 0}>
                  <Printer className="size-4 ml-1" /> حفظ + طباعة
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

type Invoice = { id: number; date: string; items: CartItem[]; subtotal: number; discount: number; total: number; paid: number; };
function printInvoice(inv: Invoice) {
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return;
  const rows = inv.items.map((i) => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.price.toFixed(2)}</td><td>${(i.price * i.quantity).toFixed(2)}</td></tr>`).join("");
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>فاتورة ${inv.id}</title>
    <style>
      body{font-family:'Cairo',Tahoma,Arial;padding:12px;color:#111}
      h1{margin:0;text-align:center;font-size:22px}
      .muted{color:#666;text-align:center;font-size:12px}
      table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
      th,td{border-bottom:1px dashed #ccc;padding:6px;text-align:right}
      .tot{display:flex;justify-content:space-between;margin:4px 0;font-size:13px}
      .grand{font-size:16px;font-weight:800;border-top:2px solid #111;padding-top:6px;margin-top:6px}
    </style></head><body>
    <h1>AL SHIMY</h1>
    <div class="muted">فاتورة رقم #${inv.id}<br>${new Date(inv.date).toLocaleString("ar-EG")}</div>
    <table><thead><tr><th>الصنف</th><th>كمية</th><th>سعر</th><th>إجمالي</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="tot"><span>الإجمالي</span><span>${inv.subtotal.toFixed(2)} ج.م</span></div>
    <div class="tot"><span>خصم</span><span>${inv.discount.toFixed(2)} ج.م</span></div>
    <div class="tot grand"><span>الصافي</span><span>${inv.total.toFixed(2)} ج.م</span></div>
    <div class="tot"><span>المدفوع</span><span>${inv.paid.toFixed(2)} ج.م</span></div>
    <div class="muted" style="margin-top:14px">شكراً لتعاملكم معنا</div>
    <script>window.print();setTimeout(()=>window.close(),400)</script>
    </body></html>`);
  w.document.close();
}
