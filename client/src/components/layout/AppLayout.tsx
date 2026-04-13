import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AIChatButton } from '@/components/ai/AIChatButton';
import { AIChatPanel } from '@/components/ai/AIChatPanel';
import { SessionTimeoutWarning } from '@/components/ui/SessionTimeoutWarning';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { KeyboardShortcutsHelp } from '@/components/ui/KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUIStore } from '@/store/ui';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { aiChatOpen } = useUIStore();
  const [buttonPos, setButtonPos] = useState<{ x: number; y: number } | null>(null);

  useKeyboardShortcuts();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* AI Chat */}
      <AIChatButton onPositionChange={setButtonPos} />
      {aiChatOpen && <AIChatPanel buttonPos={buttonPos} />}

      {/* Global UI overlays */}
      <SessionTimeoutWarning />
      <OfflineBanner />
      <KeyboardShortcutsHelp />
    </div>
  );
}

export default AppLayout;
