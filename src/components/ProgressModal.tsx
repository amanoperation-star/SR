import React from 'react';

interface ProgressModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  title: string;
  fileName: string;
  subtitle: string;
  percent: number;
  statusText: string;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  fileName,
  subtitle,
  percent,
  statusText,
}) => {
  const onCloseRef = React.useRef(onClose);
  const onConfirmRef = React.useRef(onConfirm);
  onCloseRef.current = onClose;
  onConfirmRef.current = onConfirm;

  // Automatically trigger completion and dismiss when progress reaches 100%
  React.useEffect(() => {
    if (isOpen && percent >= 100) {
      const timer = setTimeout(() => {
        if (onCloseRef.current) {
          onCloseRef.current();
        } else if (onConfirmRef.current) {
          onConfirmRef.current();
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen, percent]);

  // Escape key to dismiss
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate dynamic estimated remaining seconds based on the percentage
  let remainingText = '';
  if (percent >= 100) {
    remainingText = 'اكتمل بنجاح';
  } else if (percent <= 0) {
    remainingText = 'جاري البدء...';
  } else {
    const estimatedSeconds = Math.ceil(((100 - percent) * 0.1) + 1);
    remainingText = `${estimatedSeconds} ثانية تقريباً`;
  }

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050810]/85 backdrop-blur-md p-4 animate-in fade-in duration-300 font-['Tajawal']"
      onClick={() => onCloseRef.current?.()}
    >
      {/* Scope CSS inside a self-contained style block to perfectly apply the user's gorgeous design */}
      <style>{`
        .mesh-progress-modal-root {
          --bg-dark: #080c14;
          --card-inner-bg: #0d1322;
          --text-primary: #ffffff;
          --text-muted: #94a3b8;
          --accent-pink: #f43f5e;
          --accent-purple: #a855f7;
          --accent-blue: #3b82f6;
        }

        .border-gradient-wrapper {
          position: relative;
          width: 600px;
          max-width: 100%;
          border-radius: 24px;
          padding: 1.5px; /* Premium glowing border weight */
          background: linear-gradient(135deg, #f43f5e, #a855f7, #3b82f6, #10b981);
          background-size: 300% 300%;
          animation: meshGradientMove 6s ease infinite;
          box-shadow: 0 20px 50px rgba(168, 85, 247, 0.25);
        }

        @keyframes meshGradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .mesh-card {
          background: var(--card-inner-bg);
          border-radius: 23px;
          padding: 30px;
          color: var(--text-primary);
          position: relative;
          overflow: hidden;
        }

        /* Subtle mesh background effect */
        .mesh-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(circle at 20% 30%, rgba(168, 85, 247, 0.12) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.12) 0%, transparent 40%);
          pointer-events: none;
          border-radius: 23px;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          position: relative;
          z-index: 10;
        }

        .info-group {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .gear-box {
          width: 50px;
          height: 50px;
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.3);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-purple);
          box-shadow: 0 4px 15px rgba(168, 85, 247, 0.15);
        }

        .gear-box svg {
          width: 26px;
          height: 26px;
          animation: meshSpin 8s linear infinite;
        }

        @keyframes meshSpin {
          to { transform: rotate(360deg); }
        }

        .title-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .title-details h3 {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .file-chip {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--accent-pink);
          direction: ltr;
          display: inline-block;
          background: rgba(244, 63, 94, 0.08);
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid rgba(244, 63, 94, 0.15);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 260px;
        }

        .btn-cancel {
          background: rgba(244, 63, 94, 0.12);
          border: 1px solid rgba(244, 63, 94, 0.3);
          color: var(--accent-pink);
          padding: 8px 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
          position: relative;
          z-index: 20;
        }

        .btn-cancel:hover {
          background: rgba(244, 63, 94, 0.25);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(244, 63, 94, 0.2);
        }

        .btn-cancel:active {
          transform: translateY(0);
        }

        .btn-success {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.4);
          color: #10b981;
          padding: 8px 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
          position: relative;
          z-index: 20;
        }

        .btn-success:hover {
          background: rgba(16, 185, 129, 0.3);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
        }

        .btn-success:active {
          transform: translateY(0);
        }

        .description {
          font-size: 13.5px;
          color: var(--text-muted);
          line-height: 1.6;
          margin-bottom: 24px;
          position: relative;
          z-index: 10;
        }

        .progress-container {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 16px 20px;
          position: relative;
          z-index: 10;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 13px;
          gap: 12px;
        }

        .progress-info span:first-child {
          color: var(--text-primary);
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .progress-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 16px;
          font-weight: 800;
          background: linear-gradient(90deg, var(--accent-purple), var(--accent-pink));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          flex-shrink: 0;
        }

        .progress-bar-bg {
          width: 100%;
          height: 12px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #a855f7, #f43f5e);
          border-radius: 20px;
          box-shadow: 0 0 15px rgba(168, 85, 247, 0.5);
          transition: width 0.4s cubic-bezier(0.1, 0.8, 0.25, 1);
        }

        .footer-stats {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          font-size: 12px;
          color: var(--text-muted);
        }
      `}</style>

      <div 
        className="mesh-progress-modal-root border-gradient-wrapper"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mesh-card">
          <div className="card-header">
            <div className="info-group">
              <div className="gear-box">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="title-details">
                <h3>{title || 'قراءة ملف البيانات'}</h3>
                <span className="file-chip" title={fileName}>{fileName || 'Full_Data.csv'}</span>
              </div>
            </div>

            {(onClose || onConfirm) && (
              <button 
                type="button"
                className={percent >= 100 ? "btn-success" : "btn-cancel"} 
                onClick={() => {
                  if (percent >= 100) {
                    if (onConfirm) {
                      onConfirm();
                    } else if (onClose) {
                      onClose();
                    }
                  } else if (onClose) {
                    onClose();
                  }
                }}
              >
                {percent >= 100 ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>موافق (إتمام)</span>
                  </>
                ) : (
                  <span>إلغاء العملية</span>
                )}
              </button>
            )}
          </div>

          <p className="description">
            {subtitle || 'جاري تحميل ومعالجة بيانات الملف بأقصى سرعة فائقة...'}
          </p>

          <div className="progress-container">
            <div className="progress-info">
              <span>{statusText || 'تحميل البيانات بأقصى سرعة...'}</span>
              <span className="progress-badge">{percent}%</span>
            </div>
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${Math.max(3, Math.min(100, percent))}%` }}
              />
            </div>
            <div className="footer-stats">
              <span>الحالة: {percent >= 100 ? 'مكتمل' : 'قيد التنفيذ'}</span>
              <span>المتبقي: {remainingText}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
