import { create } from "zustand";
import { StoreThemeConfig } from "@/lib/validators/settings";

interface ThemeState {
  activeTheme: StoreThemeConfig | null;
  previewTheme: StoreThemeConfig | null;
  isSaving: boolean;
  error: string | null;

  // Actions
  initTheme: (theme: StoreThemeConfig) => void;
  updatePreview: (partialTheme: Partial<StoreThemeConfig>) => void;
  saveTheme: () => Promise<void>;
  resetPreview: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  activeTheme: null,
  previewTheme: null,
  isSaving: false,
  error: null,

  initTheme: (theme) => {
    set({
      activeTheme: theme,
      previewTheme: theme,
      error: null,
    });
  },

  updatePreview: (partialTheme) => {
    set((state) => ({
      previewTheme: state.previewTheme
        ? { ...state.previewTheme, ...partialTheme }
        : null,
    }));
  },

  resetPreview: () => {
    set((state) => ({
      previewTheme: state.activeTheme,
      error: null,
    }));
  },

  saveTheme: async () => {
    const { previewTheme } = get();
    if (!previewTheme) return;

    set({ isSaving: true, error: null });

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ themeConfig: previewTheme }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar el tema");
      }

      await response.json();

      // Assume the API returns the updated theme or we just use the previewTheme
      set({
        activeTheme: previewTheme,
        isSaving: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Error desconocido",
        isSaving: false,
      });
      throw error;
    }
  },
}));
