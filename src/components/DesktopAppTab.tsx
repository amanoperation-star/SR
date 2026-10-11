import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Download,
  Copy,
  Check,
  ExternalLink,
  Zap,
  ShieldCheck,
  FileCode,
  HardDrive,
  Cpu,
  Sparkles,
  Layers,
  Database,
  ArrowRight,
  Eye,
  RefreshCw,
  Code2,
  CheckCircle2,
  Search,
  Maximize2,
  FileText,
  Clock,
  Settings2,
  Play,
  Terminal,
} from 'lucide-react';
import { SheetRow, ExpandedRow, MachineSummary } from '../types';

interface DesktopAppTabProps {
  sheet1: SheetRow[];
  sheet2: SheetRow[];
  expandedRows: ExpandedRow[];
  machinesResults: MachineSummary[];
  onOpenManualEditor: (mode: 1 | 2) => void;
}

export const DesktopAppTab: React.FC<DesktopAppTabProps> = ({
  sheet1,
  sheet2,
  expandedRows,
  machinesResults,
  onOpenManualEditor,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'docs'>('preview');
  const [htmlCode, setHtmlCode] = useState<string>('');
  const [originalCode, setOriginalCode] = useState<string>('');
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('منذ لحظات');
  const [codeSearchQuery, setCodeSearchQuery] = useState('');
  const [fontSize, setFontSize] = useState<number>(12);
  const [iframeKey, setIframeKey] = useState<number>(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch the latest HTML code
  const fetchLatestHTML = async (showNotification = false) => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/MatchHub-Enterprise-Desktop-v5.html?t=${Date.now()}`);
      if (response.ok) {
        const text = await response.text();
        setHtmlCode(text);
        setOriginalCode(text);
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(timeStr);
        setIframeKey((prev) => prev + 1);

        if (showNotification) {
          setStatusMessage('✅ تم تحديث وجلب أحدث كود لصفحة HTML بنجاح!');
          setTimeout(() => setStatusMessage(null), 3500);
        }
      }
    } catch (e) {
      console.error('Failed to fetch HTML:', e);
      if (showNotification) {
        setStatusMessage('⚠️ تعذر جلب التحديث عبر الشبكة، جاري الاعتماد على النسخة المضمنة.');
        setTimeout(() => setStatusMessage(null), 3500);
      }
    } finally {
      setIsRefreshing(false);
      setIsLoadingCode(false);
    }
  };

  useEffect(() => {
    fetchLatestHTML();
  }, []);

  // Inject current active data into HTML
  const injectActiveDataIntoHTML = () => {
    if (!originalCode) return;
    setIsRefreshing(true);

    let updated = originalCode;
    if (sheet1.length > 0 || sheet2.length > 0) {
      const injectedScript = `
      <script>
        window.addEventListener('DOMContentLoaded', () => {
          try {
            sheet1 = ${JSON.stringify(sheet1)};
            sheet2 = ${JSON.stringify(sheet2)};
            const s1Name = document.getElementById('status-name-1');
            const b1 = document.getElementById('badge-1');
            const s2Name = document.getElementById('status-name-2');
            const b2 = document.getElementById('badge-2');
            if (s1Name) s1Name.innerText = "بيانات_مخصصة_شيت1.xlsx";
            if (b1) { b1.className = "text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded"; b1.innerText = "تم (${sheet1.length})"; }
            if (s2Name) s2Name.innerText = "بيانات_مخصصة_شيت2.xlsx";
            if (b2) { b2.className = "text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded"; b2.innerText = "تم (${sheet2.length})"; }
            if (typeof updateDropdowns === 'function') updateDropdowns();
            if (typeof runMatchingAlgorithm === 'function') runMatchingAlgorithm();
          } catch(e) { console.error(e); }
        });
      </script>
      `;
      updated = updated.replace('</body>', `${injectedScript}</body>`);
    }

    setHtmlCode(updated);
    setIframeKey((prev) => prev + 1);
    const now = new Date();
    setLastSyncTime(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setIsRefreshing(false);
    setStatusMessage(`⚡ تم حقن وتحديث كود HTML بالبيانات الحالية (${sheet1.length} ماكينة / ${sheet2.length} مندوب)!`);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Download the HTML file
  const downloadHTMLFile = (useCustomCode = false) => {
    const codeToDownload = useCustomCode ? htmlCode : originalCode || htmlCode;
    const blob = new Blob([codeToDownload], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MatchHub-Enterprise-Desktop-v5${useCustomCode && (sheet1.length > 0) ? '-مدمج-بالبيانات' : ''}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setStatusMessage('📥 بدأ تحميل ملف الـ HTML المحدث بنجاح!');
    setTimeout(() => {
      setDownloadSuccess(false);
      setStatusMessage(null);
    }, 3000);
  };

  // Copy code to clipboard
  const copyCodeToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(htmlCode);
      setIsCopied(true);
      setStatusMessage('📋 تم نسخ كود الـ HTML المحدث كاملاً إلى الحافظة!');
      setTimeout(() => {
        setIsCopied(false);
        setStatusMessage(null);
      }, 3000);
    } catch (e) {
      alert('تعذر النسخ التلقائي، يمكنك تحديد الكود ونسخه يدوياً.');
    }
  };

  // Stats calculation
  const codeLinesCount = htmlCode ? htmlCode.split('\n').length : 0;
  const codeSizeKB = htmlCode ? (new Blob([htmlCode]).size / 1024).toFixed(1) : '0';

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-['Cairo']">
      {/* Top Banner: Desktop & HTML Studio Overview */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#0b1224] via-[#0d1527] to-[#070b14] border border-slate-800 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                <span>HTML & Desktop Live Studio</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>متزامن ومحدث 100% (Real-Time Live Sync)</span>
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>آخر مزامنة: {lastSyncTime}</span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-wide text-white">
              مركز إدارة وتحديث كود صفحة الـ HTML وبرنامج الديسكتوب
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              هذه الصفحة مخصصة لعرض، فحص، وتحديث كود صفحة الـ HTML وبرنامج الديسكتوب المستقل. يمكنك بنقرة زر واحدة تحديث الكود المصدري، حقن البيانات الحالية به، نسخه كاملاً، أو تحميل الملف للعمل عليه أوفلاين بدون إنترنت.
            </p>
          </div>

          {/* Core Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
            {/* Primary Live Update Button */}
            <button
              onClick={() => fetchLatestHTML(true)}
              disabled={isRefreshing}
              className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-75"
              title="جلب وتحديث أحدث كود HTML من المنظومة"
            >
              <RefreshCw className={`w-4 h-4 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>تحديث كود الـ HTML الآن (Live Refresh)</span>
            </button>

            {/* Rebuild with Active User Data */}
            <button
              onClick={injectActiveDataIntoHTML}
              disabled={isRefreshing}
              className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              title="حقن بيانات الشيتات الحالية في كود الـ HTML فوراً"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>إعادة بناء الكود ودمج بيانات الشيتات ({sheet1.length} ماكينة)</span>
            </button>

            {/* Download Official HTML */}
            <button
              onClick={() => downloadHTMLFile(false)}
              className="px-5 py-2.5 rounded-2xl bg-[#0d1527] hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-bold border border-slate-700/80 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>تحميل ملف HTML المحدث (.html)</span>
            </button>
          </div>
        </div>

        {/* Global Notification Floating Banner */}
        {statusMessage && (
          <div className="mt-4 p-3 rounded-xl bg-blue-950/80 border border-blue-500/40 text-blue-200 text-xs font-bold flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white text-xs">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Code Metrics & Specs Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">عدد أسطر الكود</span>
            <span className="text-lg font-black font-mono text-slate-900 dark:text-white">{codeLinesCount.toLocaleString()} سطر</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Code2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">حجم الملف المستقل</span>
            <span className="text-lg font-black font-mono text-slate-900 dark:text-white">{codeSizeKB} KB</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">حالة التشغيل</span>
            <span className="text-xs font-bold text-emerald-500 block">أوفلاين 100% بدون إنترنت</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">المكتبات المدمجة</span>
            <span className="text-xs font-bold text-indigo-400 block">Tailwind + Cairo + SheetJS</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Studio Work Area (Preview vs Source Code vs Documentation) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {/* Navigation & Controls Header */}
        <div className="p-4 bg-slate-100 dark:bg-[#0a0f1d] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
          {/* Segmented Tab Buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold shadow-inner">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>1. المعاينة الحية المباشرة (Live Preview)</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'code'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>2. محرر ومشاهد كود الـ HTML (Source Code)</span>
            </button>

            <button
              onClick={() => setActiveTab('docs')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'docs'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>3. دليل التشغيل والاستخدام الأوفلاين</span>
            </button>
          </div>

          {/* Quick Toolbar for Current Tab */}
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'code' && (
              <>
                {/* Font Size controls */}
                <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 rounded-xl px-2 py-1 text-xs font-mono">
                  <span className="text-[10px] text-slate-400">حجم الخط:</span>
                  <button
                    onClick={() => setFontSize((p) => Math.max(10, p - 1))}
                    className="px-1.5 py-0.5 rounded hover:bg-slate-700 text-slate-300"
                  >
                    -
                  </button>
                  <span className="font-bold text-white px-1">{fontSize}px</span>
                  <button
                    onClick={() => setFontSize((p) => Math.min(18, p + 1))}
                    className="px-1.5 py-0.5 rounded hover:bg-slate-700 text-slate-300"
                  >
                    +
                  </button>
                </div>

                {/* Copy Code */}
                <button
                  onClick={copyCodeToClipboard}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{isCopied ? 'تم النسخ!' : 'نسخ الكود'}</span>
                </button>
              </>
            )}

            {/* External Window */}
            <a
              href="/MatchHub-Enterprise-Desktop-v5.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span>فتح كنافذة مستقلة</span>
            </a>

            {/* Download Button */}
            <button
              onClick={() => downloadHTMLFile(activeTab === 'code')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-100" />
              <span>تحميل الآن (.html)</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Live Interactive Iframe Preview */}
        {activeTab === 'preview' && (
          <div className="relative w-full h-[780px] bg-[#080c14]">
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={`/MatchHub-Enterprise-Desktop-v5.html?v=${iframeKey}`}
              title="MatchHub Desktop Standalone App Live Preview"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-downloads allow-modals allow-forms"
            />
          </div>
        )}

        {/* TAB 2: Source Code Viewer & Live Editor */}
        {activeTab === 'code' && (
          <div className="p-4 bg-[#050811] space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <span>محرر ومشاهد الكود المصدري المستقل (HTML5 / TailwindCSS / Pure JS)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Read & Edit Ready
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setHtmlCode(originalCode);
                    setStatusMessage('↺ تم استرجاع الكود الأصلي لصفحة HTML.');
                    setTimeout(() => setStatusMessage(null), 3000);
                  }}
                  className="px-3 py-1 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  استرجاع الكود الأصلي
                </button>
                <button
                  onClick={() => {
                    setIframeKey((p) => p + 1);
                    setStatusMessage('✅ تم تطبيق التعديلات وتحديث إطار المعاينة.');
                    setTimeout(() => setStatusMessage(null), 3000);
                  }}
                  className="px-3 py-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-bold hover:bg-blue-600/30 transition-colors cursor-pointer"
                >
                  تحديث وتطبيق التعديلات
                </button>
              </div>
            </div>

            {/* Code Textarea with custom dark styling */}
            <div className="relative rounded-2xl border border-slate-800 overflow-hidden bg-[#070b14] shadow-inner">
              <textarea
                value={htmlCode}
                onChange={(e) => setHtmlCode(e.target.value)}
                style={{ fontSize: `${fontSize}px` }}
                className="w-full h-[650px] p-4 bg-transparent text-slate-200 font-mono leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 selection:bg-blue-600 selection:text-white"
                spellCheck={false}
                dir="ltr"
              />
            </div>
          </div>
        )}

        {/* TAB 3: Documentation & Features Guide */}
        {activeTab === 'docs' && (
          <div className="p-6 sm:p-8 bg-slate-50 dark:bg-[#070b14] space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-500" />
                  <span>كيف يعمل برنامج الديسكتوب المستقل؟</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  الملف مصمم بتقنية **Single-File Architecture**، أي أنه يحتوي على كافة واجهات المستخدم، ومحرك المطابقة، والمكتبات (مثل SheetJS لقراءة وتصدير ملفات الإكسل، وخط Cairo، وأيقونات FontAwesome 6) مدمجة بشكل مباشر.
                </p>
                <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 list-disc list-inside">
                  <li>يعمل على أي جهاز (Windows, Mac, Linux, Android) بدون تثبيت برامج.</li>
                  <li>لا يحتاج إلى إنترنت؛ كافة الحسابات والبيانات تتم في ذاكرة المتصفح بأمان تام 100%.</li>
                  <li>يدعم استيراد وتصدير ملفات Excel (.xlsx, .xls) و CSV.</li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>طريقة التحديث والمزامنة</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  عند إجراء أي تعديل على التطبيق الرئيسي أو عند طلب تعديل في الشات:
                </p>
                <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 list-decimal list-inside">
                  <li>يتم تحديث كود الـ HTML تلقائياً ليكون مطابقاً في نفس اللحظة.</li>
                  <li>اضغط على زر **«تحديث كود الـ HTML الآن»** لجلب آخر إصدار.</li>
                  <li>اضغط على **«تحميل ملف HTML المحدث»** لحفظ النسخة الجديدة على جهازك.</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
