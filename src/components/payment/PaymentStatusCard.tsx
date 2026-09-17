import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Lock, Loader2 } from 'lucide-react';
import { PaymentTimerRing } from './PaymentTimerRing';
import {
  PaymentDetectedAnimation,
  PaymentVerifyingAnimation,
  PaymentSuccessAnimation,
  PaymentExpiredAnimation,
  PaymentAmbiguousAnimation,
  PaymentErrorAnimation
} from './PaymentAnimations';
import { cn } from '../../lib/utils';

export type PaymentState =
  | 'IDLE'
  | 'CREATING_ATTEMPT'
  | 'WAITING_FOR_PAYMENT'
  | 'PAYMENT_DETECTED'
  | 'VERIFYING'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_NOT_MATCHED'
  | 'PAYMENT_AMBIGUOUS'
  | 'PAYMENT_EXPIRED'
  | 'TEMPORARY_CONNECTION_ERROR'
  | 'TERMINAL_ERROR'
  | 'ERROR';

interface PaymentStatusCardProps {
  paymentState: PaymentState;
  amount: number;
  timeLeftSeconds: number;
  errorStatus?: number | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  onViewOrder?: () => void;
  onRestartPayment?: () => void;
  onBackToCheckout?: () => void;
  reducedMotion?: boolean;
  onLogin?: () => void;
}

export const PaymentStatusCard: React.FC<PaymentStatusCardProps> = ({
  paymentState,
  amount,
  timeLeftSeconds,
  errorStatus,
  errorMessage,
  onRetry,
  onViewOrder,
  onRestartPayment,
  onBackToCheckout,
  reducedMotion = false,
  onLogin
}) => {
  return (
    <div className="bg-white border border-[#EFE8DD] rounded-3xl p-5 sm:p-6 shadow-[0_4px_24px_rgba(44,24,16,0.05)] space-y-5 sm:space-y-6 text-center overflow-hidden relative">
      {/* Background Subtle Warm Accent */}
      <div 
        className={cn(
          "absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-20",
          paymentState === 'PAYMENT_VERIFIED' && "bg-emerald-500/20 opacity-30",
          paymentState === 'PAYMENT_DETECTED' && "bg-amber-500/20 opacity-25",
          paymentState === 'VERIFYING' && "bg-amber-400/20 opacity-25",
          paymentState === 'PAYMENT_EXPIRED' && "bg-rose-500/10 opacity-20",
          paymentState === 'WAITING_FOR_PAYMENT' && "bg-amber-500/10"
        )}
      />

      <div className="relative z-10 space-y-5 sm:space-y-6">
        {/* State Container with Accessible Announcements */}
        <div aria-live="polite" aria-atomic="true">
          {paymentState === 'CREATING_ATTEMPT' && (
            <div className="space-y-4 py-6">
              <Loader2 className="w-10 h-10 text-[#C59B27] animate-spin mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-black text-[#2C1810] uppercase tracking-tight">
                  Preparing Secure Payment...
                </h3>
                <p className="text-xs text-[#6B4E3D]">
                  Setting up your automatic verification session
                </p>
              </div>
            </div>
          )}

          {paymentState === 'WAITING_FOR_PAYMENT' && (
            <div className="space-y-4">
              <div className="flex flex-row items-center justify-between gap-4 pb-4 border-b border-[#F2ECE1]">
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#967B6C]">
                    Live Status
                  </p>
                  <h3 className="text-base sm:text-lg font-black text-[#2C1810] uppercase tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C59B27] animate-ping" />
                    Waiting for payment…
                  </h3>
                </div>
                <PaymentTimerRing 
                  timeLeftSeconds={timeLeftSeconds} 
                  reducedMotion={reducedMotion} 
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <p className="text-sm font-bold text-[#2C1810]">
                  Pay <span className="text-[#9E6F10] font-black font-sans">₹{amount.toFixed(2)}</span> using any UPI app
                </p>
                <p className="text-xs text-[#6B4E3D] max-w-sm mx-auto leading-relaxed">
                  Complete the payment in your UPI app. We'll verify it automatically.
                </p>
              </div>
            </div>
          )}

          {paymentState === 'PAYMENT_DETECTED' && (
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black uppercase tracking-widest">
                Payment detected
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-[#2C1810] tracking-tight">
                Payment detected
              </h3>
              <p className="text-2xl font-black text-amber-700 font-sans">₹{amount.toFixed(2)}</p>
              
              <PaymentDetectedAnimation amount={amount} reducedMotion={reducedMotion} />

              <p className="text-xs text-[#6B4E3D]">
                Verifying payment…
              </p>
            </div>
          )}

          {paymentState === 'VERIFYING' && (
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black uppercase tracking-widest">
                Authenticating
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-[#2C1810] tracking-tight">
                Verifying payment…
              </h3>
              
              <PaymentVerifyingAnimation reducedMotion={reducedMotion} />

              <p className="text-xs text-[#6B4E3D]">
                Verifying payment securely with backend…
              </p>
            </div>
          )}

          {paymentState === 'PAYMENT_VERIFIED' && (
            <PaymentSuccessAnimation 
              amount={amount}
              onViewOrder={onViewOrder}
              reducedMotion={reducedMotion}
            />
          )}

          {paymentState === 'PAYMENT_NOT_MATCHED' && (
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black uppercase tracking-widest">
                Matching Pending
              </div>
              <h3 className="text-lg sm:text-xl font-black text-[#2C1810] tracking-tight">
                Payment Detected
              </h3>
              <p className="text-xs text-[#6B4E3D]">
                We're checking your payment details. Please wait while we verify.
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="py-3 px-6 bg-[#2C1810] hover:bg-[#3E2415] text-[#FFF9EE] font-black uppercase tracking-widest rounded-xl text-xs transition-all active:scale-95 shadow-md"
                >
                  Retry Verification
                </button>
              )}
            </div>
          )}

          {paymentState === 'PAYMENT_AMBIGUOUS' && (
            <PaymentAmbiguousAnimation onRetry={onRetry} />
          )}

          {paymentState === 'PAYMENT_EXPIRED' && (
            <PaymentExpiredAnimation 
              onRestartPayment={onRestartPayment}
              onBackToCheckout={onBackToCheckout}
              onRetry={onRetry}
            />
          )}

          {(paymentState === 'ERROR' || paymentState === 'TERMINAL_ERROR') && (
            <PaymentErrorAnimation 
              errorStatus={errorStatus} 
              errorMessage={errorMessage} 
              onRetry={onRetry} 
              onLogin={onLogin}
            />
          )}
        </div>

        {/* Reassurance Footer */}
        {paymentState !== 'PAYMENT_VERIFIED' && paymentState !== 'PAYMENT_EXPIRED' && (
          <div className="pt-4 border-t border-[#F2ECE1] flex items-center justify-center gap-2 text-[10px] text-[#8C6D58] font-bold uppercase tracking-widest">
            <Lock size={12} className="text-[#C59B27]" />
            <span>Your payment is automatically verified.</span>
          </div>
        )}
      </div>
    </div>
  );
};

