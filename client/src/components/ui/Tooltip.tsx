import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: TooltipPosition;
  delay?: number;
  className?: string;
}

export function Tooltip({ content, children, position = 'top', delay = 300, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        let top = 0;
        let left = 0;
        switch (position) {
          case 'top':
            top = rect.top + scrollY - 8;
            left = rect.left + scrollX + rect.width / 2;
            break;
          case 'bottom':
            top = rect.bottom + scrollY + 8;
            left = rect.left + scrollX + rect.width / 2;
            break;
          case 'left':
            top = rect.top + scrollY + rect.height / 2;
            left = rect.left + scrollX - 8;
            break;
          case 'right':
            top = rect.top + scrollY + rect.height / 2;
            left = rect.right + scrollX + 8;
            break;
        }
        setCoords({ top, left });
        setVisible(true);
      }
    }, delay);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const transformClasses: Record<TooltipPosition, string> = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  };

  return (
    <>
      {React.cloneElement(children, {
        ref: triggerRef,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      })}
      {visible &&
        createPortal(
          <div
            className={cn(
              'fixed z-[9999] px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg pointer-events-none whitespace-nowrap',
              transformClasses[position],
              className
            )}
            style={{ top: coords.top, left: coords.left }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

export default Tooltip;
