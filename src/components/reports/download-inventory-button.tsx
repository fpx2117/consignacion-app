"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { InventoryPdfOptionsDialog } from "@/components/reports/inventory-pdf-options-dialog";

export function DownloadInventoryButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-2xl h-12 px-6 font-bold shadow-lg transition-all active:scale-95"
      >
        <FileText className="h-5 w-5" />
        <span className="hidden sm:inline">Ver Inventario PDF</span>
        <span className="sm:hidden">Ver PDF</span>
      </Button>

      <InventoryPdfOptionsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
