import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Boxes,
  Users,
  Wallet,
  FileBarChart,
  Sparkles,
  PiggyBank,
  ClipboardCheck,
  Settings,
  Store,
} from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/pos", label: "نقطة البيع", icon: ShoppingCart },
  { to: "/products", label: "المنتجات", icon: Package },
  { to: "/inventory", label: "المخزون", icon: Boxes },
  { to: "/purchases", label: "المشتريات", icon: Truck },
  { to: "/suppliers", label: "الموردين", icon: Users },
  { to: "/expenses", label: "المصروفات", icon: Wallet },
  { to: "/reports", label: "التقارير", icon: FileBarChart },
  { to: "/analytics", label: "التحليل الذكي", icon: Sparkles },
  { to: "/financial", label: "الملخص المالي", icon: PiggyBank },
  { to: "/closing", label: "تقفيلة اليوم", icon: ClipboardCheck },
  { to: "/settings", label: "الإعدادات", icon: Settings },
] as const;

export function AppShell({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background text-foreground" dir="rtl">
      <aside className="sticky top-0 h-screen w-64 shrink-0 gradient-brand text-sidebar-foreground flex flex-col">
        <div className="p-5 border-b border-sidebar-border/60 flex items-center gap-3">
          <div className="size-11 rounded-xl gradient-accent grid place-items-center shadow-glow">
            <Store className="size-6 text-white" />
          </div>
          <div>
            <div className="text-lg font-extrabold tracking-tight">AL SHIMY</div>
            <div className="text-xs opacity-70">إدارة المبيعات والمخزون</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {nav.map((n) => {
            const active =
              n.to === "/"
                ? pathname === "/"
                : pathname === n.to || pathname.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition " +
                  (active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")
                }
              >
                <Icon className="size-4" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 text-[11px] opacity-60 border-t border-sidebar-border/60">
          يعمل بدون إنترنت • قاعدة بيانات SQLite محلية
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
