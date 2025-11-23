import { io, Socket } from 'socket.io-client';
import { SocketEvents } from '../types';

// 🔥 IP DIRECTA DEL SERVIDOR - CAMBIAR SI ES NECESARIO
export const SERVER_URL = 'http://192.168.1.76:3001';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Aumentado para mejor manejo de reconexión
  private reconnectCallbacks: Array<() => void> = [];

  connect(url: string): Promise<Socket> {
    console.log('🔌 Intentando conectar a:', url);
    console.log('📍 IP del servidor:', url);
    return new Promise((resolve, reject) => {
      // Si ya hay un socket conectado, reutilizarlo
      if (this.socket?.connected) {
        console.log('✅ Socket ya conectado, reutilizando conexión');
        resolve(this.socket);
        return;
      }

      this.socket = io(url, {
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000, // Aumentado para mejor manejo de WiFi lento
        timeout: 20000,
        transports: ['websocket', 'polling'], // Intentar ambos métodos
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket conectado exitosamente');
        this.reconnectAttempts = 0;
        
        // Ejecutar callbacks de reconexión
        this.reconnectCallbacks.forEach(cb => cb());
        this.reconnectCallbacks = [];
        
        resolve(this.socket!);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('⚠️ Socket desconectado:', reason);
        if (reason === 'io server disconnect') {
          // El servidor desconectó, intentar reconectar manualmente
          this.socket?.connect();
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Reconectado después de ${attemptNumber} intentos`);
        this.reconnectAttempts = 0;
        
        // Ejecutar callbacks de reconexión
        this.reconnectCallbacks.forEach(cb => cb());
        this.reconnectCallbacks = [];
      });

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Intento de reconexión ${attemptNumber}/${this.maxReconnectAttempts}`);
        this.reconnectAttempts = attemptNumber;
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Error de conexión:', error.message);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Máximo de intentos de reconexión alcanzado');
          reject(error);
        }
      });
    });
  }

  // Registrar callback para ejecutar al reconectar
  onReconnect(callback: () => void) {
    this.reconnectCallbacks.push(callback);
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
      this.socket.on(event as string, callback as any);
    }
  }

  off<K extends keyof SocketEvents>(
    event: K,
    callback?: (data: SocketEvents[K]) => void
  ) {
    if (this.socket) {
      this.socket.off(event as string, callback as any);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();

