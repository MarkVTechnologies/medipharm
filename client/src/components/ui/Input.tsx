import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const control =
  "w-full rounded-md border border-border bg-canvas px-3 text-md text-fg placeholder:text-fg-4 transition-[border-color,box-shadow] " +
  "hover:border-border-strong focus:border-brand-500 focus:outline-none focus:shadow-[0_0_0_3px_rgb(25_118_210/0.2)] " +
  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-fg-3 aria-[invalid=true]:border-danger-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode; invalid?: boolean }>(
  function Input({ className, leading, invalid, ...props }, ref) {
    if (leading) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-4 [&_svg]:size-4">{leading}</span>
          <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, "h-[38px] pl-9", className)} {...props} />
        </div>
      );
    }
    return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, "h-[38px]", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        "h-[38px] appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%2366707d%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(control, "min-h-20 py-2", className)} {...props} />;
});

/**
 * Label + control + hint/error. The control receives the generated id via render prop.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg-2">
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}
