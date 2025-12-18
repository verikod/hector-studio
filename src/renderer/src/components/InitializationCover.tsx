import React from 'react';
import hectorIcon from '../assets/hector.png';

/**
 * Full-screen cover shown during app initialization.
 * Prevents flickering while backend initializes default workspace.
 */
export const InitializationCover: React.FC = () => {
    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
            <div className="flex flex-col items-center gap-6">
                {/* Logo */}
                <div className="w-20 h-20 flex items-center justify-center">
                    <img src={hectorIcon} alt="Hector" className="w-full h-full object-contain" />
                </div>

                {/* App Name */}
                <h1 className="text-2xl font-semibold text-white">Hector Studio</h1>

                {/* Loading indicator */}
                <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-4 h-4 border-2 border-hector-green border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Starting...</span>
                </div>
            </div>
        </div>
    );
};
