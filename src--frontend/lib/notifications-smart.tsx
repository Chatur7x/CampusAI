import { useState, useEffect, useCallback, useMemo, createContext, useContext, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export type NotificationPriority = 'urgent' | 'high' | 'medium' | 'low';
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'achievement' | 'system';
export type NotificationChannel = 'realtime' | 'digest' | 'escalated';

export interface SmartNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  channel: NotificationChannel;
  category: 'attendance' | 'academic' | 'administrative' | 'security' | 'social' | 'system';
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  expiresAt?: string;
  score?: number;
  isEscalated?: boolean;
  escalationLevel?: number;
}

export interface NotificationPreferences {
  channels: {
    realtime: boolean;
    digest: boolean;
    email: boolean;
    push: boolean;
  };
  categories: Record<string, boolean>;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  digestSchedule: 'hourly' | 'daily' | 'weekly';
}

interface NotificationContextValue {
  notifications: SmartNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  isLoading: boolean;
  user: ReturnType<typeof useSupabaseAuth>['user'];
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  refresh: () => Promise<void>;
}

const defaultPreferences: NotificationPreferences = {
  channels: {
    realtime: true,
    digest: true,
    email: false,
    push: false,
  },
  categories: {
    attendance: true,
    academic: true,
    administrative: true,
    security: true,
    social: true,
    system: true,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
  digestSchedule: 'daily',
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabaseAuth();
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate notification priority score using simple ML-like heuristics
  const calculatePriority = useCallback((notification: Partial<SmartNotification>): number => {
    let score = 50;

    const typeScores: Record<string, number> = {
      urgent: 100,
      high: 75,
      medium: 50,
      low: 25,
    };
    score = typeScores[notification.priority || 'medium'];

    const categoryScores: Record<string, number> = {
      security: 30,
      attendance: 20,
      academic: 15,
      administrative: 10,
      social: 5,
      system: 0,
    };
    score += categoryScores[notification.category || 'system'];

    const timeFactor = new Date(notification.createdAt || Date.now()).getHours();
    if (timeFactor >= 9 && timeFactor <= 17) score += 10;

    return Math.min(100, score);
  }, []);

  // Fetch notifications with smart prioritization
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const smartNotifications: SmartNotification[] = (data || []).map((n: any) => ({
        id: n.id,
        type: (n.type || 'info') as NotificationType,
        title: n.title,
        message: n.message,
        priority: (n.priority || 'medium') as NotificationPriority,
        channel: n.is_escalated ? 'escalated' : 'realtime',
        category: (n.category || 'system') as SmartNotification['category'],
        actionUrl: n.action_url,
        actionLabel: n.action_label,
        metadata: n.metadata || {},
        isRead: n.is_read || false,
        readAt: n.read_at,
        createdAt: n.created_at,
        expiresAt: n.expires_at,
        score: calculatePriority({
          priority: n.priority,
          category: n.category,
          createdAt: n.created_at,
        }),
        isEscalated: n.is_escalated,
        escalationLevel: n.escalation_level,
      }));

      smartNotifications.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      const savedPrefs = localStorage.getItem(`notification_prefs_${user.id}`);
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs));
      }

      setNotifications(smartNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, calculatePriority]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newNotif = payload.new as any;
          
          const smartNotif: SmartNotification = {
            id: newNotif.id,
            type: (newNotif.type || 'info') as NotificationType,
            title: newNotif.title,
            message: newNotif.message,
            priority: (newNotif.priority || 'medium') as NotificationPriority,
            channel: 'realtime',
            category: (newNotif.category || 'system') as SmartNotification['category'],
            actionUrl: newNotif.action_url,
            actionLabel: newNotif.action_label,
            metadata: newNotif.metadata || {},
            isRead: false,
            createdAt: newNotif.created_at,
            expiresAt: newNotif.expires_at,
            score: calculatePriority({
              priority: newNotif.priority,
              category: newNotif.category,
              createdAt: newNotif.created_at,
            }),
          };

          setNotifications(prev => {
            const updated = [smartNotif, ...prev];
            updated.sort((a, b) => (b.score || 0) - (a.score || 0));
            return updated;
          });

          // Show browser notification if permitted and outside quiet hours
          if (preferences.channels.push && !isInQuietHours()) {
            showBrowserNotification(smartNotif);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, preferences, calculatePriority]);

  const isInQuietHours = useCallback(() => {
    if (!preferences.quietHours.enabled) return false;
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { start, end } = preferences.quietHours;
    
    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      return currentTime >= start || currentTime <= end;
    }
  }, [preferences.quietHours]);

  const showBrowserNotification = (notification: SmartNotification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
      });
    }
  };

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
      );
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      const now = new Date().toISOString();
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: now }))
      );
    }
  }, [user]);

  const dismiss = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  }, []);

  const updatePreferences = useCallback(async (newPrefs: Partial<NotificationPreferences>) => {
    const updated = {
      ...preferences,
      ...newPrefs,
      channels: { ...preferences.channels, ...newPrefs.channels },
      quietHours: { ...preferences.quietHours, ...newPrefs.quietHours },
    };
    
    setPreferences(updated);
    
    if (user) {
      localStorage.setItem(`notification_prefs_${user.id}`, JSON.stringify(updated));
    }
  }, [user, preferences]);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.isRead).length,
    [notifications]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        preferences,
        isLoading,
        user,
        markAsRead,
        markAllAsRead,
        dismiss,
        updatePreferences,
        refresh: fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useSmartNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useSmartNotifications must be used within NotificationProvider');
  }
  return context;
}

export function useNotificationDigest() {
  const { notifications, preferences } = useSmartNotifications();

  const digest = useMemo(() => {
    const unread = notifications.filter(n => !n.isRead);
    const byCategory = unread.reduce((acc, n) => {
      acc[n.category] = (acc[n.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const urgent = unread.filter(n => n.priority === 'urgent' || n.priority === 'high');
    const summary = {
      total: unread.length,
      byCategory,
      urgentCount: urgent.length,
      topItems: unread.slice(0, 5),
    };

    return summary;
  }, [notifications, preferences]);

  return digest;
}

export function useNotificationEscalation() {
  const { notifications, user } = useSmartNotifications();

  const escalate = useCallback(async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    const newEscalationLevel = (notification.escalationLevel || 0) + 1;
    
    if (newEscalationLevel >= 3) {
      await supabase.from('notifications').update({
        is_escalated: true,
        escalation_level: newEscalationLevel,
        channel: 'escalated',
      }).eq('id', notificationId);
    }
  }, [notifications, user]);

  return { escalate };
}
