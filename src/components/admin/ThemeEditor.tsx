"use client";

import React from "react";
import { useThemeStore } from "@/store/themeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const FONTS = [
  "Inter",
  "Roboto",
  "Nunito Sans",
  "Rubik",
  "Poppins",
  "Montserrat",
];

export function ThemeEditor() {
  const { previewTheme, updatePreview, saveTheme, isSaving, error } = useThemeStore();

  if (!previewTheme) {
    return (
      <div className="flex justify-center items-center p-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Cargando configuración del tema...</span>
      </div>
    );
  }

  const handleColorChange = (key: keyof typeof previewTheme, value: string) => {
    updatePreview({ [key]: value });
  };

  const handleFontChange = (key: "headingFont" | "bodyFont", value: string) => {
    updatePreview({ [key]: value });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* Editor Panel */}
      <div className="flex flex-col gap-6">
        <Card className="shadow-sm border-neutral-200">
          <CardHeader>
            <CardTitle className="text-xl font-medium">Colores</CardTitle>
            <CardDescription>
              Personaliza los colores principales de tu tienda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="primaryColor">Color Primario</Label>
                <div className="flex gap-3 items-center">
                  <div className="relative">
                    <Input
                      id="primaryColor"
                      type="color"
                      className="w-10 h-10 p-0 border-0 cursor-pointer overflow-hidden rounded-md absolute inset-0 opacity-0"
                      value={previewTheme.primaryColor}
                      onChange={(e) => handleColorChange("primaryColor", e.target.value)}
                    />
                    <div 
                      className="w-10 h-10 rounded-md shadow-sm border"
                      style={{ backgroundColor: previewTheme.primaryColor }}
                    />
                  </div>
                  <Input 
                    type="text" 
                    value={previewTheme.primaryColor}
                    onChange={(e) => handleColorChange("primaryColor", e.target.value)}
                    className="flex-1 font-mono uppercase h-10"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="secondaryColor">Color Secundario</Label>
                <div className="flex gap-3 items-center">
                  <div className="relative">
                    <Input
                      id="secondaryColor"
                      type="color"
                      className="w-10 h-10 p-0 border-0 cursor-pointer overflow-hidden rounded-md absolute inset-0 opacity-0"
                      value={previewTheme.secondaryColor}
                      onChange={(e) => handleColorChange("secondaryColor", e.target.value)}
                    />
                    <div 
                      className="w-10 h-10 rounded-md shadow-sm border"
                      style={{ backgroundColor: previewTheme.secondaryColor }}
                    />
                  </div>
                  <Input 
                    type="text" 
                    value={previewTheme.secondaryColor}
                    onChange={(e) => handleColorChange("secondaryColor", e.target.value)}
                    className="flex-1 font-mono uppercase h-10"
                  />
                </div>
              </div>

              <div className="space-y-3 sm:col-span-2">
                <Label htmlFor="backgroundColor">Color de Fondo</Label>
                <div className="flex gap-3 items-center">
                  <div className="relative">
                    <Input
                      id="backgroundColor"
                      type="color"
                      className="w-10 h-10 p-0 border-0 cursor-pointer overflow-hidden rounded-md absolute inset-0 opacity-0"
                      value={previewTheme.backgroundColor}
                      onChange={(e) => handleColorChange("backgroundColor", e.target.value)}
                    />
                    <div 
                      className="w-10 h-10 rounded-md shadow-sm border"
                      style={{ backgroundColor: previewTheme.backgroundColor }}
                    />
                  </div>
                  <Input 
                    type="text" 
                    value={previewTheme.backgroundColor}
                    onChange={(e) => handleColorChange("backgroundColor", e.target.value)}
                    className="flex-1 font-mono uppercase h-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-neutral-200">
          <CardHeader>
            <CardTitle className="text-xl font-medium">Tipografía</CardTitle>
            <CardDescription>
              Selecciona las fuentes para los títulos y el contenido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="headingFont">Fuente de Encabezados</Label>
                <Select 
                  value={previewTheme.headingFont} 
                  onValueChange={(value) => handleFontChange("headingFont", value)}
                >
                  <SelectTrigger id="headingFont" className="h-10">
                    <SelectValue placeholder="Selecciona una fuente" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map(font => (
                      <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="bodyFont">Fuente de Cuerpo</Label>
                <Select 
                  value={previewTheme.bodyFont} 
                  onValueChange={(value) => handleFontChange("bodyFont", value)}
                >
                  <SelectTrigger id="bodyFont" className="h-10">
                    <SelectValue placeholder="Selecciona una fuente" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map(font => (
                      <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-4 rounded-md bg-red-50 text-red-600 text-sm border border-red-100">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button 
            size="lg" 
            onClick={saveTheme} 
            disabled={isSaving}
            className="w-full sm:w-auto font-medium transition-all shadow-md hover:shadow-lg"
            style={{ 
              backgroundColor: previewTheme.primaryColor,
              color: previewTheme.backgroundColor === '#ffffff' ? '#ffffff' : previewTheme.backgroundColor
            }}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar Cambios"
            )}
          </Button>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="sticky top-6">
        <Card className="overflow-hidden border transition-all duration-500 shadow-lg" style={{ borderColor: previewTheme.primaryColor }}>
          <div className="bg-neutral-100/50 p-3 border-b flex items-center justify-between">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="text-xs text-neutral-500 font-mono">Vista Previa Dinámica</div>
          </div>
          
          <div 
            className="p-8 transition-colors duration-500 min-h-[500px]"
            style={{ 
              backgroundColor: previewTheme.backgroundColor,
              fontFamily: previewTheme.bodyFont
            }}
          >
            <div className="max-w-md mx-auto space-y-10">
              {/* Header preview */}
              <header className="flex justify-between items-center pb-6 border-b transition-colors duration-500" style={{ borderColor: `${previewTheme.primaryColor}20` }}>
                <div 
                  className="text-2xl font-bold transition-colors duration-500"
                  style={{ 
                    fontFamily: previewTheme.headingFont,
                    color: previewTheme.primaryColor
                  }}
                >
                  MiTienda
                </div>
                <nav className="flex gap-5 text-sm font-medium transition-colors duration-500" style={{ color: previewTheme.secondaryColor }}>
                  <span className="cursor-pointer hover:opacity-80">Inicio</span>
                  <span className="cursor-pointer hover:opacity-80">Catálogo</span>
                  <span className="cursor-pointer hover:opacity-80">Contacto</span>
                </nav>
              </header>

              {/* Hero preview */}
              <div className="space-y-5 py-2">
                <h1 
                  className="text-4xl font-extrabold leading-tight tracking-tight transition-colors duration-500"
                  style={{ 
                    fontFamily: previewTheme.headingFont,
                    color: previewTheme.primaryColor 
                  }}
                >
                  Descubre la nueva colección
                </h1>
                <p className="text-lg opacity-80 leading-relaxed transition-colors duration-500" style={{ color: previewTheme.primaryColor }}>
                  Diseños exclusivos creados para destacar. Explora nuestro catálogo y encuentra exactamente lo que buscas hoy mismo.
                </p>
                <div className="pt-4 flex flex-wrap gap-4">
                  <button 
                    className="px-6 py-2.5 rounded-md font-medium transition-all duration-500 shadow-sm hover:shadow-md"
                    style={{ 
                      backgroundColor: previewTheme.primaryColor,
                      color: previewTheme.backgroundColor === '#ffffff' ? '#ffffff' : previewTheme.backgroundColor,
                      fontFamily: previewTheme.headingFont
                    }}
                  >
                    Comprar Ahora
                  </button>
                  <button 
                    className="px-6 py-2.5 rounded-md font-medium transition-all duration-500 hover:bg-neutral-50/10"
                    style={{ 
                      backgroundColor: 'transparent',
                      color: previewTheme.secondaryColor,
                      border: `1px solid ${previewTheme.secondaryColor}`,
                      fontFamily: previewTheme.headingFont
                    }}
                  >
                    Saber Más
                  </button>
                </div>
              </div>

              {/* Product cards preview */}
              <div className="grid grid-cols-2 gap-5 pt-6">
                {[1, 2].map((item) => (
                  <div 
                    key={item} 
                    className="rounded-xl p-4 shadow-sm border transition-all duration-500 hover:shadow-md"
                    style={{ 
                      backgroundColor: previewTheme.backgroundColor === '#ffffff' ? '#ffffff' : `${previewTheme.backgroundColor}80`,
                      borderColor: `${previewTheme.primaryColor}15`
                    }}
                  >
                    <div 
                      className="w-full h-36 rounded-lg mb-4 opacity-20 transition-colors duration-500"
                      style={{ backgroundColor: previewTheme.secondaryColor }}
                    ></div>
                    <h3 
                      className="font-semibold text-lg transition-colors duration-500"
                      style={{ fontFamily: previewTheme.headingFont, color: previewTheme.primaryColor }}
                    >
                      Producto {item}
                    </h3>
                    <p className="text-sm font-medium mt-1 transition-colors duration-500" style={{ color: previewTheme.secondaryColor }}>
                      $99.00
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
