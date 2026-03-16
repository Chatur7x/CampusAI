import { useState, useEffect, useRef } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { chatService } from '@/lib/api';
import { chatManager } from '@/lib/chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Send, 
  Search, 
  MoreVertical, 
  Phone, 
  Video, 
  Paperclip,
  Smile,
  Circle,
  MessageSquare,
  ChevronLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function ChatPage() {
  const { user } = useSupabaseAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    chatManager.init();

    const unsubscribe = chatManager.onMessage((msg) => {
      // If the message is for the current open chat
      if (selectedChat && (msg.senderId === selectedChat.user.id || msg.receiverId === selectedChat.user.id)) {
        setMessages((prev) => [...prev, msg]);
      }
      
      // Update conversations list (last message, unread count)
      loadConversations();
    });

    return () => {
      unsubscribe();
      chatManager.disconnect();
    };
  }, [selectedChat]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await chatService.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (userId: string) => {
    try {
      const data = await chatService.getMessages(userId);
      setMessages(data.messages);
    } catch (error) {
      toast.error('Failed to load messages');
    }
  };

  const handleSelectChat = (chat: any) => {
    setSelectedChat(chat);
    loadMessages(chat.user.id);
    // Mark as read
    chatService.markAsRead(chat.user.id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const sentMsg = await chatService.sendMessage(selectedChat.user.id, newMessage);
      setMessages((prev) => [...prev, sentMsg]);
      setNewMessage('');
      loadConversations();
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const filteredConversations = conversations.filter(c => 
    `${c.user.profile?.firstName} ${c.user.profile?.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-120px)] bg-slate-950/40 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl overflow-hidden">
      {/* Sidebar - Conversations List */}
      <div className={`w-full md:w-80 flex flex-col border-r border-white/5 bg-slate-900/40 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              Messages
            </h2>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <Input 
              placeholder="Search contacts..." 
              className="pl-10 bg-slate-950/50 border-white/5 focus-visible:ring-blue-500/50 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2 space-y-1">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-white/5 rounded" />
                    <div className="h-3 w-1/2 bg-white/5 rounded" />
                  </div>
                </div>
              ))
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((chat) => (
                <button
                  key={chat.user.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 group ${
                    selectedChat?.user.id === chat.user.id 
                      ? 'bg-blue-600/20 shadow-inner' 
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12 border border-white/10 group-hover:scale-105 transition-transform">
                      <AvatarImage src={chat.user.profile?.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                        {chat.user.profile?.firstName?.[0]}{chat.user.profile?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    {chat.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-900 animate-bounce">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-slate-200 truncate">
                        {chat.user.profile?.firstName} {chat.user.profile?.lastName}
                      </span>
                      {chat.lastMessage && (
                        <span className="text-[10px] text-slate-500">
                          {format(new Date(chat.lastMessage.createdAt), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate ${chat.unreadCount > 0 ? 'text-white font-medium' : 'text-slate-500'}`}>
                      {chat.lastMessage?.content || 'No messages yet'}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-10 opacity-50">
                <p className="text-sm">No conversations found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-slate-900/20 backdrop-blur-sm ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="p-4 flex items-center justify-between border-b border-white/5 bg-slate-950/20">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden" 
                  onClick={() => setSelectedChat(null)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Avatar className="w-10 h-10 border border-blue-500/20">
                  <AvatarImage src={selectedChat.user.profile?.avatar} />
                  <AvatarFallback className="bg-blue-600/20 text-blue-400">
                    {selectedChat.user.profile?.firstName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-white">
                    {selectedChat.user.profile?.firstName} {selectedChat.user.profile?.lastName}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                    <span className="text-[10px] text-emerald-400 font-medium">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 md:flex hidden">
                  <Video className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-white/5">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6" viewportRef={scrollRef}>
              <div className="space-y-6">
                <AnimatePresence>
                  {messages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] md:max-w-[70%] space-y-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          <div
                            className={`px-4 py-3 rounded-2xl text-sm relative overflow-hidden group transition-all duration-300 ${
                              isMe
                                ? 'bg-gradient-to-br from-blue-600 to-emerald-600 text-white shadow-lg shadow-blue-500/20 rounded-tr-none'
                                : 'bg-white/5 border border-white/5 text-slate-200 backdrop-blur-md rounded-tl-none'
                            }`}
                          >
                            {/* Glass overlay for isMe */}
                            {isMe && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            {msg.content}
                          </div>
                          <span className="text-[10px] text-slate-500 px-1 font-medium">
                            {format(new Date(msg.createdAt), 'HH:mm')}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 bg-slate-950/30 border-t border-white/5">
              <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                <Button type="button" variant="ghost" size="icon" className="text-slate-500 hover:bg-white/5 shrink-0">
                  <Paperclip className="w-5 h-5" />
                </Button>
                <div className="relative flex-1">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="bg-slate-900/50 border-white/5 focus-visible:ring-blue-500/50 pr-10 py-6 rounded-2xl"
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-yellow-400 transition-colors">
                    <Smile className="w-5 h-5" />
                  </Button>
                </div>
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={!newMessage.trim()}
                  className="bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white rounded-2xl shrink-0 shadow-lg shadow-blue-500/20 h-12 w-12 transition-all hover:scale-105"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 opacity-40">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl opacity-30 bg-blue-500 animate-pulse" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-600/20 to-emerald-400/20 border border-blue-500/30 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-blue-400" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">Your Inbox</h3>
              <p className="text-sm text-slate-400">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
