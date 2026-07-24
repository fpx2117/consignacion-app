// src/hooks/useDolarBlue.ts
import { useState, useEffect } from "react";
import { DolarCriptoResponse } from "@/lib/integrations/dolarBlue";

export function useDolarBlue() {
  const [rate, setRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getRate() {
      try {
        const res = await fetch("https://dolarapi.com/v1/dolares/cripto");
        if (!res.ok) throw new Error("API Error");
        const data: DolarCriptoResponse = await res.json();
        setRate(data.venta);
      } catch (err) {
        console.error("Failed to fetch client-side dolar rate", err);
        setRate(1200); // Standard fallback
        setError("Failed to fetch rate");
      } finally {
        setIsLoading(false);
      }
    }

    getRate();
  }, []);

  return { rate, isLoading, error };
}
