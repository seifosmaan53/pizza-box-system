import React from 'react';
import { cn } from '@/utils/cn';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  content?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onChange?: (id: string) => void;
  className?: string;
  variant?: 'line' | 'pill';
}

export function Tabs({ tabs, activeTab: activeTabProp, onChange, className, variant = 'line' }: TabsProps) {
  const [internalTab, setInternalTab] = React.useState(tabs[0]?.id ?? '');
  const activeTab = activeTabProp !== undefined ? activeTabProp : internalTab;
  const handleChange = (id: string) => {
    if (onChange) onChange(id);
    if (activeTabProp === undefined) setInternalTab(id);
  };
  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  if (variant === 'pill') {
    return (
      <>
        <div className={cn('flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1', className)}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleChange(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                    activeTab === tab.id
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        {activeContent !== undefined && <div className="mt-4">{activeContent}</div>}
      </>
    );
  }

  return (
    <>
      <div className={cn('flex border-b border-gray-200 dark:border-gray-700', className)}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-red-600 text-red-700 dark:border-red-500 dark:text-red-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                  activeTab === tab.id
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {activeContent !== undefined && <div className="mt-4">{activeContent}</div>}
    </>
  );
}

export default Tabs;
