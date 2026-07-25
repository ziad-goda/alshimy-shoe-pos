import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "accent" | "success" | "warning" | "destructive";
  className?: string;
}) {
  const toneMap: Record<string, string> = {
    default: "bg-card",
    accent: "bg-gradient-to-br from-[oklch(0.75_0.20_55)] to-[oklch(0.65_0.20_35)] text-white",
    success: "bg-gradient-to-br from-[oklch(0.65_0.16_155)] to-[oklch(0.55_0.14_155)] text-white",
    warning: "bg-gradient-to-br from-[oklch(0.82_0.16_80)] to-[oklch(0.70_0.16_60)] text-[oklch(0.25_0.05_60)]",
    destructive: "bg-gradient-to-br from-[oklch(0.65_0.24_25)] to-[oklch(0.52_0.22_22)] text-white",
  };
  return (
    <div
      className={cn(
        "card-elevated p-5 relative overflow-hidden",
        toneMap[tone],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("text-xs font-medium", tone === "default" ? "text-muted-foreground" : "opacity-90")}>
            {title}
          </div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
          {hint && (
            <div className={cn("mt-1 text-xs", tone === "default" ? "text-muted-foreground" : "opacity-85")}>
              {hint}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "size-10 rounded-xl grid place-items-center",
              tone === "default"
                ? "bg-accent/10 text-accent"
                : "bg-white/20 text-white"
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
