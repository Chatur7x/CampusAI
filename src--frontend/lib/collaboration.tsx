import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { supabase } from './supabase';

export interface ActivityItem {
  id: string;
  type: 'attendance' | 'leave' | 'notice' | 'message' | 'assignment' | 'system' | 'security';
  title: string;
  description: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  metadata?: Record<string, unknown>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface PresenceUser {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: string;
  currentPage?: string;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  conversationId: string;
  startedAt: number;
}

interface UseCollaborationOptions {
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole: string;
  enabled?: boolean;
}

export function useCollaborationHub(options: UseCollaborationOptions) {
  const { userId, userName, userAvatar, userRole, enabled = true } = options;
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const [collaborators, setCollaborators] = useState<PresenceUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch recent activities
  const fetchActivities = useCallback(async () => {
    if (!enabled) return;

    const { data: attendance } = await supabase
      .from('attendance')
      .select('*, student:students(*, profile:profiles(*))')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: leaves } = await supabase
      .from('leave_requests')
      .select('*, student:students(*)')
      .order('created_at', { ascending: false })
      .limit(3);

    const { data: notices } = await supabase
      .from('notices')
      .select('*, author:profiles(*)')
      .order('created_at', { ascending: false })
      .limit(3);

    const activityItems: ActivityItem[] = [];

    attendance?.forEach((a: any) => {
      activityItems.push({
        id: `att-${a.id}`,
        type: 'attendance',
        title: `${a.student?.profile?.first_name || 'Student'} marked attendance`,
        description: `${a.status} - ${a.date}`,
        timestamp: a.created_at,
        priority: a.status === 'LATE' ? 'medium' : 'low',
      });
    });

    leaves?.forEach((l: any) => {
      activityItems.push({
        id: `leave-${l.id}`,
        type: 'leave',
        title: `Leave request ${l.status.toLowerCase()}`,
        description: l.reason || 'No reason provided',
        timestamp: l.created_at,
        priority: l.status === 'PENDING' ? 'high' : 'low',
      });
    });

    notices?.forEach((n: any) => {
      activityItems.push({
        id: `notice-${n.id}`,
        type: 'notice',
        title: n.title,
        description: n.content?.substring(0, 100) + '...',
        timestamp: n.created_at,
        priority: n.priority === 'HIGH' ? 'high' : 'low',
      });
    });

    activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivities(activityItems.slice(0, 20));
  }, [enabled]);

  // Set up presence channel
  useEffect(() => {
    if (!enabled || !userId) return;

    // Main collaboration channel
    channelRef.current = supabase.channel('collaboration-hub', {
      config: {
        broadcast: { self: true },
        presence: { key: userId },
      },
    });

    channelRef.current
      .on('broadcast', { event: 'activity' }, ({ payload }) => {
        setActivities(prev => [payload as ActivityItem, ...prev].slice(0, 50));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const typing = payload as TypingIndicator;
        setTypingUsers(prev => {
          const filtered = prev.filter(t => t.userId !== typing.userId || t.conversationId !== typing.conversationId);
          return [...filtered, typing];
        });
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(t => t.userId !== typing.userId));
        }, 3000);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channelRef.current?.presenceState() || {};
        const users: PresenceUser[] = [];
        Object.entries(state).forEach(([key, presences]) => {
          const presence = (presences as any[])[0];
          if (key !== userId && presence) {
            users.push({
              id: key,
              name: presence.name,
              avatar: presence.avatar,
              role: presence.role,
              status: presence.status || 'online',
              currentPage: presence.currentPage,
              lastSeen: presence.lastSeen,
            });
          }
        });
        setOnlineUsers(users);
        setCollaborators(users.filter(u => u.role === userRole));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channelRef.current?.track({
            name: userName,
            avatar: userAvatar,
            role: userRole,
            status: 'online',
            lastSeen: new Date().toISOString(),
          });
        }
      });

    fetchActivities();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [enabled, userId, userName, userAvatar, userRole, fetchActivities]);

  // Broadcast activity
  const broadcastActivity = useCallback(async (activity: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    if (!channelRef.current || !enabled) return;

    const newActivity: ActivityItem = {
      ...activity,
      id: `${activity.type}-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    await channelRef.current.send({
      type: 'broadcast',
      event: 'activity',
      payload: newActivity,
    });
  }, [enabled]);

  // Broadcast typing
  const broadcastTyping = useCallback(async (conversationId: string) => {
    if (!channelRef.current || !enabled) return;

    await channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId,
        userName,
        conversationId,
        startedAt: Date.now(),
      } as TypingIndicator,
    });
  }, [enabled, userId, userName]);

  // Update presence status
  const updateStatus = useCallback(async (status: PresenceUser['status'], currentPage?: string) => {
    if (!channelRef.current || !enabled) return;

    await channelRef.current.track({
      name: userName,
      avatar: userAvatar,
      role: userRole,
      status,
      currentPage,
      lastSeen: new Date().toISOString(),
    });
  }, [enabled, userName, userAvatar, userRole]);

  return {
    activities,
    onlineUsers,
    collaborators,
    typingUsers,
    broadcastActivity,
    broadcastTyping,
    updateStatus,
    refreshActivities: fetchActivities,
  };
}

// Collaboration Activity Feed Component
export const CollaborationActivityFeed = memo(({ 
  activities, 
  maxItems = 10,
  className = ''
}: { 
  activities: ActivityItem[];
  maxItems?: number;
  className?: string;
}) => {
  const getTypeIcon = (type: ActivityItem['type']) => {
    const icons: Record<ActivityItem['type'], string> = {
      attendance: '📋',
      leave: '📝',
      notice: '📢',
      message: '💬',
      assignment: '📚',
      system: '⚙️',
      security: '🔒',
    };
    return icons[type];
  };

  const getPriorityColor = (priority?: ActivityItem['priority']) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-500/20 text-red-400',
      high: 'bg-orange-500/20 text-orange-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-slate-500/20 text-slate-400',
    };
    return colors[priority || 'low'];
  };

  const formatTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {activities.slice(0, maxItems).map((activity) => (
        <div
          key={activity.id}
          className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/50 transition-colors"
        >
          <div className="text-xl">{getTypeIcon(activity.type)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-200 truncate">{activity.title}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${getPriorityColor(activity.priority)}`}>
                {activity.priority}
              </span>
            </div>
            <p className="text-sm text-slate-400 truncate">{activity.description}</p>
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {formatTime(activity.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
});

// Online Collaborators Component
export const OnlineCollaborators = memo(({ 
  users, 
  maxDisplay = 8,
  showNames = true,
  className = ''
}: { 
  users: PresenceUser[];
  maxDisplay?: number;
  showNames?: boolean;
  className?: string;
}) => {
  const getStatusColor = (status: PresenceUser['status']) => {
    const colors: Record<PresenceUser['status'], string> = {
      online: 'bg-emerald-500',
      away: 'bg-yellow-500',
      busy: 'bg-red-500',
      offline: 'bg-slate-500',
    };
    return colors[status];
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      ADMIN: { bg: 'bg-violet-500/20', text: 'text-violet-400' },
      FACULTY: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
      STUDENT: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    };
    return badges[role] || badges.STUDENT;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex -space-x-2">
        {users.slice(0, maxDisplay).map((user) => (
          <div
            key={user.id}
            className="relative group"
            title={`${user.name} - ${user.status}`}
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full border-2 border-slate-900"
              />
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-white">
                {user.name.charAt(0)}
              </div>
            )}
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${getStatusColor(user.status)}`} />
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              <div className="font-medium text-white">{user.name}</div>
              <div className={`text-xs ${getRoleBadge(user.role).text}`}>{user.role}</div>
              {user.currentPage && (
                <div className="text-slate-400">{user.currentPage}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {users.length > maxDisplay && (
        <span className="text-xs text-slate-400">+{users.length - maxDisplay} more</span>
      )}
      
      {showNames && users.length > 0 && (
        <div className="ml-2 text-sm text-slate-400">
          {users.length} online
        </div>
      )}
    </div>
  );
});

// Typing Indicator Component
export const TypingIndicatorComponent = memo(({ 
  users, 
  conversationId 
}: { 
  users: TypingIndicator[];
  conversationId: string;
}) => {
  const activeUsers = users.filter(u => u.conversationId === conversationId);
  
  if (activeUsers.length === 0) return null;

  const message = activeUsers.length === 1
    ? `${activeUsers[0].userName} is typing...`
    : `${activeUsers.length} people are typing...`;

  return (
    <div className="flex items-center gap-2 text-sm text-slate-400 animate-pulse">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{message}</span>
    </div>
  );
});
