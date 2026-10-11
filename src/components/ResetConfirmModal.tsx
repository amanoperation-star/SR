import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 transition-all animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden">
        {/* Decorative ambient glow */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400 flex items-center justify-center text-xl shrink-0">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                تأكيد مسح كافة البيانات
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                إعادة تعيين وتفريغ المنظومة بالكامل
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900/60 mb-5">
          <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed font-medium">
            هل أنت متأكد من رغبتك في مسح كافة الشيتات المحملة، والنتائج، والإحصائيات، وإرجاع البرنامج إلى وضعه الأولي؟
          </p>
          <span className="block text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1">
            لا يمكن التراجع عن هذه العملية بعد التأكيد.
          </span>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            إلغاء الأمر
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>نعم، مسح كافة البيانات</span>
          </button>
        </div>
      </div>
    </div>
  );
};
