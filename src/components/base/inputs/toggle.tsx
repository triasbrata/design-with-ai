import type { ReactNode } from "react";
import type {
  SwitchProps as AriaSwitchProps,
  SwitchRenderProps,
} from "react-aria-components";
import { Switch as AriaSwitch } from "react-aria-components";
import { cx } from "@/utils/cx";

export interface ToggleProps extends AriaSwitchProps {
  /** Label rendered next to the toggle */
  children?: ReactNode | ((vals: SwitchRenderProps) => ReactNode);
}

/**
 * Toggle / Switch component with brand accent color.
 *
 * ```tsx
 * <Toggle>Enable notifications</Toggle>
 * ```
 */
export function Toggle({ children, className, ...props }: ToggleProps) {
  return (
    <AriaSwitch
      {...props}
      className={(vals) =>
        cx(
          "group/toggle flex items-center gap-2 text-sm text-secondary",
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
              "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition duration-200",
              "group-data-[selected]/toggle:bg-brand-solid",
              // Thumb translation when selected
              "group-data-[selected]/toggle:[&>div]:translate-x-4",
              // Unselected state
              "bg-secondary/20",
              "group-data-[focused]/toggle:ring-2 group-data-[focused]/toggle:ring-brand-solid/20",
            )}
          >
            <div className="size-4 rounded-full bg-white shadow-sm transition duration-200" />
          </div>
          {typeof children === "function" ? children(vals) : children}
        </>
      )}
    </AriaSwitch>
  );
}
