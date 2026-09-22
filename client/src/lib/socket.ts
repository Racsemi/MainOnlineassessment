import { io, Socket } from 'socket.io-client';

export function getSocketBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    // Strip trailing /api or /api/
    return apiUrl.replace(/\/api\/?$/, '');
  }
  // In local dev without VITE_API_URL, fallback to localhost:5000 or current origin
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  return window.location.origin;
}

let socketInstance: Socket | null = null;

export function getInterviewSocket(): Socket {
  if (!socketInstance || !socketInstance.connected) {
    const baseUrl = getSocketBaseUrl();
    socketInstance = io(`${baseUrl}/interview`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
}

export function closeInterviewSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
