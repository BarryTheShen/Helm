import ReconnectingWebSocket from 'reconnecting-websocket';
import { wsMessageSchema } from '@/utils/validation';

type MessageHandler = (message: any) => void;
type ConnectionHandler = () => void;

export class WebSocketService {
  private ws: ReconnectingWebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private url: string,
    private token: string
  ) {}

  connect(): void {
    if (this.ws) {
      return;
    }

    const wsUrl = `${this.url}?token=${this.token}`;
    this.ws = new ReconnectingWebSocket(wsUrl, [], {
      maxRetries: 10,
      connectionTimeout: 5000,
      maxReconnectionDelay: 10000,
      minReconnectionDelay: 1000,
    });

    this.ws.addEventListener('open', () => {
      this.startHeartbeat();
      this.connectHandlers.forEach((handler) => handler());
    });

    this.ws.addEventListener('close', () => {
      this.stopHeartbeat();
      this.disconnectHandlers.forEach((handler) => handler());
    });

    this.ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        const validated = wsMessageSchema.parse(data);
        this.messageHandlers.forEach((handler) => handler(validated));
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    this.ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
