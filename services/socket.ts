import { io, Socket } from 'socket.io-client';
import { SocketEvents } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(url: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      this.socket = io(url, {
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        console.log('Socket conectado');
        this.reconnectAttempts = 0;
        resolve(this.socket!);
      });

      this.socket.on('disconnect', () => {
        console.log('Socket desconectado');
      });

      this.socket.on('connect_error', (error) => {
        console.error('Error de conexión:', error);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(error);
        }
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit<K extends keyof SocketEvents>(
    event: K,
    data: SocketEvents[K]
  ) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on<K extends keyof SocketEvents>(
    event: K,
    callback: (data: SocketEvents[K]) => void
  ) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off<K extends keyof SocketEvents>(
    event: K,
    callback?: (data: SocketEvents[K]) => void
  ) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();

