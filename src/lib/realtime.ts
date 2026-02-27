// =============================================================
// CAMPUSAI - REAL-TIME HOOKS
// Live data subscriptions with Supabase Realtime
// =============================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Notification, Attendance, Notice, SecurityAlert, Message } from './database.types';

// Define valid table names for this application
type TableName = 'profiles' | 'departments' | 'classes' | 'courses' | 'students' | 
  'faculty' | 'attendance' | 'leaves' | 'notices' | 'notifications' | 
  'blockchain_hashes' | 'timetable' | 'chat_messages' | 'chat_conversations' |
  'class_courses' | 'security_alerts' | 'audit_logs' | 'system_settings' | 'messages';

// =============================================================
// GENERIC REALTIME HOOK
// =============================================================

interface UseRealtimeOptions {
  table: TableName;
  schema?: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  enabled?: boolean;
}

export function useRealtime(
  options: UseRealtimeOptions,
  onData: (payload: any) => void
) {
  const { table, schema = 'public', filter, event = '*', enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-${String(table)}-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event,
          schema,
          table: table as string,
          filter,
        },
        (payload: any) => {
          onData(payload);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [table, schema, filter, event, enabled, onData]);

  return channelRef.current;
}

// =============================================================
// NOTIFICATIONS REALTIME HOOK
// =============================================================

export function useRealtimeNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Subscribe to new notifications
  useRealtime(
    {
      table: 'notifications',
      filter: userId ? `user_id=eq.${userId}` : undefined,
      event: 'INSERT',
      enabled: !!userId,
    },
    useCallback((payload) => {
      const newNotification = payload.new as Notification;
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);
    }, [])
  );

  // Subscribe to notification updates (mark as read)
  useRealtime(
    {
      table: 'notifications',
      filter: userId ? `user_id=eq.${userId}` : undefined,
      event: 'UPDATE',
      enabled: !!userId,
    },
    useCallback((payload) => {
      const updated = payload.new as Notification;
      setNotifications(prev => 
        prev.map(n => n.id === updated.id ? updated : n)
      );
      // Recalculate unread count
      setNotifications(current => {
        setUnreadCount(current.filter(n => !n.is_read).length);
        return current;
      });
    }, [])
  );

  const markAsRead = useCallback(async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
    
    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  }, [userId]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}

// =============================================================
// ATTENDANCE REALTIME HOOK
// =============================================================

export function useRealtimeAttendance(options: { 
  studentId?: string; 
  classId?: string;
  date?: string;
}) {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    
    let query = supabase
      .from('attendance')
      .select(`
        *,
        student:students(
          *,
          profile:profiles(*)
        ),
        subject:subjects(*)
      `)
      .order('created_at', { ascending: false });

    if (options.studentId) {
      query = query.eq('student_id', options.studentId);
    }
    if (options.date) {
      query = query.eq('date', options.date);
    }

    const { data, error } = await query.limit(100);
    
    if (!error && data) {
      setAttendance(data as Attendance[]);
    }
    setIsLoading(false);
  }, [options.studentId, options.date]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Subscribe to attendance changes
  const filter = options.studentId 
    ? `student_id=eq.${options.studentId}`
    : options.date 
      ? `date=eq.${options.date}`
      : undefined;

  useRealtime(
    {
      table: 'attendance',
      filter,
      event: '*',
      enabled: true,
    },
    useCallback((payload) => {
      if (payload.eventType === 'INSERT') {
        setAttendance(prev => [payload.new as Attendance, ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        setAttendance(prev =>
          prev.map(a => a.id === (payload.new as Attendance).id ? payload.new as Attendance : a)
        );
      } else if (payload.eventType === 'DELETE') {
        setAttendance(prev =>
          prev.filter(a => a.id !== (payload.old as Attendance).id)
        );
      }
    }, [])
  );

  return {
    attendance,
    isLoading,
    refresh: fetchAttendance,
  };
}

// =============================================================
// NOTICES REALTIME HOOK
// =============================================================

export function useRealtimeNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotices = useCallback(async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .eq('is_active', true)
      .or('expiry_date.is.null,expiry_date.gt.now()')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setNotices(data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  // Subscribe to new notices
  useRealtime(
    {
      table: 'notices',
      event: 'INSERT',
    },
    useCallback((payload) => {
      const newNotice = payload.new as Notice;
      if (newNotice.is_active) {
        setNotices(prev => {
          const updated = [newNotice, ...prev];
          // Sort: pinned first, then by date
          return updated.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        });
      }
    }, [])
  );

  // Subscribe to notice updates
  useRealtime(
    {
      table: 'notices',
      event: 'UPDATE',
    },
    useCallback((payload) => {
      const updated = payload.new as Notice;
      setNotices(prev => {
        const filtered = prev.filter(n => n.id !== updated.id);
        if (updated.is_active) {
          return [...filtered, updated].sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        }
        return filtered;
      });
    }, [])
  );

  return {
    notices,
    isLoading,
    refresh: fetchNotices,
  };
}

// =============================================================
// SECURITY ALERTS REALTIME HOOK
// =============================================================

export function useRealtimeSecurityAlerts() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('security_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!error && data) {
      setAlerts(data);
      setUnresolvedCount(data.filter(a => !a.resolved).length);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Subscribe to new alerts
  useRealtime(
    {
      table: 'security_alerts',
      event: 'INSERT',
    },
    useCallback((payload) => {
      const newAlert = payload.new as SecurityAlert;
      setAlerts(prev => [newAlert, ...prev]);
      if (!newAlert.resolved) {
        setUnresolvedCount(prev => prev + 1);
      }
    }, [])
  );

  // Subscribe to alert updates (resolution)
  useRealtime(
    {
      table: 'security_alerts',
      event: 'UPDATE',
    },
    useCallback((payload) => {
      const updated = payload.new as SecurityAlert;
      const old = payload.old as SecurityAlert;
      
      setAlerts(prev =>
        prev.map(a => a.id === updated.id ? updated : a)
      );
      
      // Update unresolved count
      if (!old.resolved && updated.resolved) {
        setUnresolvedCount(prev => Math.max(0, prev - 1));
      }
    }, [])
  );

  return {
    alerts,
    unresolvedCount,
    isLoading,
    refresh: fetchAlerts,
  };
}

// =============================================================
// MESSAGES REALTIME HOOK (Chat)
// =============================================================

export function useRealtimeMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(first_name, last_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      setMessages(data as Message[]);
    }
    setIsLoading(false);
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Subscribe to new messages
  useRealtime(
    {
      table: 'messages',
      filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
      event: 'INSERT',
      enabled: !!conversationId,
    },
    useCallback((payload) => {
      const newMessage = payload.new as Message;
      setMessages(prev => [...prev, newMessage]);
    }, [])
  );

  // Subscribe to message edits
  useRealtime(
    {
      table: 'messages',
      filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
      event: 'UPDATE',
      enabled: !!conversationId,
    },
    useCallback((payload) => {
      const updated = payload.new as Message;
      setMessages(prev =>
        prev.map(m => m.id === updated.id ? updated : m)
      );
    }, [])
  );

  const sendMessage = useCallback(async (content: string, senderId: string) => {
    if (!conversationId) return;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        attachments: [],
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }, [conversationId]);

  return {
    messages,
    isLoading,
    sendMessage,
    refresh: fetchMessages,
  };
}

// =============================================================
// PRESENCE HOOK (Online Users)
// =============================================================

interface PresenceState {
  id: string;
  name: string;
  role: string;
  online_at: string;
}

export function usePresence(userId: string | null, userInfo?: { name: string; role: string }) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId || !userInfo) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState<PresenceState>();
        const users = Object.values(presenceState).flat();
        setOnlineUsers(users as PresenceState[]);
      })
      .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: PresenceState[] }) => {
        setOnlineUsers(prev => [...prev, ...newPresences]);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: PresenceState[] }) => {
        const leftIds = leftPresences.map(p => p.id);
        setOnlineUsers(prev => prev.filter(u => !leftIds.includes(u.id)));
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: userId,
            name: userInfo.name,
            role: userInfo.role,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, userInfo]);

  return { onlineUsers, count: onlineUsers.length };
}

// =============================================================
// DASHBOARD STATS REALTIME HOOK
// =============================================================

export function useRealtimeDashboardStats() {
  const [stats, setStats] = useState<{
    total_students: number;
    total_faculty: number;
    total_departments: number;
    today_attendance: number;
    pending_leaves: number;
    security_alerts: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
    
    if (!error && data) {
      setStats(data as typeof stats);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Also refresh on attendance changes
  useRealtime(
    {
      table: 'attendance',
      event: 'INSERT',
    },
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  // Refresh on leave request changes
  useRealtime(
    {
      table: 'leaves',
      event: '*',
    },
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  return {
    stats,
    isLoading,
    refresh: fetchStats,
  };
}
