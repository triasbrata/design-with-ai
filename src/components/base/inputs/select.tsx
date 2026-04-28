import type {
  ButtonProps as AriaButtonProps,
  LabelProps as AriaLabelProps,
  ListBoxItemProps as AriaListBoxItemProps,
  ListBoxProps as AriaListBoxProps,
  PopoverProps as AriaPopoverProps,
  SelectProps as AriaSelectProps,
  SelectValueProps as AriaSelectValueProps,
} from "react-aria-components";
import {
  Button as AriaButton,
  Label as AriaLabel,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  Popover as AriaPopover,
  Select as AriaSelect,
  SelectValue as AriaSelectValue,
} from "react-aria-components";
import { cx } from "@/utils/cx";

/**
 * Select root — wraps Label + Button + Popover.
 */
export function Select<T extends object>(props: AriaSelectProps<T>) {
  return (
    <AriaSelect
      {...props}
      className={(vals) =>
        cx(
          "group/select flex w-full flex-col gap-1.5",
          typeof props.className === "function"
            ? props.className(vals)
            : props.className,
        )
      }
    />
  );
}

/**
 * Styled label for Select.
 */
export function SelectLabel(props: AriaLabelProps) {
  return (
    <AriaLabel
      {...props}
      className={cx("text-sm font-medium text-secondary", props.className)}
    />
  );
}

/**
 * Select trigger button — styled like InputField with dropdown arrow.
 */
export function SelectButton({ children, className, ...props }: AriaButtonProps) {
  return (
    <AriaButton
      {...props}
      className={(vals) =>
        cx(
          "flex w-full items-center gap-2 rounded-lg border border-secondary/10 bg-primary px-3 py-2 text-sm text-secondary outline-none transition duration-100",
          "focus:border-brand-solid focus:ring-2 focus:ring-brand-solid/20",
          "group-data-[invalid]/select:border-error-solid group-data-[invalid]/select:ring-2 group-data-[invalid]/select:ring-error-solid/20",
          "data-[pressed]:bg-primary_hover",
          "disabled:cursor-not-allowed disabled:opacity-50",
          typeof className === "function" ? className(vals) : className,
        )
      }
    >
      {children || (
        <>
          <SelectValue className="flex-1 text-left" />
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="shrink-0 text-tertiary"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </>
      )}
    </AriaButton>
  );
}

/**
 * SelectValue — renders the currently selected value as text.
 */
export function SelectValue<T extends object>(props: AriaSelectValueProps<T>) {
  return (
    <AriaSelectValue
      {...props}
      className={(vals) =>
        cx(
          "flex-1 text-left text-sm",
          typeof props.className === "function"
            ? props.className(vals)
            : props.className,
        )
      }
    />
  );
}

/**
 * Dropdown popover.
 */
export function SelectPopover(props: AriaPopoverProps) {
  return (
    <AriaPopover
      {...props}
      className={(vals) =>
        cx(
          "z-50 min-w-[--trigger-width] overflow-hidden rounded-lg border border-secondary/10 bg-primary p-1 shadow-lg",
          "origin-top",
          vals.isEntering && "duration-200 ease-out animate-in fade-in zoom-in-95",
          vals.isExiting && "duration-150 ease-in animate-out fade-out zoom-out-95",
          typeof props.className === "function"
            ? props.className(vals)
            : props.className,
        )
      }
    />
  );
}

/**
 * ListBox options container.
 */
export function SelectListBox<T extends object>(props: AriaListBoxProps<T>) {
  return (
    <AriaListBox
      {...props}
      className={(vals) =>
        cx(
          "max-h-60 overflow-auto outline-none",
          typeof props.className === "function"
            ? props.className(vals)
            : props.className,
        )
      }
    />
  );
}

/**
 * Individual option item.
 */
export function SelectItem(props: AriaListBoxItemProps) {
  return (
    <AriaListBoxItem
      {...props}
      className={(vals) =>
        cx(
          "relative flex cursor-default select-none items-center gap-2 rounded-md px-3 py-2 text-sm text-secondary outline-none",
          "data-[focused]:bg-primary_hover",
          "data-[selected]:font-medium data-[selected]:text-brand-solid",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          typeof props.className === "function"
            ? props.className(vals)
            : props.className,
        )
      }
    />
  );
}
