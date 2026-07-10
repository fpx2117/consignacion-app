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

async function createDetector() {
  if (typeof window === "undefined" || !window.BarcodeDetector) return null;

  const Detector = window.BarcodeDetector;
  const supported =
    typeof Detector.getSupportedFormats === "function"
      ? await Detector.getSupportedFormats().catch(() => [])
      : [];
  const formats =
    supported.length > 0
      ? PREFERRED_FORMATS.filter((f) => supported.includes(f))
      : PREFERRED_FORMATS;

  return new Detector(formats.length > 0 ? { formats } : undefined);
}

// Intenta obtener stream de cámara trasera con fallbacks progresivos
async function getCamera(): Promise<MediaStream> {
  const constraints: MediaStreamConstraints[] = [
    { audio: false, video: { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { audio: false, video: { facingMode: "environment" } },
    { audio: false, video: true },
  ];

  let lastErr: unknown;
  for (const c of constraints) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
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
  const startedRef = React.useRef(false);

  const [phase, setPhase] = React.useState<"idle" | "starting" | "ready" | "error">("idle");
  const [supported, setSupported] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // ── Detener todo ──────────────────────────────────────────────────────────
  const stopAll = React.useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      v.srcObject = null;
    }
    startedRef.current = false;
  }, []);

  // ── Loop de detección (solo corre cuando el video está reproduciendo) ─────
  const startDetectionLoop = React.useCallback(
    (detector: NonNullable<Awaited<ReturnType<typeof createDetector>>>) => {
      const tick = async () => {
        const v = videoRef.current;
        if (!v || v.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
          frameRef.current = requestAnimationFrame(() => void tick());
          return;
        }

        try {
          const results = await detector.detect(v);
          const match = results.find(
            (r) => typeof r.rawValue === "string" && r.rawValue.trim().length > 0
          );
          if (match?.rawValue) {
            const code = match.rawValue.trim();
            if (code !== lastValueRef.current) {
              lastValueRef.current = code;
              stopAll();
              onDetected(code);
              onOpenChange(false);
            }
            return;
          }
        } catch {
          // frame con error: seguir intentando
        }

        frameRef.current = requestAnimationFrame(() => void tick());
      };

      frameRef.current = requestAnimationFrame(() => void tick());
    },
    [onDetected, onOpenChange, stopAll]
  );

  // ── Iniciar cámara: llamado desde onCanPlay del <video> ───────────────────
  // Esta es la clave: no usamos Promises encadenadas para play().
  // El browser dispara onCanPlay cuando el video REALMENTE puede reproducir.
  // En ese momento solo iniciamos el loop de detección, sin llamar play() manualmente.
  const handleCanPlay = React.useCallback(async () => {
    const v = videoRef.current;
    if (!v || !streamRef.current) return;

    // Asegurarse que el video esté reproduciendo (puede ya estarlo por autoPlay)
    if (v.paused) {
      try {
        await v.play();
      } catch {
        // AbortError es normal si autoPlay ya lo arrancó; ignorar
      }
    }

    if (!detectorRef.current) return;
    setPhase("ready");
    startDetectionLoop(detectorRef.current);
  }, [startDetectionLoop]);

  // ── Efecto principal: pedir cámara cuando open=true ───────────────────────
  React.useEffect(() => {
    if (!open) {
      setPhase("idle");
      setErrorMsg(null);
      lastValueRef.current = null;
      stopAll();
      return;
    }

    // Evitar doble arranque
    if (startedRef.current) return;
    startedRef.current = true;

    setPhase("starting");
    setErrorMsg(null);
    lastValueRef.current = null;

    let cancelled = false;

    const init = async () => {
      // Esperar a que la animación CSS del Sheet termine (slide-in-from-bottom ~500ms)
      // y a que el Portal de Radix haya pintado el <video> en el DOM
      await new Promise<void>((r) => setTimeout(r, 550));
      if (cancelled) return;

      // Verificar que el nodo video ya está en el DOM
      if (!videoRef.current) {
        setErrorMsg("No se pudo inicializar la cámara. Intentá cerrar y abrir de nuevo.");
        setPhase("error");
        startedRef.current = false;
        return;
      }

      // Pedir stream y detector en paralelo
      let stream: MediaStream;
      try {
        const [s, detector] = await Promise.all([getCamera(), createDetector()]);
        stream = s;
        detectorRef.current = detector;
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof DOMException
            ? err.name === "NotAllowedError"
              ? "Permiso de cámara denegado. Habilitalo desde la configuración del navegador."
              : err.name === "NotFoundError"
              ? "No se encontró una cámara disponible en este dispositivo."
              : "No se pudo iniciar la cámara."
            : "No se pudo iniciar la cámara.";
        setErrorMsg(msg);
        setPhase("error");
        startedRef.current = false;
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (!detectorRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        setSupported(false);
        setErrorMsg(
          "Este navegador no soporta escaneo con cámara. Usá Chrome o Edge reciente, o el scanner físico."
        );
        setPhase("error");
        startedRef.current = false;
        return;
      }

      streamRef.current = stream;

      // Asignar el stream al <video>
      // El browser disparará onCanPlay cuando esté listo para reproducir.
      // NO llamamos play() aquí — lo maneja handleCanPlay o el atributo autoPlay.
      const v = videoRef.current;
      if (!v) {
        stream.getTracks().forEach((t) => t.stop());
        setPhase("error");
        startedRef.current = false;
        return;
      }

      v.srcObject = stream;
      // En algunos Android, load() ayuda a que el elemento procese el nuevo srcObject
      v.load();
    };

    void init();

    return () => {
      cancelled = true;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
          <div className="relative overflow-hidden rounded-2xl border bg-black shadow-inner">
            {/*
              El <video> tiene autoPlay + muted + playsInline como atributos HTML
              (no solo props de React) para máxima compatibilidad mobile.
              onCanPlay arranca el loop de detección cuando el browser confirma
              que hay frames disponibles — sin Promise chains ni play() manual.
              width/height explícitos para que el compositor de iOS reserve el layer.
            */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              controls={false}
              disablePictureInPicture
              width={1280}
              height={720}
              onCanPlay={handleCanPlay}
              className={cn(
                "aspect-[3/4] w-full object-cover sm:aspect-video",
                !supported && "opacity-40"
              )}
              aria-label="Vista previa de cámara para escaneo"
            />

            {/* Marco guía */}
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

            {phase === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm font-medium">Iniciando cámara...</span>
              </div>
            )}
          </div>

          {errorMsg ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{errorMsg}</p>
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
