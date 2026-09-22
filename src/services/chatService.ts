import { ChatThread, ChatMessage } from '../types';
import { apiUrl, parseJsonResponse } from '../utils/apiBase';

const CHAT_STORAGE_KEY = 'royal_service_chat_threads';
const CHAT_EVENT = 'royal_service_chat_update';

// Internal event emitter for live component sync
const chatEventEmitter = new EventTarget();

export function notifyChatUpdate(userId?: string) {
  chatEventEmitter.dispatchEvent(
    new CustomEvent(CHAT_EVENT, { detail: { userId, timestamp: Date.now() } })
  );
}

// Local storage fallback helpers
function getLocalThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[Chat] Failed to parse local threads:', err);
    return [];
  }
}

function saveLocalThreads(threads: ChatThread[]) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(threads));
  } catch (err) {
    console.warn('[Chat] Failed to save local threads:', err);
  }
}

function getOrCreateLocalThread(
  userId: string,
  userMeta?: { name?: string; phone?: string; email?: string; ref?: string }
): ChatThread {
  const threads = getLocalThreads();
  const existing = threads.find((t) => t.userId === userId);
  if (existing) return existing;

  const newThread: ChatThread = {
    id: `thread-${userId}`,
    userId,
    userName: userMeta?.name || 'Investor',
    userPhone: userMeta?.phone || '',
    userEmail: userMeta?.email || `${userId}@investor.ke`,
    userReferralCode: userMeta?.ref || 'ROYAL-VIP',
    status: 'active',
    unreadCountUser: 0,
    unreadCountAdmin: 0,
    lastMessageTime: 'Just now',
    lastMessageSnippet: 'Welcome to the VIP Concierge Desk!',
    messages: [
      {
        id: `msg-welcome-${Date.now()}`,
        threadId: `thread-${userId}`,
        sender: 'admin',
        senderName: 'VIP Desk Officer (Assigned #VIP-402)',
        text: 'Welcome to the Royal Service VIP Concierge Desk. How can we assist with your investments or portfolio today?',
        timestamp: 'Just now',
        isRead: true,
      },
    ],
  };

  threads.unshift(newThread);
  saveLocalThreads(threads);
  return newThread;
}

export const chatService = {
  /**
   * Subscribe to chat updates across components
   */
  subscribe(callback: (e: any) => void): () => void {
    const listener = (event: Event) => {
      callback(event as CustomEvent);
    };
    chatEventEmitter.addEventListener(CHAT_EVENT, listener);
    return () => {
      chatEventEmitter.removeEventListener(CHAT_EVENT, listener);
    };
  },

  /**
   * Fetch all threads (for Admin view)
   */
  async getAllThreads(status?: string, search?: string): Promise<ChatThread[]> {
    try {
      let queryParams = new URLSearchParams();
      if (status && status !== 'all') queryParams.append('status', status);
      if (search) queryParams.append('search', search);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const res = await fetch(apiUrl(`/api/chat/threads${qs}`));
      if (res.ok) {
        const remoteThreads = await parseJsonResponse<ChatThread[]>(res);
        if (Array.isArray(remoteThreads)) {
          // Sync to local cache
          saveLocalThreads(remoteThreads);
          return remoteThreads;
        }
      }
    } catch (err) {
      console.warn('[Chat] API unreachable, falling back to local storage:', err);
    }

    let local = getLocalThreads();
    if (status && status !== 'all') {
      local = local.filter((t) => t.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      local = local.filter(
        (t) =>
          t.userName.toLowerCase().includes(q) ||
          t.userPhone.includes(q) ||
          t.userEmail.toLowerCase().includes(q)
      );
    }
    return local;
  },

  /**
   * Get thread for a specific user
   */
  async getUserThread(
    userId: string,
    userMeta?: { name?: string; phone?: string; email?: string; ref?: string }
  ): Promise<ChatThread> {
    try {
      const qs = userMeta?.name ? `?name=${encodeURIComponent(userMeta.name)}` : '';
      const res = await fetch(apiUrl(`/api/chat/threads/${encodeURIComponent(userId)}${qs}`));
      if (res.ok) {
        const remoteThread = await parseJsonResponse<ChatThread>(res);
        if (remoteThread && remoteThread.id) {
          const localThreads = getLocalThreads().filter((t) => t.userId !== userId);
          localThreads.unshift(remoteThread);
          saveLocalThreads(localThreads);
          return remoteThread;
        }
      }
    } catch (err) {
      console.warn('[Chat] Remote thread fetch fallback:', err);
    }

    return getOrCreateLocalThread(userId, userMeta);
  },

  /**
   * Send a message in user thread
   */
  async sendMessage(
    userId: string,
    payload: {
      sender: 'user' | 'admin';
      senderName: string;
      text?: string;
      voiceNote?: { audioData: string; durationSec: number };
      attachment?: { name: string; sizeBytes: number; type: string; dataUrl: string };
    }
  ): Promise<ChatMessage> {
    try {
      const res = await fetch(apiUrl(`/api/chat/threads/${encodeURIComponent(userId)}/messages`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newMsg = await parseJsonResponse<ChatMessage>(res);
        notifyChatUpdate(userId);
        return newMsg;
      }
    } catch (err) {
      console.warn('[Chat] API message send error, falling back locally:', err);
    }

    // Local fallback message creation
    const threads = getLocalThreads();
    let thread = threads.find((t) => t.userId === userId);
    if (!thread) {
      thread = getOrCreateLocalThread(userId, { name: payload.senderName });
      threads.unshift(thread);
    }

    const snippet = payload.text
      ? payload.text.length > 50
        ? `${payload.text.slice(0, 50)}...`
        : payload.text
      : payload.voiceNote
      ? `Voice note (${payload.voiceNote.durationSec}s)`
      : `Attachment: ${payload.attachment?.name || 'File'}`;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      threadId: thread.id,
      sender: payload.sender,
      senderName: payload.senderName,
      text: payload.text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
      voiceNote: payload.voiceNote,
      attachment: payload.attachment,
    };

    thread.messages.push(newMsg);
    thread.lastMessageSnippet = snippet;
    thread.lastMessageTime = newMsg.timestamp;
    if (payload.sender === 'admin') {
      thread.unreadCountUser = (thread.unreadCountUser || 0) + 1;
    } else {
      thread.unreadCountAdmin = (thread.unreadCountAdmin || 0) + 1;
    }

    saveLocalThreads(threads);
    notifyChatUpdate(userId);
    return newMsg;
  },

  /**
   * Mark messages in thread as read
   */
  async markAsRead(userId: string, reader: 'user' | 'admin'): Promise<void> {
    try {
      await fetch(apiUrl(`/api/chat/threads/${encodeURIComponent(userId)}/read`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reader }),
      });
    } catch {
      // Ignore API errors, continue local
    }

    const threads = getLocalThreads();
    const thread = threads.find((t) => t.userId === userId);
    if (thread) {
      if (reader === 'user') {
        thread.unreadCountUser = 0;
        thread.messages.forEach((m) => {
          if (m.sender === 'admin') m.isRead = true;
        });
      } else {
        thread.unreadCountAdmin = 0;
        thread.messages.forEach((m) => {
          if (m.sender === 'user') m.isRead = true;
        });
      }
      saveLocalThreads(threads);
      notifyChatUpdate(userId);
    }
  },

  /**
   * Update thread status (active, resolved, escalated)
   */
  async updateStatus(userId: string, newStatus: 'active' | 'resolved' | 'escalated'): Promise<void> {
    try {
      await fetch(apiUrl(`/api/chat/threads/${encodeURIComponent(userId)}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Ignore API errors
    }

    const threads = getLocalThreads();
    const thread = threads.find((t) => t.userId === userId);
    if (thread) {
      thread.status = newStatus;
      saveLocalThreads(threads);
      notifyChatUpdate(userId);
    }
  },

  /**
   * Clear all messages in a thread
   */
  async clearThread(userId: string): Promise<void> {
    try {
      await fetch(apiUrl(`/api/chat/threads/${encodeURIComponent(userId)}`), {
        method: 'DELETE',
      });
    } catch {
      // Ignore API errors
    }

    const threads = getLocalThreads();
    const thread = threads.find((t) => t.userId === userId);
    if (thread) {
      thread.messages = [];
      thread.unreadCountAdmin = 0;
      thread.unreadCountUser = 0;
      thread.lastMessageSnippet = 'Conversation cleared';
      thread.lastMessageTime = 'Just now';
      saveLocalThreads(threads);
      notifyChatUpdate(userId);
    }
  },
};
