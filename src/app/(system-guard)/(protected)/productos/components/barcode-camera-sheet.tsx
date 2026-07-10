"use client";

import * as React from "react";
import { AlertCircle, Barcode, Camera, Loader2, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): {
    detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
  };
  getSupportedFormats?: () => Promise<string[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

const PREFERRED_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar"];

// CAUSA #1 FIX: eliminado videoWidth>0 como condición bloqueante, agregado evento
// "playing" (el más confiable en iOS), timeout de emergencia de 5000ms y flag
// resolved para evitar resoluciones múltiples.
function waitForVideoReady(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let resolved = false;

    const handleReady = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve();
    };

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("playing", handleReady);
    };

    video.addEventListener("loadedmetadata", handleReady);
    video.addEventListener("loadeddata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("playing", handleReady);

    // Timeout de emergencia: resuelve aunque no lleguen eventos (5000ms)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve();
      }
    }, 5000);
  });
}

async function createDetector() {
  if (typeof window === "undefined" || !window.BarcodeDetector) return null;

  const Detector = window.BarcodeDetector;
  const supported = typeof Detector.getSupportedFormats === "function"
    ? await Detector.getSupportedFormats().catch(() => [])
    : [];
  const formats = supported.length > 0
    ? PREFERRED_FORMATS.filter((format) => supported.includes(format))
    : PREFERRED_FORMATS;

  return new Detector(formats.length > 0 ? { formats } : undefined);
}

// CAUSA #5 FIX: estrategia de dos intentos para getUserMedia.
// 1º intento: exact "environment" con dimensiones ideales.
// 2º intento si falla: facingMode "environment" sin exact.
// 3º intento si falla: sin facingMode (cualquier cámara).
async function getCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { exact: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment" },
      });
    } catch {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
    }
  }
}

interface BarcodeCameraSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}

export function BarcodeCameraSheet({ open, onOpenChange, onDetected }: BarcodeCameraSheetProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<Awaited<ReturnType<typeof createDetector>>>(null);
  const frameRef = React.useRef<number | null>(null);
  const lastValueRef = React.useRef<string | null>(null);

  const [starting, setStarting] = React.useState(false);
  const [supported, setSupported] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const stopScanner = React.useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);

  const handleDetected = React.useCallback((rawValue: string) => {
    const code = rawValue.trim();
    if (!code || code === lastValueRef.current) return;

    lastValueRef.current = code;
    stopScanner();
    onDetected(code);
    onOpenChange(false);
  }, [onDetected, onOpenChange, stopScanner]);

  React.useEffect(() => {
    if (!open) {
      setError(null);
      setStarting(false);
      lastValueRef.current = null;
      stopScanner();
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;

      const video = videoRef.current;
      const detector = detectorRef.current;

      if (video && detector && video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        try {
          const results = await detector.detect(video);
          const match = results.find((result) => typeof result.rawValue === "string" && result.rawValue.trim().length > 0);
          if (match?.rawValue) {
            handleDetected(match.rawValue);
            return;
          }
        } catch {
          setError("No se pudo procesar la imagen de la cámara.");
          stopScanner();
          return;
        }
      }

      frameRef.current = window.requestAnimationFrame(() => {
        void tick();
      });
    };

    const startScanner = async () => {
      setStarting(true);
      setError(null);
      lastValueRef.current = null;

      // CAUSA #3 FIX: esperar a que termine la animación CSS del Sheet (slide-in
      // duration-500) antes de inicializar la cámara. Algunos browsers (iOS) no
      // renderizan frames de video mientras el elemento está bajo un CSS transform.
      await new Promise<void>((r) => setTimeout(r, 520));

      if (cancelled) return;

      // CAUSA #2 FIX: getUserMedia() va PRIMERO, antes de createDetector(), para
      // que play() quede lo más cerca posible del gesto del usuario en iOS Safari.
      // createDetector() corre en paralelo con el setup del video via Promise.all.
      let stream: MediaStream;
      try {
        stream = await getCamera();
      } catch (err) {
        if (cancelled) return;

        const message = err instanceof DOMException
          ? err.name === "NotAllowedError"
            ? "No hay permiso para usar la cámara en este navegador. Revisá permisos del sitio y HTTPS si corresponde."
            : err.name === "NotFoundError"
              ? "No se encontró una cámara disponible en este dispositivo."
              : "No se pudo iniciar la cámara para escanear el código."
          : "No se pudo iniciar la cámara para escanear el código.";

        setError(message);
        setStarting(false);
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setStarting(false);
        return;
      }

      // CAUSA #2 FIX: asignar srcObject inmediatamente después del stream, antes
      // de cualquier otro await, para mantenerse en el call stack del gesto iOS.
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "true");
      video.setAttribute("autoplay", "true");
      video.srcObject = stream;

      // createDetector() corre en paralelo con waitForVideoReady() ya que el
      // stream ya fue asignado y srcObject ya está seteado.
      try {
        const [detector] = await Promise.all([
          createDetector(),
          waitForVideoReady(video),
        ]);

        detectorRef.current = detector;

        if (!detector) {
          if (!cancelled) {
            setSupported(false);
            setError("Este navegador no soporta escaneo de códigos con cámara. Probá con Chrome o Edge reciente, o usá el scanner físico.");
            setStarting(false);
            stopScanner();
          }
          return;
        }

        setSupported(true);

        await video.play();

        if (!cancelled) {
          setStarting(false);
          frameRef.current = window.requestAnimationFrame(() => {
            void tick();
          });
        }
      } catch (err) {
        if (cancelled) return;

        const message = err instanceof DOMException
          ? err.name === "NotAllowedError"
            ? "No hay permiso para usar la cámara en este navegador. Revisá permisos del sitio y HTTPS si corresponde."
            : err.name === "NotFoundError"
              ? "No se encontró una cámara disponible en este dispositivo."
              : "No se pudo iniciar la cámara para escanear el código."
          : "No se pudo iniciar la cámara para escanear el código.";

        setError(message);
        setStarting(false);
        stopScanner();
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [handleDetected, open, stopScanner]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[2rem] border-t p-0 max-h-[92dvh] overflow-hidden gap-0">
        <SheetHeader className="border-b bg-muted/20 px-5 py-4">
          <div className="flex items-center gap-2 text-primary">
            <Camera className="h-5 w-5" />
            <SheetTitle>Escanear codigo de barras</SheetTitle>
          </div>
          <SheetDescription>
            Alineá el código dentro del marco. Si tenés scanner físico, también podés usarlo directo sobre el campo.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5 pb-6">
          <div className="relative overflow-hidden rounded-2xl border bg-black/95 shadow-inner">
            {/* CAUSA #4 FIX: width y height HTML explícitos para que el compositor
                del browser (especialmente iOS) reserve correctamente la capa de
                renderizado. El CSS sigue controlando el layout visual. */}
            <video
              ref={videoRef}
              muted
              autoPlay
              playsInline
              controls={false}
              disablePictureInPicture
              width={1280}
              height={720}
              className={cn("aspect-[3/4] w-full object-cover sm:aspect-video", !supported && "opacity-40")}
              aria-label="Vista previa de cámara para escaneo"
            />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="relative w-full max-w-xs rounded-2xl border-2 border-primary/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                <span className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-xl border-l-4 border-t-4 border-white" />
                <span className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-xl border-r-4 border-t-4 border-white" />
                <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-xl border-b-4 border-l-4 border-white" />
                <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-xl border-b-4 border-r-4 border-white" />
                <div className="flex aspect-[1.8/1] items-center justify-center">
                  <ScanLine className="h-10 w-10 text-white/85" />
                </div>
              </div>
            </div>

            {starting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm font-medium">Iniciando cámara...</span>
              </div>
            )}
          </div>

          {error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <Barcode className="mt-0.5 h-4 w-4 shrink-0" />
                <p>El escaneo se completa apenas el navegador detecta un código válido.</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
