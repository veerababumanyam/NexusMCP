/**
 * WebSocket Fix Module - DISABLED
 * 
 * This module has been disabled to prevent conflicts with the refactored
 * mcpWebsocketClient implementation. The module is kept for compatibility
 * but all of its functions are no-ops that just log messages.
 */

class WebSocketFix {
  /**
   * Creates a stable WebSocket URL
   * @param {string} path The WebSocket path
   * @returns {string} The WebSocket URL (unused but returned for compatibility)
   */
  createStableWebSocketUrl(path) {
    console.log('[WebSocket Fix] Module is disabled - using direct WebSocket connection instead');
    return path;
  }

  /**
   * Creates a reconnecting WebSocket (disabled)
   * @returns {WebSocket|null} Always returns null
   */
  createReconnectingWebSocket() {
    console.log('[WebSocket Fix] Module is disabled - using direct WebSocket connection instead');
    return null;
  }
}

// Export a singleton instance
export default new WebSocketFix();