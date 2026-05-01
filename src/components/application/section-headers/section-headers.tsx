import { type ReactNode, type ComponentPropsWithRef } from "react";
import { cx } from "@/utils/cx";

/* ── Types ── */

export interface SectionHeaderItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
}

export interface SectionHeadersProps {
  items: SectionHeaderItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Visual style */
  variant?: "pills" | "underline" | "segmented";
  /** Alignment */
  align?: "start" | "center" | "end";
  /** Full width tabs */
  fullWidth?: boolean;
  /** Additional class */
  className?: string;
  /** Render custom content between header and body */
  children?: ReactNode;
}

/* ── Components ── */

export function SectionHeaders({
  items,
  activeId,
  onChange,
  size = "md",
  variant = "pills",
  align = "start",
  fullWidth,
  className,
  children,
}: SectionHeadersProps) {
  const sizeClasses = {
    sm: "text-xs px-2.5 py-1 rounded-md gap-1",
    md: "text-sm px-3 py-1.5 rounded-lg gap-1.5",
    lg: "text-sm px-4 py-2 rounded-lg gap-2",
  };

  const variantClasses = {
    pills: {
      base: "flex-wrap gap-1",
      tab: (active: boolean) =>
        cx(
          "font-semibold border border-[var(--brand-border-hairline)] bg-white text-tertiary cursor-pointer transition-all duration-150",
          "hover:bg-primary_hover hover:text-secondary",
          active && "bg-brand-solid text-white border-brand-solid",
        ),
    },
    underline: {
      base: "gap-0 border-b border-[var(--brand-border)]",
      tab: (active: boolean) =>
        cx(
          "font-medium border-b-2 border-transparent text-tertiary cursor-pointer transition-all duration-150 rounded-none",
          "hover:text-secondary hover:border-secondary/20",
          active && "text-brand-solid border-brand-solid",
        ),
    },
    segmented: {
      base: "gap-0 p-0.5 bg-primary_hover rounded-lg",
      tab: (active: boolean) =>
        cx(
          "font-medium text-tertiary cursor-pointer transition-all duration-150 rounded-md",
          "hover:text-secondary",
          active && "bg-white text-brand-solid shadow-sm",
        ),
    },
  };

  return (
    <div data-caid="application/section-headers" className={className}>
      <div
        className={cx(
          "flex",
          variantClasses[variant].base,
          fullWidth && "[&>*]:flex-1",
          align === "center" && "justify-center",
          align === "end" && "justify-end",
        )}
        role="tablist"
      >
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              className={cx(
                "inline-flex items-center whitespace-nowrap",
                sizeClasses[size],
                variantClasses[variant].tab(active),
                item.disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {item.icon && (
                <span className="shrink-0 flex items-center">{item.icon}</span>
              )}
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cx(
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-semibold",
                    active ? "bg-white/20 text-white" : "bg-primary_hover text-tertiary",
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

SectionHeaders.displayName = "SectionHeaders";

/* ── Sub-components ── */

export function SectionHeaderTitle({ className, ...props }: ComponentPropsWithRef<"h3">) {
  return (
    <h3
      className={cx("text-sm font-semibold text-secondary", className)}
      {...props}
    />
  );
}
SectionHeaderTitle.displayName = "SectionHeaderTitle";

export function SectionHeaderDescription({ className, ...props }: ComponentPropsWithRef<"p">) {
  return (
    <p
      className={cx("text-xs text-tertiary mt-1", className)}
      {...props}
    />
  );
}
SectionHeaderDescription.displayName = "SectionHeaderDescription";
