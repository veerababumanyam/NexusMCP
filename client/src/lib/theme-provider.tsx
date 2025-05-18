import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

type Theme = "light" | "dark" | "system";

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  fontSettings: FontSettings | null;
  loadCustomFonts: () => void;
}

interface FontSettings {
  primaryFontFamily?: string;
  secondaryFontFamily?: string;
  primaryFontUrl?: string;
  secondaryFontUrl?: string;
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  fontSettings: null,
  loadCustomFonts: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "nexusmcp-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );
  const [fontSettings, setFontSettings] = useState<FontSettings | null>(null);
  const [fontStyleElement, setFontStyleElement] = useState<HTMLStyleElement | null>(null);

  // Fetch font settings from the API using public endpoint that doesn't require authentication
  const { data: brandingData } = useQuery({
    queryKey: ["/api/public-branding"],
    queryFn: async () => {
      try {
        // Use direct fetch instead of apiRequest to avoid auth headers
        const res = await fetch("/api/public-branding");
        if (!res.ok) {
          throw new Error(`Failed to fetch branding: ${res.status} ${res.statusText}`);
        }
        return await res.json();
      } catch (error) {
        console.error("Failed to fetch branding settings:", error);
        return null;
      }
    },
    retry: 3, // Retry a few times in case of network issues
    refetchOnWindowFocus: false,
  });

  // Set font settings from API data
  useEffect(() => {
    if (brandingData) {
      const settings: FontSettings = {
        primaryFontFamily: brandingData.primaryFontFamily,
        secondaryFontFamily: brandingData.secondaryFontFamily,
        primaryFontUrl: brandingData.primaryFontUrl,
        secondaryFontUrl: brandingData.secondaryFontUrl,
      };
      
      // Only update if there are actual changes
      if (JSON.stringify(settings) !== JSON.stringify(fontSettings)) {
        setFontSettings(settings);
      }
    }
  }, [brandingData]);

  // Load custom fonts
  const loadCustomFonts = () => {
    if (!fontSettings) return;

    // Remove existing style element if it exists
    if (fontStyleElement) {
      document.head.removeChild(fontStyleElement);
    }

    // Create a new style element
    const style = document.createElement("style");
    let cssRules = "";

    // Add primary font rules if URL is provided
    if (fontSettings.primaryFontUrl && fontSettings.primaryFontFamily) {
      cssRules += `
        @font-face {
          font-family: '${fontSettings.primaryFontFamily}';
          src: url('${fontSettings.primaryFontUrl}') format('woff2');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `;
    }

    // Add secondary font rules if URL is provided
    if (fontSettings.secondaryFontUrl && fontSettings.secondaryFontFamily) {
      cssRules += `
        @font-face {
          font-family: '${fontSettings.secondaryFontFamily}';
          src: url('${fontSettings.secondaryFontUrl}') format('woff2');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `;
    }

    // Add CSS variables for font families
    cssRules += `
      :root {
        --font-primary: ${fontSettings.primaryFontFamily || 'Inter, system-ui, sans-serif'};
        --font-secondary: ${fontSettings.secondaryFontFamily || 'Inter, system-ui, sans-serif'};
      }
      
      body {
        font-family: var(--font-primary);
      }
      
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-secondary);
      }
    `;

    style.textContent = cssRules;
    document.head.appendChild(style);
    setFontStyleElement(style);
  };

  // Apply custom fonts when font settings change
  useEffect(() => {
    if (fontSettings) {
      loadCustomFonts();
    }
    
    // Clean up function to remove style element when component unmounts
    return () => {
      if (fontStyleElement) {
        document.head.removeChild(fontStyleElement);
      }
    };
  }, [fontSettings]);

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove the old theme class
    root.classList.remove("light", "dark");

    // Add the new theme class
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Handle system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    // Handle system theme change
    const handleSystemThemeChange = () => {
      if (theme === "system") {
        const newTheme = mediaQuery.matches ? "dark" : "light";
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(newTheme);
      }
    };
    
    // Add event listener
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    
    // Initial check
    handleSystemThemeChange();
    
    // Clean up
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
    fontSettings,
    loadCustomFonts,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  
  return context;
};