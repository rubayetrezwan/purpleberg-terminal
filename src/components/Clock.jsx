import { useState, useEffect } from "react";
import { ts } from "../config";

// Isolated clock so the 1s tick only re-renders this span — not the whole
// terminal (sidebar, scrolling ticker, and the active screen's charts).
export default function Clock({ color }) {
  const [time, setTime] = useState(ts);
  useEffect(() => {
    const iv = setInterval(() => setTime(ts()), 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <span className="pb-mono" style={{ fontSize: "var(--fs-base)", color }}>
      {time}
    </span>
  );
}
