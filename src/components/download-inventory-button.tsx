"use client";

import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { useSucursalStore } from "@/store/useSucursalStore";

export function DownloadInventoryButton() {
  const activeSucursalId = useSucursalStore((state) => state.activeSucursalId);

  const handleOpen = () => {
    // Abrimos la página de carga con la sucursal activa actual
    // Si activeSucursalId es 0 (Global), se cargará el general
    window.open(`/ver/inventario/${activeSucursalId}`, "_blank");
  };

  return (
    <Button
      variant="outline"
      onClick={handleOpen}
      className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-2xl h-12 px-6 font-bold shadow-lg transition-all active:scale-95"
    >
      <FileText className="h-5 w-5" />
      <span className="hidden sm:inline">Ver Inventario PDF</span>
      <span className="sm:hidden">Ver PDF</span>
    </Button>
  );
}