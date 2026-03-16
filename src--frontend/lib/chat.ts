import { io, Socket } from 'socket.io-client';
import { supabase } from './supabase';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

class ChatManager {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private token: string | null = null;

  async init() {
    if (this.socket?.connected) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || !session?.access_token) return;

    this.userId = session.user.id;
    this.token = session.access_token;

    this.socket = io(BACKEND_URL, {
      auth: { token: this.token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('[Chat] Connected to WebSocket');
      this.socket?.emit('join', { userId: this.userId, token: this.token });
    });

    this.socket.on('error', (err) => {
      console.error('[Chat] WebSocket Error:', err);
    });

    this.socket.on('disconnect', () => {
      console.log('[Chat] Disconnected from WebSocket');
    });
  }

  onMessage(callback: (message: any) => void) {
    this.socket?.on('new_message', callback);
    return () => this.socket?.off('new_message', callback);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const chatManager = new ChatManager();
