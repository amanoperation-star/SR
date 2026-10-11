import React from 'react';
import {
  AlertTriangle,
  Users,
  Hash,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { DuplicateAuditItem, IrregularAccountItem } from '../types';

interface AuditConflictsTabProps {
  duplicates: DuplicateAuditItem[];
  irregulars: IrregularAccountItem[];
  onFilterDuplicates: () => void;
  onFilterIrregulars: () => void;
}

export const AuditConflictsTab: React.FC<AuditConflictsTabProps> = ({
  duplicates,
  irregulars,
  onFilterDuplicates,
  onFilterIrregulars,
}) => {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Duplicate Machines Card */}
        <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/80 p-5 rounded-3xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-amber-600 dark:text-amber-400 text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>تكرار الماكينات داخل الشيت الأول (Sheet 1)</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ماكينات مسجلة أكثر من مرة في ملف الماكينات المستهدفة الأساسي
              </p>
            </div>
            <span className="px-3 py-1 text-xs font-black rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {duplicates.length} تكرار
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 max-h-56 overflow-y-auto space-y-1.5">
            {duplicates.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>لا توجد ماكينات مكررة داخل الشيت الأول، البيانات نقية تماماً.</span>
              </div>
            ) : (
              duplicates.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 text-xs border border-slate-200 dark:border-slate-800"
                >
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {item.machine}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                    مكررة {item.occurrences} مرات
                  </span>
                </div>
              ))
            )}
          </div>

          {duplicates.length > 0 && (
            <button
              onClick={onFilterDuplicates}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Filter className="w-4 h-4" />
              <span>تصفية وعرض الماكينات المكررة بجدول النتائج</span>
            </button>
          )}
        </div>

        {/* Irregular Accounts Card */}
        <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800/80 p-5 rounded-3xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
                <Hash className="w-4 h-4" />
                <span>أرقام حسابات شاذة أو غير منتظمة (Irregular Accounts)</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                أرقام حسابات تحتوي على حروف، رموز، فراغات أو خانات غير متناسقة
              </p>
            </div>
            <span className="px-3 py-1 text-xs font-black rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              {irregulars.length} شاذ
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 max-h-56 overflow-y-auto space-y-1.5">
            {irregulars.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>كافة أرقام الحسابات المسندة منتظمة وسليمة بنجاح!</span>
              </div>
            ) : (
              irregulars.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 text-xs border border-slate-200 dark:border-slate-800"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                        {item.account}
                      </span>
                      <span className="text-[10px] text-slate-400">({item.machine})</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {item.repName || 'مندوب غير مسمى'} • {item.reason}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                    شاذ
                  </span>
                </div>
              ))
            )}
          </div>

          {irregulars.length > 0 && (
            <button
              onClick={onFilterIrregulars}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Filter className="w-4 h-4" />
              <span>تصفية وعرض الحسابات الشاذة بجدول النتائج</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
