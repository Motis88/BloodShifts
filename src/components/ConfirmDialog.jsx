import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'אישור', cancelText = 'ביטול', type = 'danger' }) => {
  if (!isOpen) return null;

  const colors = {
    danger: {
      bg: 'bg-red-500',
      hoverBg: 'hover:bg-red-600',
      icon: 'text-red-600 dark:text-red-400'
    },
    warning: {
      bg: 'bg-yellow-500',
      hoverBg: 'hover:bg-yellow-600',
      icon: 'text-yellow-600 dark:text-yellow-400'
    },
    info: {
      bg: 'bg-blue-500',
      hoverBg: 'hover:bg-blue-600',
      icon: 'text-blue-600 dark:text-blue-400'
    }
  };

  const currentColor = colors[type] || colors.danger;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border-2 border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center`}>
              <AlertTriangle size={20} className={currentColor.icon} />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full p-2 transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 bg-gray-50 dark:bg-zinc-800/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-400 dark:hover:bg-gray-500 transition-all transform hover:scale-105"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-6 py-3 ${currentColor.bg} text-white rounded-xl font-medium ${currentColor.hoverBg} transition-all transform hover:scale-105 shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
