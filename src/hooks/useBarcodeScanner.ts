import { useEffect, useRef } from "react";

interface UseBarcodeScannerProps {
  onScan: (code: string) => void;
  enabled?: boolean;
  minLength?: number;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export const useBarcodeScanner = ({ onScan, enabled = true, minLength = 3 }: UseBarcodeScannerProps) => {
  const buffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      const now = Date.now();

      // Los scanners escriben con una velocidad menor a 30ms entre teclas
      // Si pasa más tiempo, es un humano escribiendo.
      if (now - lastKeyTime.current > 50) {
        buffer.current = "";
      }

      lastKeyTime.current = now;

      if (e.key === "Enter") {
        const code = buffer.current.trim();
        if (code.length >= minLength) {
          onScan(code);
          buffer.current = "";
        }
      } else if (e.key === "Escape") {
        buffer.current = "";
      } else if (e.key.length === 1) {
        buffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, enabled, minLength]);
};
