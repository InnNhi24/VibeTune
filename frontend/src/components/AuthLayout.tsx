import React from "react";

type Props = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
};

export default function AuthLayout({ title, subtitle, children, onBack, rightSlot }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-700 flex items-center justify-center">
      <div className="w-full max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="mx-auto w-full max-w-md">
            <div className="bg-neutral-800/60 backdrop-blur-md p-8 rounded-2xl shadow-lg border border-neutral-700">
              <div className="flex items-center justify-between mb-6">
                <div>
                  {title && <h1 className="text-2xl font-semibold text-white">{title}</h1>}
                  {subtitle && <p className="text-sm text-neutral-300 mt-1">{subtitle}</p>}
                </div>
                <div>
                  {onBack && (
                    <button onClick={onBack} className="text-neutral-300 hover:text-white">
                      Back
                    </button>
                  )}
                </div>
              </div>

              <div>{children}</div>
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-center">
            <div className="w-full max-w-lg text-neutral-200">
              {rightSlot ? (
                rightSlot
              ) : (
                <div className="p-8 rounded-xl bg-neutral-800/30 border border-neutral-700">
                  <h3 className="text-lg font-medium mb-2">Welcome to VibeTune</h3>
                  <p className="text-sm text-neutral-300">A few details will help us personalize your practice plan.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
