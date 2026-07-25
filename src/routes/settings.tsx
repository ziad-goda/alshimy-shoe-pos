import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { exportBackup, restoreBackup, resetDb } from "@/lib/db";
import { Download, Upload, RotateCcw, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — AL SHIMY" },
      { name: "description", content: "النسخ الاحتياطي واستعادة قاعدة البيانات." },
      { property: "og:title", content: "الإعدادات — AL SHIMY" },
      { property: "og:description", content: "أدوات إدارة قاعدة بيانات SQLite المحلية." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const backup = async () => {
    const bytes = await exportBackup();
    const blob = new Blob([bytes.slice().buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alshimy-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل النسخة الاحتياطية");
  };

  const restore = async (f: File) => {
    if (!confirm("سيؤدي هذا لاستبدال كل البيانات الحالية. متابعة؟")) return;
    const buf = new Uint8Array(await f.arrayBuffer());
    await restoreBackup(buf);
    toast.success("تم استرجاع البيانات");
  };

  const reset = async () => {
    if (!confirm("تحذير: سيتم حذف كل البيانات وإرجاع النظام لحالته الأولى!")) return;
    await resetDb();
    toast.success("تم تصفير قاعدة البيانات");
  };

  return (
    <AppShell>
      <PageHeader title="الإعدادات" subtitle="النسخ الاحتياطي والاستعادة" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-elevated p-5">
          <h3 className="font-bold mb-2">النسخ الاحتياطي</h3>
          <p className="text-sm text-muted-foreground mb-3">
            حمّل نسخة كاملة من قاعدة بيانات SQLite على جهازك. احتفظ بها في مكان آمن.
          </p>
          <Button className="gradient-accent text-white" onClick={backup}>
            <Download className="size-4 ml-1" /> تنزيل نسخة احتياطية
          </Button>
        </div>

        <div className="card-elevated p-5">
          <h3 className="font-bold mb-2">استعادة نسخة احتياطية</h3>
          <p className="text-sm text-muted-foreground mb-3">
            اختر ملف SQLite تم تنزيله سابقاً لاستعادة كل البيانات.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".sqlite,.db,application/octet-stream"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4 ml-1" /> اختر ملف الاستعادة
          </Button>
        </div>

        <div className="card-elevated p-5 md:col-span-2 border-destructive/50">
          <h3 className="font-bold mb-2 text-destructive">تصفير النظام</h3>
          <p className="text-sm text-muted-foreground mb-3">
            حذف كل البيانات وإرجاع النظام لحالته الأولى مع بعض البيانات التجريبية.
          </p>
          <Button variant="destructive" onClick={reset}>
            <RotateCcw className="size-4 ml-1" /> تصفير قاعدة البيانات
          </Button>
        </div>

        <div className="card-elevated p-5 md:col-span-2 bg-secondary/40">
          <div className="flex items-start gap-3">
            <Info className="size-5 text-accent shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <div className="font-bold">AL SHIMY — إدارة المبيعات والمخزون</div>
              <div className="text-muted-foreground">
                نظام يعمل بالكامل بدون إنترنت باستخدام قاعدة بيانات SQLite محلية.
                يعمل في المتصفح كما يعمل داخل تطبيق Windows عبر Electron.
              </div>
              <div className="text-muted-foreground">
                العملة: الجنيه المصري (EGP) — اللغة: العربية (RTL)
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
