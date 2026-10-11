import React, { useState } from 'react';
import { UserCheck, UserX, X } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onReassign: (newRep: string, newAcc: string) => void;
  onMarkVacant: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onClearSelection,
  onReassign,
  onMarkVacant,
}) => {
  const [newRep, setNewRep] = useState('');
  const [newAcc, setNewAcc] = useState('');

  if (selectedCount === 0) return null;

  const handleApply = () => {
    if (!newRep.trim() && !newAcc.trim()) {
      alert('يرجى كتابة اسم المندوب أو رقم الحساب على الأقل.');
      return;
    }
    onReassign(newRep.trim(), newAcc.trim());
    setNewRep('');
    setNewAcc('');
  };

  return (
    <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-1/2 sm:translate-x-1/2 max-w-3xl w-full z-50 bg-slate-900/95 backdrop-blur-md text-white border border-indigo-500/40 rounded-3xl p-4 shadow-2xl transition-all duration-300 flex items-center justify-between gap-3 flex-wrap animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-sm font-black shadow">
          {selectedCount}
        </div>
        <div>
          <p className="text-xs font-bold text-white">
            تم تحديد <span className="text-amber-400 font-mono">{selectedCount}</span> ماكينة
          </p>
          <p className="text-[11px] text-slate-300">إعادة التوزيع السريع المباشر وتحديث النتائج فوراً</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap flex-1 justify-end">
        <input
          type="text"
          className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none w-36"
          placeholder="اسم المندوب الجديد..."
          value={newRep}
          onChange={(e) => setNewRep(e.target.value)}
        />
        <input
          type="text"
          className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none w-28"
          placeholder="رقم الحساب..."
          value={newAcc}
          onChange={(e) => setNewAcc(e.target.value)}
        />
        <button
          onClick={handleApply}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5"
        >
          <UserCheck className="w-4 h-4 text-amber-300" />
          <span>نقل للمندوب</span>
        </button>
        <button
          onClick={onMarkVacant}
          className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
        >
          <UserX className="w-4 h-4" />
          <span>إلغاء الإسناد (شاغرة)</span>
        </button>
        <button
          onClick={onClearSelection}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
          title="إلغاء التحديد"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
