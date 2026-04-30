import type { ReactNode } from "react";
import { cx, sortCx } from "@/utils/cx";

export const badgeStyles = sortCx({
  sizes: {
    sm: "px-1.5 py-0.5 text-xs rounded-md",
    md: "px-2 py-1 text-xs rounded-lg",
    lg: "px-2.5 py-1.5 text-sm rounded-lg",
  },
  colors: {
    "brand": "bg-brand-solid/10 text-brand-solid",
    "primary": "bg-primary text-secondary",
    "secondary": "bg-secondary/10 text-secondary",
    "error": "bg-error-solid/10 text-error-solid",
    "success": "bg-[#D4F5E4] text-[#2D6A4F]",
    "warning": "bg-[#FFF1D6] text-[#8A6D3B]",
  },
});

export interface BadgeProps {
  children: ReactNode;
  /** Size variant */
  size?: keyof typeof badgeStyles.sizes;
  /** Color scheme */
  color?: keyof typeof badgeStyles.colors;
  className?: string;
  /** Shows a small dot indicator before the text */
  dot?: boolean;
  /** Shows a remove button (calls this when clicked) */
  onRemove?: () => void;
}

/**
 * Badge / Tag component with color variants using brand tokens.
 */
export function Badge({
  children,
  size = "md",
  color = "brand",
  className,
  dot,
  onRemove,
}: BadgeProps) {
  return (
    <span
      data-caid="base/badge"
      className={cx(
        "inline-flex items-center gap-1 font-medium whitespace-nowrap",
        badgeStyles.sizes[size],
        badgeStyles.colors[color],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full hover:bg-black/10"
          aria-label="Remove"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
}
