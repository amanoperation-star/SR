import React from 'react';
import {
  HelpCircle,
  X,
  FileArchive,
  FileText,
  Trash2,
  Cpu,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface CompressionTipsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompressionTipsModal: React.FC<CompressionTipsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-blue-50/50 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-200">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                طرق تقليص حجم الملفات وتسريع الرفع
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                دليل عملي لتخفيض حجم ملفات البيانات الكبيرة (1.6+ مليون سجل) بأكثر من 85%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Tip 1: ZIP Compression */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <FileArchive className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    1. ضغط الملف في أرشيف ZIP (تخفيض الحجم بنسبة تصل إلى 90%)
                  </h4>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                    موصى به جداً ⭐
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  الملفات النصية وجداول البيانات تنضغط بشكل فائق جداً. ملف بحجم 150 ميجابايت ينخفض عادة إلى أقل من 15 ميجابايت بمجرد ضغطه.
                </p>
                <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200/60 text-xs text-slate-700 space-y-1">
                  <p className="font-semibold text-slate-800">كيفية الضغط بسهولة في ويندوز:</p>
                  <p className="text-slate-600">
                    اضغط كليك يمين على ملف الإكسل أو CSV ➔ اختر{' '}
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-bold">
                      Send to ➔ Compressed (zipped) folder
                    </span>
                  </p>
                  <p className="text-emerald-700 font-semibold pt-0.5">
                    ✓ يمكنك رفع ملف الـ .zip الناتج مباشرة إلى المنظومة الآن وستقوم بفكه تلقائياً!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tip 2: Save as CSV */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    2. الحفظ بصيغة CSV UTF-8 بدلاً من XLSX
                  </h4>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    أسرع 4 مرات
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  صيغة XLSX تحتوي على حزم XML وتنسيقات خلايا تزيد حجم الملف وتستهلك ذاكرة إضافية. صيغة CSV نصية خفيفة وتتم قراءتها بسرعة خارقة.
                </p>
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200/60 text-xs text-slate-700">
                  من برنامج Excel: اختر{' '}
                  <span className="font-bold text-slate-800">
                    File ➔ Save As ➔ نوع الملف: CSV UTF-8 (Comma delimited) (*.csv)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tip 3: Strip Extra Columns */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    3. حذف الأعمدة الزائدة والاحتفاظ بالعمودين المطلوبين فقط
                  </h4>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                    توفير 70% من الذاكرة
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  إذا كان الملف يحتوي على 15 عموداً، فإن حذف الأعمدة غير المطلوبة يقلل حجم الملف مباشرة بأكثر من 70%:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-blue-100">
                    <span className="font-bold text-blue-900 block mb-0.5">
                      💳 شيت المدفوعات:
                    </span>
                    <span className="text-slate-600">
                      احتفظ فقط بـ <code className="text-blue-700 font-bold">acceptor1</code> و{' '}
                      <code className="text-blue-700 font-bold">doner1</code>
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100">
                    <span className="font-bold text-emerald-900 block mb-0.5">
                      💵 شيت الكاش:
                    </span>
                    <span className="text-slate-600">
                      احتفظ فقط بـ <code className="text-emerald-700 font-bold">acceptor2</code> و{' '}
                      <code className="text-emerald-700 font-bold">doner2</code>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tip 4: In-App Splitter */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Cpu className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    4. استخدام «معالج تجزئة الملفات المليونية» المدمج
                  </h4>
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                    بدون تجميد UI
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  المنظومة مزودة بتقنية التجزئة المتقدمة (Non-blocking Chunking) التي تتيح معالجة أكثر من 1.6 مليون سجل على دفعات سريعة وتفريغ الذاكرة تلقائياً دون أي تجميد للشاشة.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            يمكنك دائماً رفع ملف الـ ZIP مباشرة في أي خانة رفع بالمنظومة.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            فهمت، حسناً
          </button>
        </div>
      </div>
    </div>
  );
};
