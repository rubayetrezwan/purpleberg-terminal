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
  // animationend normally clears the flash, but an animation that never runs
  // never ends it: a hidden tab pauses them, and reduced motion collapses the
  // duration to 0.001ms. A stuck flash leaves the cell tinted for good, so the
  // timer is the backstop rather than the mechanism.
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(t);
  }, [flash]);
  return (
    <span className={`pb-price${flash ? ` pb-flash-${flash}` : ""}${className ? " " + className : ""}`} style={style} onAnimationEnd={() => setFlash(null)}>
      {format ? format(value) : value}
    </span>
  );
}
