import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useUIStore } from '@/store/ui';
import { cn } from '@/utils/cn';

const BUTTON_SIZE = 56;
const MARGIN = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

interface Props {
  onPositionChange?: (pos: { x: number; y: number }) => void;
}

export function AIChatButton({ onPositionChange }: Props) {
  const { aiChatOpen, toggleAiChat } = useUIStore();

  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - BUTTON_SIZE - MARGIN,
    y: window.innerHeight - BUTTON_SIZE - 96,
  }));

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  const updatePos = useCallback((x: number, y: number) => {
    const next = {
      x: clamp(x, MARGIN, window.innerWidth - BUTTON_SIZE - MARGIN),
      y: clamp(y, MARGIN, window.innerHeight - BUTTON_SIZE - MARGIN),
    };
    setPos(next);
    onPositionChange?.(next);
  }, [onPositionChange]);

  // Report initial position
  useEffect(() => { onPositionChange?.(pos); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    hasMoved.current = false;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragging.current = true;
    hasMoved.current = false;
    dragOffset.current = { x: touch.clientX - pos.x, y: touch.clientY - pos.y };
  }, [pos]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      hasMoved.current = true;
      updatePos(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      hasMoved.current = true;
      const touch = e.touches[0];
      updatePos(touch.clientX - dragOffset.current.x, touch.clientY - dragOffset.current.y);
    };
    const stop = () => { dragging.current = false; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', stop);
    };
  }, [updatePos]);

  const handleClick = () => {
    if (!hasMoved.current) toggleAiChat();
  };

  return (
    <button
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={handleClick}
      style={{ left: pos.x, top: pos.y }}
      className={cn(
        'fixed z-50 h-14 w-14 rounded-full shadow-xl flex items-center justify-center select-none cursor-grab active:cursor-grabbing transition-shadow duration-200',
        aiChatOpen ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
      )}
      aria-label={aiChatOpen ? 'Close AI chat' : 'Open AI chat'}
    >
      {aiChatOpen
        ? <X className="h-5 w-5 pointer-events-none" />
        : <MessageCircle className="h-5 w-5 pointer-events-none" />}
    </button>
  );
}
