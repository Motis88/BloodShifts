import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle size={20} className="text-green-600 dark:text-green-400" />,
    error: <XCircle size={20} className="text-red-600 dark:text-red-400" />,
    warning: <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400" />,
    info: <Info size={20} className="text-blue-600 dark:text-blue-400" />
  };

  const colors = {
    success: 'bg-green-50 dark:bg-green-900/30 border-green-500 dark:border-green-700',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-500 dark:border-red-700',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500 dark:border-yellow-700',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-700'
  };

  const textColors = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    warning: 'text-yellow-800 dark:text-yellow-200',
    info: 'text-blue-800 dark:text-blue-200'
  };

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border-2 shadow-2xl backdrop-blur-lg animate-bounce-in ${colors[type]}`}>
      <div className="flex-shrink-0">
        {icons[type]}
      </div>
      <p className={`font-bold text-sm md:text-base ${textColors[type]}`}>
        {message}
      </p>
      <button
        onClick={onClose}
        className={`flex-shrink-0 hover:opacity-70 transition-opacity ${textColors[type]}`}
      >
        <X size={18} />
      </button>
    </div>
  );
};

// Container לניהול כל ה-Toasts
export const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex flex-col items-center gap-2 pt-4 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
            duration={toast.duration}
          />
        ))}
      </div>
    </div>
  );
};

export default Toast;
