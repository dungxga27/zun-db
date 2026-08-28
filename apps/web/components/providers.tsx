"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider, theme } from "antd";
import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
const ThemeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>({ mode: "system", setMode: () => undefined });
export const useThemeMode = () => useContext(ThemeContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }));
  const [mode, setModeState] = useState<ThemeMode>(() => typeof window === "undefined" ? "system" : (localStorage.getItem("zun-theme") as ThemeMode | null) || "system");
  const [systemDark, setSystemDark] = useState(() => typeof window !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const setMode = (next: ThemeMode) => {
    localStorage.setItem("zun-theme", next);
    setModeState(next);
  };
  const dark = mode === "dark" || (mode === "system" && systemDark);

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      <ConfigProvider theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm, token: { colorPrimary: "#1677ff", borderRadius: 10, fontFamily: "var(--font-quicksand), sans-serif" } }}>
        <App><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></App>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
