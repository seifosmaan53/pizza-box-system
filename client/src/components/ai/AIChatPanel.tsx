import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Trash2, Bot, User as UserIcon, Sparkles } from 'lucide-react';
import { useAIChatStore } from '@/store/aiChat';
import { useAuthStore } from '@/store/auth';
import { chatStream } from '@/api/ai';

const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 580;
const BUTTON_SIZE = 56;
const MARGIN = 16;

const SUGGESTION_CHIPS = [
  'Give me a business summary',
  'Which stores have low stock?',
  'Show recent invoice activity',
  'What are my top stores?',
];

interface Props {
  buttonPos?: { x: number; y: number } | null;
}

export function AIChatPanel({ buttonPos }: Props) {
  const { messages, isStreaming, addMessage, updateMessage, clearMessages, setIsStreaming } = useAIChatStore();
  const { accessToken } = useAuthStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const panelStyle = React.useMemo(() => {
    if (!buttonPos) return { bottom: 96, right: MARGIN } as React.CSSProperties;
    let left = buttonPos.x + BUTTON_SIZE / 2 - PANEL_WIDTH / 2;
    let top = buttonPos.y - PANEL_HEIGHT - 12;
    left = Math.min(Math.max(left, MARGIN), window.innerWidth - PANEL_WIDTH - MARGIN);
    top = Math.max(top, MARGIN);
    if (top < MARGIN) top = buttonPos.y + BUTTON_SIZE + 12;
    return { left, top } as React.CSSProperties;
  }, [buttonPos]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setInput('');

    addMessage({ role: 'user', content: text.trim() });

    // Build conversation history for context (last 10 messages)
    const history = [...messages, { role: 'user' as const, content: text.trim() }]
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    const assistantId = addMessage({ role: 'assistant', content: '' });
    setIsStreaming(true);

    await chatStream(
      history,
      accessToken,
      (chunk) => updateMessage(assistantId, useAIChatStore.getState().messages.find(m => m.id === assistantId)?.content + chunk || chunk),
      () => setIsStreaming(false),
      (err) => { updateMessage(assistantId, `Sorry, something went wrong. Please try again.\n\n_Error: ${err}_`); setIsStreaming(false); }
    );
  };

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={panelStyle} className="fixed z-50 w-[380px] h-[580px] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-600 to-red-700">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-white" />
          <div>
            <span className="font-semibold text-white text-sm">Pizza Box AI</span>
            <span className="text-red-200 text-[10px] ml-1.5">Assistant</span>
          </div>
        </div>
        <button
          onClick={clearMessages}
          className="p-1.5 rounded-lg text-red-200 hover:text-white hover:bg-red-500/50 transition-colors"
          title="Clear chat"
          aria-label="Clear conversation"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-full">
              <Bot className="h-8 w-8 text-red-500 dark:text-red-400 opacity-60" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Hi! I'm your business assistant</p>
              <p className="text-xs mt-1 text-gray-400">I have real-time access to all your data</p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center mt-1">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${msg.role === 'user' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
              {msg.role === 'user'
                ? <UserIcon className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                : <Sparkles className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-red-600 text-white rounded-tr-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'
            }`}>
              {msg.content ? (
                msg.role === 'assistant' ? (
                  <div className="ai-markdown prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-table:my-2 prose-hr:my-2 prose-pre:my-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )
              ) : (
                isStreaming ? (
                  <span className="inline-flex gap-1 py-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </span>
                ) : ''
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about inventory, invoices, sales..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 max-h-28 overflow-y-auto"
            aria-label="Chat message input"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
