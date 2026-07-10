"use client";

import * as React from "react";
import { AlertCircle, Barcode, Camera, Loader2, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ── Tipos para BarcodeDetector nativo ────────────────────────────────────────
type NativeBarcodeResult = { rawValue?: string };
type NativeBarcodeDetector = {
  detect: (source: ImageBitmapSource) => Promise<NativeBarcodeResult[]>;
};
type NativeBarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: NativeBarcodeDetectorConstructor;
  }
}

const PREFERRED_FORMATS = [
  "ean_13", "ean_8", "upc_a", "upc_e",
  "code_128", "code_39", "itf", "codabar",
];

// ── Obtener stream de cámara trasera con fallbacks ───────────────────────────
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

// ── Detector unificado: nativo o ZXing como fallback ─────────────────────────
type UnifiedDetector = {
  detect: (video: HTMLVideoElement) => Promise<string | null>;
  stop: () => void;
};

async function createUnifiedDetector(): Promise<UnifiedDetector | null> {
  // 1º intento: BarcodeDetector nativo (Chrome Android 83+, Edge, Safari 17+)
  if (typeof window !== "undefined" && window.BarcodeDetector) {
    try {
      const Ctor = window.BarcodeDetector;
      const supported =
        typeof Ctor.getSupportedFormats === "function"
          ? await Ctor.getSupportedFormats().catch(() => [] as string[])
          : [];
      const formats =
        supported.length > 0
          ? PREFERRED_FORMATS.filter((f) => supported.includes(f))
          : PREFERRED_FORMATS;
      const detector = new Ctor(formats.length > 0 ? { formats } : undefined);
      return {
        detect: async (video) => {
          const results = await detector.detect(video);
          const match = results.find(
            (r) => typeof r.rawValue === "string" && r.rawValue.trim().length > 0
          );
          return match?.rawValue?.trim() ?? null;
        },
        stop: () => { /* nativo no necesita cleanup */ },
      };
    } catch {
      // Falló la creación del detector nativo, caer a ZXing
    }
  }

  // 2º intento: ZXing como fallback JS puro (funciona en cualquier browser)
  // Usamos MultiFormatReader de @zxing/library directamente para decodificar
  // desde un canvas — más confiable que decodeOnceFromVideoElement que
  // intenta controlar el video internamente y choca con autoPlay.
  try {
    const { MultiFormatReader, BinaryBitmap, HybridBinarizer, HTMLCanvasElementLuminanceSource } =
      await import("@zxing/library");

    const zxingReader = new MultiFormatReader();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    return {
      detect: async (video) => {
        if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return null;
        try {
          // Capturar frame actual del video en canvas
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Decodificar desde el canvas con ZXing
          const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas);
          const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
          const result = zxingReader.decode(binaryBitmap);
          return result?.getText?.() ?? null;
        } catch {
          // NotFoundException es normal cuando no hay código en el frame
          return null;
        }
      },
      stop: () => { /* MultiFormatReader no requiere cleanup */ },
    };
  } catch {
    return null;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface BarcodeCameraSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}

export function BarcodeCameraSheet({
  open,
  onOpenChange,
  onDetected,
}: BarcodeCameraSheetProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<UnifiedDetector | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const lastValueRef = React.useRef<string | null>(null);
  const startedRef = React.useRef(false);
  const scanningRef = React.useRef(false);

  const [phase, setPhase] = React.useState<"idle" | "starting" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [debugLog, setDebugLog] = React.useState<string[]>([]);

  const log = React.useCallback((msg: string) => {
    setDebugLog((prev) => [...prev.slice(-6), `${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}: ${msg}`]);
  }, []);

  // ── Detener todo ────────────────────────────────────────────────────────────
  const stopAll = React.useCallback(() => {
    scanningRef.current = false;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    detectorRef.current?.stop();
    detectorRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const v = videoRef.current;
    if (v) v.srcObject = null;
    startedRef.current = false;
  }, []);

  // ── Loop de detección con rAF (para detector nativo) ───────────────────────
  const startNativeLoop = React.useCallback(
    (detector: UnifiedDetector) => {
      scanningRef.current = true;
      log("loop iniciado");

      const tick = async () => {
        if (!scanningRef.current) return;
        const v = videoRef.current;

        if (v && v.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
          try {
            const code = await detector.detect(v);
            if (code && code !== lastValueRef.current) {
              log(`detectado: ${code}`);
              lastValueRef.current = code;
              stopAll();
              onDetected(code);
              onOpenChange(false);
              return;
            }
          } catch {
            // frame con error, seguir
          }
        }

        frameRef.current = requestAnimationFrame(() => void tick());
      };

      frameRef.current = requestAnimationFrame(() => void tick());
    },
    [onDetected, onOpenChange, stopAll, log]
  );

  // ── Cuando el video puede reproducir: iniciar detección ────────────────────
  const handleCanPlay = React.useCallback(() => {
    const v = videoRef.current;
    const detector = detectorRef.current;
    log(`onCanPlay — detector:${detector ? "OK" : "null"} scanning:${scanningRef.current}`);
    if (!v || !detector || scanningRef.current) return;

    // Asegurar reproducción (autoPlay puede no haber arrancado aún)
    if (v.paused) {
      v.play().catch(() => { /* AbortError si autoPlay ya corrió */ });
    }

    setPhase("ready");
    startNativeLoop(detector);
  }, [startNativeLoop, log]);

  // ── Efecto principal ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) {
      setPhase("idle");
      setErrorMsg(null);
      lastValueRef.current = null;
      stopAll();
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    setPhase("starting");
    setErrorMsg(null);
    lastValueRef.current = null;

    let cancelled = false;

    const init = async () => {
      log("init: esperando animación...");
      // Esperar animación del Sheet (slide-in ~500ms) + paint del Portal de Radix
      await new Promise<void>((r) => setTimeout(r, 600));
      if (cancelled) return;

      log("init: pidiendo cámara + detector...");
      // Obtener stream + detector en paralelo
      let stream: MediaStream;
      let detector: UnifiedDetector | null;

      try {
        [stream, detector] = await Promise.all([getCamera(), createUnifiedDetector()]);
        log(`init: stream OK, detector:${detector ? "OK" : "null"}`);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof DOMException
            ? err.name === "NotAllowedError"
              ? "Permiso de cámara denegado. Habilitalo desde Configuración del navegador."
              : err.name === "NotFoundError"
              ? "No se encontró ninguna cámara en este dispositivo."
              : "No se pudo acceder a la cámara."
            : "No se pudo acceder a la cámara.";
        log(`ERROR cámara: ${msg}`);
        setErrorMsg(msg);
        setPhase("error");
        startedRef.current = false;
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        detector?.stop();
        return;
      }

      if (!detector) {
        stream.getTracks().forEach((t) => t.stop());
        const msg = "Este navegador no soporta escaneo de códigos. Usá el scanner físico o ingresá el código manualmente.";
        log(`ERROR: ${msg}`);
        setErrorMsg(msg);
        setPhase("error");
        startedRef.current = false;
        return;
      }

      streamRef.current = stream;
      detectorRef.current = detector;

      const v = videoRef.current;
      if (!v) {
        stream.getTracks().forEach((t) => t.stop());
        detector.stop();
        const msg = "Error interno al inicializar la cámara. Cerrá y volvé a intentar.";
        log(`ERROR: videoRef null`);
        setErrorMsg(msg);
        setPhase("error");
        startedRef.current = false;
        return;
      }

      log(`init: asignando srcObject, videoRef OK`);
      // Asignar stream al video. El browser dispara onCanPlay cuando hay frames.
      // load() fuerza el procesamiento del nuevo srcObject en algunos Android.
      v.srcObject = stream;
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
      <SheetContent
        side="bottom"
        className="rounded-t-[2rem] border-t p-0 max-h-[92dvh] overflow-hidden gap-0"
      >
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
              className={cn("aspect-[3/4] w-full object-cover sm:aspect-video")}
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

          {/* DEBUG TEMPORAL — borrar después */}
          {debugLog.length > 0 && (
            <div className="rounded-xl border border-yellow-400/40 bg-yellow-50/80 px-3 py-2 font-mono text-[10px] text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200">
              {debugLog.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
