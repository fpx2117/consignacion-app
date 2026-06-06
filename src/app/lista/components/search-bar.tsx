"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Barra de búsqueda moderna, mobile-first.
 * Fondo gris claro, bordes muy redondeados, icono de lupa.
 * Input grande con buen padding para uso táctil.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Buscar productos",
  className = "",
}: SearchBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className={`relative group ${className}`}>
      {/* Ícono lupa */}
      <Search
        className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 pointer-events-none transition-colors"
        style={{ color: value ? "var(--store-primary,#007AFF)" : "var(--store-muted,#8A8F98)" }}
      />

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full
          pl-12 pr-10
          py-3.5
          bg-gray-100
          rounded-2xl
          text-[15px] font-medium
          text-[var(--store-text,#0F172A)]
          placeholder:text-[var(--store-muted,#8A8F98)]
          outline-none
          border-2 border-transparent
          focus:border-[var(--store-primary,#007AFF)]
          focus:border-opacity-40
          focus:bg-white
          transition-all duration-200
        "
        style={{
          caretColor: "var(--store-primary,#007AFF)",
        }}
      />

      {/* Botón limpiar */}
      {value && (
        <button
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-300 transition-colors"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
