import React, { useState } from 'react';
import {
  Layers,
  Trash2,
  TableProperties,
  FlaskConical,
  Monitor,
  Download,
  Minus,
  Square,
  X,
  Maximize2,
  User,
  Settings,
  Sun,
  Moon,
  SlidersHorizontal,
  Palette,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface DesktopHeaderProps {
  onOpenDesktopCenter: () => void;
  onOpenManualEditor: () => void;
  onOpenRepLookup: () => void;
  onLoadSample: () => void;
  onResetAll: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  onOpenDesktopCenter,
  onOpenManualEditor,
  onOpenRepLookup,
  onLoadSample,
  onResetAll,
  isDarkMode,
  onToggleTheme,
}) => {
  const { isInstallable } = usePWAInstall();
  const [, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  return (
    <header className="relative w-full border-b border-slate-800/80 bg-[#070b14] select-none font-['Cairo']">
      {/* Desktop Window Title Bar Frame */}
      <div className="bg-[#050810] border-b border-slate-800/60 px-4 py-1 flex items-center justify-between text-[11px] text-slate-500 select-none">
        <div className="flex items-center gap-2">
          {/* Native Window Action Dots / Buttons */}
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={() => {
                window.close();
              }}
              title="إغلاق النافذة"
              className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 transition-colors flex items-center justify-center text-[7px] text-white opacity-80 hover:opacity-100 cursor-pointer"
            >
              <X className="w-2 h-2" />
            </button>
            <button
              onClick={toggleFullscreen}
              title="تكبير / ملء الشاشة"
              className="w-3 h-3 rounded-full bg-amber-500 hover:bg-amber-600 transition-colors flex items-center justify-center text-[7px] text-slate-900 opacity-80 hover:opacity-100 cursor-pointer"
            >
              <Minus className="w-2 h-2" />
            </button>
            <button
              onClick={toggleFullscreen}
              title="استعادة النافذة"
              className="w-3 h-3 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center text-[7px] text-white opacity-80 hover:opacity-100 cursor-pointer"
            >
              <Square className="w-1.5 h-1.5" />
            </button>
          </div>
          <span className="font-mono font-bold text-slate-400">MatchHub Desktop App</span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">• Standalone Enterprise Edition</span>
        </div>

        {/* System & Screen Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="hover:text-white text-slate-400 transition-colors"
            title="تبديل ملء الشاشة (F11)"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main App Header exactly matching image.png */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Right Side: Identity & Online Status */}
        <div className="flex items-center gap-3">
          {/* Glowing Blue Layers Icon Box */}
          <div className="w-10 h-10 rounded-2xl bg-blue-600 shadow-[0_0_25px_rgba(37,99,235,0.7)] text-white flex items-center justify-center shrink-0 border border-blue-400/40">
            <Layers className="w-5 h-5 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-500/40 bg-blue-950/60 text-blue-400">
                v5.0 Desktop
              </span>
              <h1 className="font-bold text-white text-base tracking-normal">
                MatchHub Enterprise
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              مطابقة ماكينات الدفع وتفصيل حسابات المناديب في أسطر منفصلة أوفلاين
            </p>
          </div>

          {/* Thin Divider */}
          <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block"></div>

          {/* Online Connected Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-xs font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            <span>متصل</span>
          </div>
        </div>

        {/* Left Side: Unified Toolbar Pill + Sample Demo + Settings */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {/* The Unified Pill Toolbar */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#0d1322] border border-slate-800 shadow-inner">
            {/* 1. برنامج الديسك توب Button (Electric Blue) */}
            <button
              onClick={onOpenDesktopCenter}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all cursor-pointer shrink-0"
              title="مركز برنامج الديسك توب والتثبيت المباشر"
            >
              <Monitor className="w-4 h-4 text-white" />
              <span>برنامج الديسك توب</span>
              {isInstallable && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              )}
            </button>

            {/* 2. استعلام مندوب / ماكينة */}
            <button
              onClick={onOpenRepLookup}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="استعلام سريع عن رقم الماكينة أو المندوب"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>استعلام مندوب / ماكينة</span>
            </button>

            {/* 2. تحميل HTML (Green) */}
            <a
              href="/MatchHub-Enterprise-Desktop-v5.html"
              download="MatchHub-Enterprise-Desktop-v5.html"
              className="px-2.5 py-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="تحميل البرنامج في ملف HTML مستقل يعمل أوفلاين بدون إنترنت"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>تحميل HTML</span>
            </a>

            {/* 4. محرر القوالب */}
            <button
              onClick={onOpenManualEditor}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="محرر الجداول التفاعلي"
            >
              <TableProperties className="w-4 h-4 text-slate-400" />
              <span>محرر القوالب</span>
            </button>

            {/* 5. مسح الكل (Trash Icon) */}
            <button
              onClick={onResetAll}
              className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer shrink-0"
              title="مسح كافة البيانات وإعادة الضبط"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
            </button>
          </div>

          {/* Separate Capsule Button: عينة فورية (Amber Border & Text) */}
          <button
            onClick={onLoadSample}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-[#16120b] border border-amber-500/50 hover:border-amber-400 text-amber-400 flex items-center gap-2 transition-all cursor-pointer shadow-sm shrink-0"
            title="تحميل عينة تجريبية فورية"
          >
            <FlaskConical className="w-4 h-4 text-amber-400" />
            <span>عينة فورية</span>
          </button>

          {/* Theme & Display / Settings Button */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-[#16120b] border border-amber-500/50 hover:border-amber-400 text-amber-400 flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0 hover:bg-amber-950/40 hover:scale-105 active:scale-95"
            title={isDarkMode ? 'التبديل إلى الوضع النهاري (Light Mode)' : 'التبديل إلى الوضع الليلي (Dark Mode)'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400 animate-in fade-in zoom-in duration-200" />
            ) : (
              <Moon className="w-4 h-4 text-amber-400 animate-in fade-in zoom-in duration-200" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
