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

export function IconButton({ label, className = "", children, ...rest }) {
  return (
    <button type="button" className={`pb-iconbtn${className ? " " + className : ""}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}
