import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, content: string) => void;
  clearMessages: () => void;
  setIsStreaming: (streaming: boolean) => void;
}

export const useAIChatStore = create<AIChatStore>((set) => ({
  messages: [],
  isStreaming: false,

  addMessage: (message) => {
    const id = crypto.randomUUID();
    const newMessage: ChatMessage = {
      ...message,
      id,
      timestamp: new Date(),
    };
    set((state) => ({ messages: [...state.messages, newMessage] }));
    return id;
  },

  updateMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, content } : m)),
    })),

  clearMessages: () => set({ messages: [] }),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
}));
