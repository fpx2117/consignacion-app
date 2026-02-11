import { useEffect, useRef } from "react";

interface UseBarcodeScannerProps {
  onScan: (code: string) => void;
  enabled?: boolean;
}

export const useBarcodeScanner = ({ onScan, enabled = true }: UseBarcodeScannerProps) => {
  const buffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      
      // Los scanners escriben con una velocidad menor a 30ms entre teclas
      // Si pasa más tiempo, es un humano escribiendo.
      if (now - lastKeyTime.current > 50) {
        buffer.current = "";
      }

      lastKeyTime.current = now;

      if (e.key === "Enter") {
        if (buffer.current.length > 2) {
          onScan(buffer.current);
          buffer.current = "";
        }
      } else if (e.key.length === 1) {
        buffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, enabled]);
};