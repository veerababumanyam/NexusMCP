// Apply WebSocket fix for Vite HMR in Replit
import { installWebSocketFixes } from "./lib/websocketUtil";
import { mcpClient } from "./lib/mcpWebsocketClient";

// Initialize WebSocket fixes
installWebSocketFixes();

// Initialize MCP WebSocket client
// This will connect automatically when the application starts
mcpClient.connect();

// Log connection status
console.log(`[Main] MCP WebSocket initial state: ${mcpClient.getState()}`);

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./lib/theme-provider";
import { AuthProvider } from "./hooks/use-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

// Import i18n configuration - this initializes the internationalization
import './lib/i18n';

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
