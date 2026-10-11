import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 border border-amber-500/40 px-3.5 py-2 text-xs font-bold text-amber-400 shadow-xl backdrop-blur-md animate-in fade-in">
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
      <WifiOff className="w-3.5 h-3.5" />
      <span>نمط سطح المكتب أوفلاين — المعالجة تتم محلياً 100% بدون إنترنت</span>
    </div>
  );
};
