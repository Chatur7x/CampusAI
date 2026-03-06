import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, Trash2, Clock, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { notificationService } from '@/lib/api';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useRealtime } from '@/lib/realtime';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
}

interface NotificationBellProps {
  accentColor?: string;
}

function mapDbNotification(n: any): Notification {
  const typeMap: Record<string, Notification['type']> = {
    ATTENDANCE: 'success',
    LEAVE: 'info',
    NOTICE: 'info',
    SECURITY: 'error',
    SYSTEM: 'warning',
    MESSAGE: 'info',
  };
  return {
    id: n.id,
    title: n.title || 'Notification',
    message: n.message || '',
    type: typeMap[n.type] || 'info',
    timestamp: new Date(n.created_at),
    read: n.is_read ?? false,
  };
}

export function NotificationBell({ accentColor = 'emerald' }: NotificationBellProps) {
  const { user } = useSupabaseAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const userId = user?.id;

  // Fetch real notifications from Supabase
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await notificationService.getForUser(userId);
      setNotifications(data.map(mapDbNotification));
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription — new notifications appear instantly
  useRealtime(
    { table: 'notifications', filter: userId ? `user_id=eq.${userId}` : undefined, enabled: !!userId },
    useCallback((payload: any) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        setNotifications(prev => [mapDbNotification(payload.new), ...prev]);
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? mapDbNotification(payload.new) : n));
      } else if (payload.eventType === 'DELETE' && payload.old) {
        setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
      }
    }, [])
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try { await notificationService.markAsRead(id); } catch { /* silent */ }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (userId) {
      try { await notificationService.markAllAsRead(userId); } catch { /* silent */ }
    }
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const accentClasses = {
    emerald: 'bg-emerald-500',
    violet: 'bg-violet-500',
    cyan: 'bg-cyan-500',
  }[accentColor] || 'bg-emerald-500';

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-400" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white',
                accentClasses
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 p-0 bg-slate-900/95 backdrop-blur border-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Notifications list */}
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'flex gap-3 p-4 transition-colors hover:bg-slate-800/50 group',
                    !notification.read && 'bg-slate-800/30'
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          notification.read ? 'text-slate-300' : 'text-white'
                        )}
                      >
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className={cn('h-2 w-2 rounded-full flex-shrink-0 mt-1.5', accentClasses)} />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getTimeAgo(notification.timestamp)}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
