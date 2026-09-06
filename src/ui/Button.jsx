import { forwardRef } from "react";

export const Button = forwardRef(function Button(
  { variant = "ghost", size = "md", type = "button", loading = false, disabled = false, className = "", children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`pb-button pb-button--${variant} pb-button--${size}${className ? " " + className : ""}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}{loading ? "…" : ""}
    </button>
  );
});

// A square icon control: the label is both the accessible name and the
// tooltip, so the two can never drift apart. `pb-reset` is part of it — every
// call site was hand-rolling the button to add it, which is what left this
// component unused.
export function IconButton({ label, className = "", children, ...rest }) {
  return (
    <button
      type="button"
      className={`pb-reset pb-iconbtn${className ? " " + className : ""}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}
