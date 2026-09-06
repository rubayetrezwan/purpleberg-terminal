import { forwardRef } from "react";

export const Input = forwardRef(function Input({ mono = false, className = "", ...rest }, ref) {
  return <input ref={ref} className={`pb-input${mono ? " pb-input--mono" : ""}${className ? " " + className : ""}`} {...rest} />;
});
