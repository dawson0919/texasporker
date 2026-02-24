import React, { useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    icon?: string;
    large?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, icon, large = false }) => {
    // Prevent scrolling on the body when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className={`
        relative w-full ${large ? 'max-w-4xl' : 'max-w-md'} 
        bg-surface-darker rounded-2xl border border-white/10 shadow-2xl overflow-hidden
        transform transition-all scale-100 opacity-100
      `}>

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-surface-dark bg-gradient-to-r from-surface-darker to-surface-dark">
                    <div className="flex items-center gap-3">
                        {icon && (
                            <span className="material-symbols-outlined text-accent-gold text-2xl">
                                {icon}
                            </span>
                        )}
                        <h3 className="text-xl font-bold text-white tracking-wide">
                            {title}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors rounded-full p-1 hover:bg-white/10"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};
