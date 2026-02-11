"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export function DownloadInventoryButton() {
  const handleOpen = () => {
    // Abrimos la página de carga directamente (ID 0 para inventario general)
    window.open("/ver/inventario/0", "_blank");
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