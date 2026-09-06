// Text, never a spinner.
export function Loading({ text = "LOADING…", className = "" }) {
  return <div className={`pb-loading${className ? " " + className : ""}`} role="status">{text}</div>;
}
