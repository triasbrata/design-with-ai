import type { ReactNode } from "react";
import type {
  CheckboxProps as AriaCheckboxProps,
  CheckboxRenderProps,
} from "react-aria-components";
import { Checkbox as AriaCheckbox } from "react-aria-components";
import { cx } from "@/utils/cx";

export interface CheckboxInputProps extends AriaCheckboxProps {
  /** Label rendered next to the checkbox */
  children?: ReactNode | ((vals: CheckboxRenderProps) => ReactNode);
}

/**
 * Checkbox component with brand accent color.
 *
 * ```tsx
 * <Checkbox>Remember me</Checkbox>
 * ```
 */
export function Checkbox({ children, className, ...props }: CheckboxInputProps) {
  return (
    <div data-caid="base/checkbox">
      <AriaCheckbox
        {...props}
        className={(vals) =>
          cx(
            "group/check flex items-center gap-2 text-sm text-secondary",
            "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
            !props.isDisabled && "cursor-pointer",
            typeof className === "function" ? className(vals) : className,
          )
        }
      >
        {(vals) => (
          <>
            <div
              className={cx(
                "flex size-4 shrink-0 items-center justify-center rounded border border-secondary/30 transition duration-100",
                "group-data-[selected]/check:border-brand-solid group-data-[selected]/check:bg-brand-solid",
                "group-data-[focused]/check:ring-2 group-data-[focused]/check:ring-brand-solid/20",
                "group-data-[indeterminate]/check:border-brand-solid group-data-[indeterminate]/check:bg-brand-solid",
              )}
            >
              {vals.isIndeterminate ? (
                <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
                  <rect width="10" height="2" rx="1" fill="white" />
                </svg>
              ) : (
                <svg
                  width="10" height="8" viewBox="0 0 10 8" fill="none"
                  className={cx(
                    "transition-opacity duration-100",
                    vals.isSelected ? "opacity-100" : "opacity-0",
                  )}
                >
                  <path
                    d="M1 4l2.5 2.5L9 1"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            {typeof children === "function" ? children(vals) : children}
          </>
        )}
      </AriaCheckbox>
    </div>
  );
}
