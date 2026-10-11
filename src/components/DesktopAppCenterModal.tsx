import React, { useState } from 'react';
import {
  Monitor,
  Download,
  CheckCircle2,
  Cpu,
  Layers,
  FileCode,
  Copy,
  Check,
  X,
  Keyboard,
  HardDrive,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface DesktopAppCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesktopAppCenterModal: React.FC<DesktopAppCenterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'pwa' | 'electron' | 'shortcuts'>('pwa');
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(key);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  const downloadWindowsBatLauncher = () => {
    const currentUrl = window.location.href;
    const batContent = `@echo off
title MatchHub Enterprise Desktop Launcher
echo ========================================================
echo   Starting MatchHub Enterprise Desktop Application...
echo ========================================================
start msedge --app="${currentUrl}" --window-size=1280,820 || start chrome --app="${currentUrl}" --window-size=1280,820
exit
`;
    const blob = new Blob([batContent], { type: 'application/bat' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Launch-MatchHub-Desktop.bat';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const electronMainScript = `// electron-main.cjs
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "MatchHub Enterprise - مطابقة الماكينات",
    icon: path.join(__dirname, 'dist/icon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Load build output or dev URL
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Remove default top browser menu for pure native look
  // Menu.setApplicationMenu(null);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`;

  const electronPackageJson = `{
  "name": "matchhub-desktop",
  "version": "5.0.0",
  "description": "برنامج سطح المكتب لمطابقة ماكينات الدفع وتفصيل حسابات المناديب",
  "main": "electron-main.cjs",
  "scripts": {
    "desktop": "electron .",
    "desktop:build": "electron-builder --win --x64"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.1.8"
  },
  "build": {
    "appId": "com.matchhub.enterprise",
    "productName": "MatchHub Desktop",
    "directories": { "output": "release" },
    "win": { "target": "nsis", "icon": "public/icon.svg" }
  }
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 transition-all">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-900/30 via-slate-900 to-blue-900/20">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-600/30">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg">
                  مركز تحويل وتشغيل التطبيق على الديسك توب (Desktop App Center)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                  v5.0 Native
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                طرق متعددة لتشغيل وتثبيت هذا المشروع كبرنامج سطح مكتب حقيقي ومستقل على Windows و Mac
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'pwa'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
            }`}
          >
            <Monitor className="w-4 h-4 text-amber-300" />
            <span>1. التثبيت الفوري بنقرة واحدة (PWA Desktop)</span>
          </button>
          <button
            onClick={() => setActiveTab('electron')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'electron'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
            }`}
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>2. بناء ملف تنفيذي (.exe / Electron)</span>
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'shortcuts'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
            }`}
          >
            <Keyboard className="w-4 h-4 text-blue-400" />
            <span>3. اختصارات لوحة المفاتيح</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50 dark:bg-[#070b13]">
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              {/* Highlight Install Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-950 border border-indigo-500/30 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1.5 text-right w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                    <h4 className="font-black text-sm sm:text-base text-white">
                      تثبيت البرنامج كـ Standalone Desktop App
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                    يعمل البرنامج كنافذة مستقلة تماماً بدون شريط عناوين المتصفح، مع أيقونة على شاشة سطح المكتب، ودعم كامل للعمل بدون إنترنت (Offline 100%).
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto justify-end">
                  {isInstalled ? (
                    <div className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>البرنامج مثبت ويعمل كديسك توب!</span>
                    </div>
                  ) : isInstallable ? (
                    <button
                      onClick={install}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>تثبيت برنامج الديسك توب الآن</span>
                    </button>
                  ) : (
                    <button
                      onClick={downloadWindowsBatLauncher}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>تنزيل مشغل ويندوز المباشر (.bat)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Advantages Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <h5 className="font-bold text-xs text-slate-900 dark:text-white">أوفلاين 100% بدون إنترنت</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    تم تضمين Service Worker وكاش محلي كامل، حتى لو انقطع الإنترنت يفتح البرنامج فوراً ويعالج آلاف الماكينات.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h5 className="font-bold text-xs text-slate-900 dark:text-white">أمان وخصوصية تامة للبيانات</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    جميع ملفات شيتات الماكينات والمناديب تُعالج فقط في ذاكرة جهازك (RAM/CPU) ولا يتم رفع أي سجل لخادم خارجي.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <h5 className="font-bold text-xs text-slate-900 dark:text-white">خفة وسرعة فائقة O(1)</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    خوارزميات الفهرسة بالـ Hash Maps تعالج أكثر من 50,000 ماكينة في ثوانٍ معدودة دون تجميد الجهاز.
                  </p>
                </div>

                {/* Single HTML Desktop File Download Box */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/30 space-y-2 sm:col-span-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
                  <div className="space-y-1">
                    <h5 className="font-bold text-xs text-emerald-400 flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-emerald-400" />
                      <span>تحميل نسخة HTML مستقلة ملف واحد (Standalone Single-File App)</span>
                    </h5>
                    <p className="text-[11px] text-slate-300">
                      يمكنك تحميل البرنامج بالكامل كملف HTML واحد يعمل على أي جهاز كمبيوتر مباشرة بالنقر عليه بدون تثبيت وبدون شبكة.
                    </p>
                  </div>
                  <a
                    href="/MatchHub-Enterprise-Desktop-v5.html"
                    download="MatchHub-Enterprise-Desktop-v5.html"
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل ملف HTML الأصلي</span>
                  </a>
                </div>
              </div>

              {/* Manual browser guide */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2">
                <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>خطوات التثبيت اليدوي من المتصفح (Chrome أو Edge):</span>
                </h5>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[11px] pr-2">
                  <li>
                    اضغط على أيقونة شاشة الكمبيوتر مع السهم <span className="font-mono text-indigo-500 font-bold">[⊞]</span> في نهاية شريط عنوان المتصفح (Address Bar).
                  </li>
                  <li>
                    أو افتح قائمة المتصفح (الثلاث نقاط) &larr; <strong className="text-slate-900 dark:text-white">تثبيت MatchHub Enterprise</strong>.
                  </li>
                  <li>
                    ستظهر أيقونة البرنامج مباشرة على سطح المكتب وشريط المهام (Taskbar) لفتحه مباشرة بضغطة زر.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'electron' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs">
                <p className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                  هل تريد تحويل هذا الكود إلى ملف تنفيذي (.exe) يثبته أي مستخدم بنظام Windows؟
                </p>
                <p className="text-indigo-700 dark:text-indigo-300 text-[11px]">
                  مشروعك مبني بـ Vite + React ويتحول مباشرة إلى برنامج ديسك توب أصلي بواسطة Electron. إليك الملفات والأوامر الجاهزة:
                </p>
              </div>

              {/* Step 1: electron-main.cjs */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-400 font-mono font-bold flex items-center gap-1.5">
                    <FileCode className="w-4 h-4" /> 1. كود ملف electron-main.cjs (ضعه في المجلد الرئيسي):
                  </span>
                  <button
                    onClick={() => handleCopy(electronMainScript, 'main')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    {copiedScript === 'main' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ الكود</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto p-3 bg-black/40 rounded-xl max-h-48">
                  {electronMainScript}
                </pre>
              </div>

              {/* Step 2: Build Command */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                    <Terminal className="w-4 h-4" /> 2. أوامر التشغيل والتحزيم لإنشاء .exe:
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        'npm install -D electron electron-builder\nnpm run build\nnpx electron-builder --win',
                        'cmd'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
                  >
                    {copiedScript === 'cmd' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ الأوامر</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 bg-black/40 rounded-xl font-mono text-[11px] text-emerald-300 space-y-1">
                  <div>npm install -D electron electron-builder</div>
                  <div>npm run build</div>
                  <div>npx electron-builder --win</div>
                </div>
                <p className="text-[10px] text-slate-400">
                  سيتم توليد ملف تثبيت جاهز للويندوز داخل مجلد <code className="text-amber-400">release/MatchHub-Setup-5.0.0.exe</code>
                </p>
              </div>

              {/* Quick Windows .bat Launcher */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-xs block text-slate-800 dark:text-slate-100">
                    أو نزّل مشغل سريع لفتح التطبيق بدون أي تثبيتات:
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    ملف صغير بصيغة .bat يفتح التطبيق في نافذة برنامج ديسك توب فوراً.
                  </span>
                </div>
                <button
                  onClick={downloadWindowsBatLauncher}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Download className="w-4 h-4 text-emerald-500" />
                  <span>تنزيل .bat Launcher</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                يدعم التطبيق اختصارات لوحة المفاتيح المعتادة في برامج سطح المكتب لسرعة وسلاسة العمل:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">فتح وتعبئة القالب التفاعلي</span>
                  <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-bold border border-slate-300 dark:border-slate-700">
                    Ctrl + E
                  </kbd>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">تصدير تقرير الإكسل فوراً</span>
                  <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-bold border border-slate-300 dark:border-slate-700">
                    Ctrl + S
                  </kbd>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">التركيز على شريط البحث</span>
                  <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-bold border border-slate-300 dark:border-slate-700">
                    Ctrl + F
                  </kbd>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">فتح مركز الديسك توب</span>
                  <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-bold border border-slate-300 dark:border-slate-700">
                    Ctrl + D
                  </kbd>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">إغلاق النوافذ المنبثقة</span>
                  <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-bold border border-slate-300 dark:border-slate-700">
                    Esc
                  </kbd>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">تبديل ملء الشاشة</span>
                  <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-bold border border-slate-300 dark:border-slate-700">
                    F11
                  </kbd>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            MatchHub Desktop • الإصدار 5.0 • متوافق مع Windows 10/11 و macOS و Linux
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
