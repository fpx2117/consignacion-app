"use client";

import Image from "next/image";
import * as React from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiService } from "@/lib/apiService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  onUploadingChange?: (loading: boolean) => void;
}

export function ImageUpload({
  value,
  onChange,
  disabled,
  onUploadingChange,
}: ImageUploadProps) {
  const [loading, setLoading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    onUploadingChange?.(loading);
  }, [loading, onUploadingChange]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación básica
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen es demasiado pesada (máx 5MB)");
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.uploadImage(file);
      onChange(res.url);
      toast.success("Imagen cargada");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error al subir la imagen");
    } finally {
      setLoading(false);
      // Reset input para permitir subir la misma después si se borra
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className="space-y-4 w-full">
      <div
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl transition-all h-40 overflow-hidden",
          value
            ? "border-primary/20 bg-primary/5"
            : "border-muted-foreground/20 hover:border-primary/40 bg-muted/20",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        onClick={() => !disabled && !loading && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={onUpload}
          disabled={disabled || loading}
        />

        {value ? (
          <>
            <Image
              src={value}
              alt="Preview"
              fill
              unoptimized
              sizes="320px"
              className="object-contain p-2"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-lg"
              onClick={onRemove}
              disabled={disabled || loading}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <>
                <div className="p-3 rounded-full bg-background border border-border">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold">Subir Imagen</p>
                  <p className="text-xs opacity-60">
                    Click para seleccionar (Máx 5MB)
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
