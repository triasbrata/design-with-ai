import type { ReactNode } from "react";
import type {
  FieldErrorProps as AriaFieldErrorProps,
  InputProps as AriaInputProps,
  LabelProps as AriaLabelProps,
  TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import {
  FieldError as AriaFieldError,
  Input as AriaInput,
  Label as AriaLabel,
  TextField as AriaTextField,
} from "react-aria-components";
import { cx } from "@/utils/cx";

/**
 * TextField root — wraps Label + Input + FieldError with group context.
 */
export function TextField(props: AriaTextFieldProps) {
  return (
    <AriaTextField
      {...props}
      className={(vals) =>
        cx(
          "group/field flex w-full flex-col gap-1.5",
          typeof props.className === "function"
            ? props.className(vals)
            : props.className,
        )
      }
    />
  );
}

/**
 * Styled label for TextField / Select / etc.
 */
export function Label(props: AriaLabelProps) {
  return (
    <AriaLabel
      {...props}
      className={cx("text-sm font-medium text-secondary", props.className)}
    />
  );
}

export interface InputFieldProps extends AriaInputProps {
  /** Leading icon element */
  iconLeading?: ReactNode;
  /** Trailing icon element */
  iconTrailing?: ReactNode;
}

/**
 * Styled input element with leading/trailing icon support.
 */
export function InputField({
  iconLeading,
  iconTrailing,
  className,
  ...props
}: InputFieldProps) {
  return (
    <div
      className={cx(
        "flex w-full items-center gap-2 rounded-lg border border-secondary/10 bg-primary px-3 py-2 transition duration-100",
        "has-[:focus]:border-brand-solid has-[:focus]:ring-2 has-[:focus]:ring-brand-solid/20",
        "group-data-[invalid]/field:border-error-solid group-data-[invalid]/field:ring-2 group-data-[invalid]/field:ring-error-solid/20",
        "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
        "*:data-slot:pointer-events-none *:data-slot:size-5 *:data-slot:shrink-0",
      )}
    >
      {iconLeading && (
        <span data-slot="leading" className="text-tertiary">
          {iconLeading}
        </span>
      )}
      <AriaInput
        {...props}
        className={(vals) =>
          cx(
            "w-full bg-transparent text-sm text-secondary outline-none placeholder:text-tertiary",
            "disabled:cursor-not-allowed",
            typeof className === "function" ? className(vals) : className,
          )
        }
      />
      {iconTrailing && (
        <span data-slot="trailing" className="text-tertiary">
          {iconTrailing}
        </span>
      )}
    </div>
  );
}

/**
 * Styled field error message.
 */
export function FieldError(props: AriaFieldErrorProps) {
  return (
    <AriaFieldError
      {...props}
      className={(vals) =>
        cx(
          "text-xs text-error-solid",
          typeof props.className === "function"
            ? props.className(vals)
            : props.className,
        )
      }
    />
  );
}
