import { X } from 'lucide-react';
import { useUIStore } from '@/store/ui';

const SHORTCUTS = [
  { section: 'Navigation', items: [
    { keys: ['Alt', 'D'], desc: 'Go to Dashboard' },
    { keys: ['Alt', 'S'], desc: 'Go to Stores' },
    { keys: ['Alt', 'I'], desc: 'Go to Invoices' },
    { keys: ['Alt', 'W'], desc: 'Go to Warehouse' },
    { keys: ['Alt', 'A'], desc: 'Go to Analytics' },
    { keys: ['Alt', 'P'], desc: 'Go to Profile' },
  ]},
  { section: 'Actions', items: [
    { keys: ['/'], desc: 'Focus search input' },
    { keys: ['Alt', 'C'], desc: 'Toggle AI chat' },
    { keys: ['?'], desc: 'Show this help' },
    { keys: ['Esc'], desc: 'Close panels / modals' },
  ]},
];

export function KeyboardShortcutsHelp() {
  const { keyboardHelpOpen, setKeyboardHelpOpen } = useUIStore();

  if (!keyboardHelpOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setKeyboardHelpOpen(false)}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h3>
          <button onClick={() => setKeyboardHelpOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {SHORTCUTS.map((group) => (
            <div key={group.section}>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{group.section}</h4>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.desc} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item.desc}</span>
                    <div className="flex gap-1">
                      {item.keys.map((k) => (
                        <kbd key={k} className="px-2 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 min-w-[24px] text-center">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-xs text-gray-400">Press <kbd className="px-1 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">?</kbd> anytime to show this</p>
        </div>
      </div>
    </div>
  );
}
