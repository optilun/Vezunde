import { useEffect, useState } from "react";

// Valoarea se actualizeaza abia dupa o pauza (ex. textul tastat in /cauta).
// 2026-09-29 (audit /cauta, D3): mutat din Search.jsx.
export default function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
