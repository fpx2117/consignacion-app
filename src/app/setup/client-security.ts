const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export function fileToBase64(
  file: File,
): Promise<{ data: string; mime: string }> {
  if (!ALLOWED_LOGO_TYPES.has(file.type))
    return Promise.reject(new Error("Formato de logo no permitido"));
  if (file.size > MAX_LOGO_BYTES)
    return Promise.reject(new Error("El logo supera el máximo de 5 MB"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const [mimeInfo, data] = result.split(";base64,");
      const mime = mimeInfo?.split(":")[1];
      if (!data || mime !== file.type) {
        reject(new Error("No se pudo validar el logo"));
        return;
      }
      resolve({ data, mime });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
