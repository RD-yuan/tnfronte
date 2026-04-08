import type { WebSocket } from 'ws';

/**
 * WebSocket Hub — manages editor client connections and broadcasts
 * messages between the editor UI and backend.
 */
export class WebSocketHub {
  private clients = new Set<WebSocket>();

  /** Register a new editor client. */
  add(client: WebSocket) {
    this.clients.add(client);
    client.on('close', () => this.clients.delete(client));
    client.on('error', () => this.clients.delete(client));
  }

  /** Broadcast a message to all connected editors. */
  broadcast(message: Record<string, unknown>) {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) {
        client.send(data);
      }
    }
  }

  /** Send a message to a specific client. */
  send(client: WebSocket, message: Record<string, unknown>) {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}
