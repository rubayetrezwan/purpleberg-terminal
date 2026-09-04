import { useEffect, useRef, useState } from "react";

// A value that flashes green or red for one animation cycle when it changes.
export function Price({ value, format, className = "", style }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (prev.current != null && value != null && !Number.isNaN(value) && value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
    }
    prev.current = value;
  }, [value]);
  return (
    <span className={`pb-price${flash ? ` pb-flash-${flash}` : ""}${className ? " " + className : ""}`} style={style} onAnimationEnd={() => setFlash(null)}>
      {format ? format(value) : value}
    </span>
  );
}
