import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Mail, Smartphone, ArrowLeft, RefreshCw, CheckCircle2, Trash2, AlertTriangle, Headset } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabase';
import { logout } from '../services/authService';
import { useAuth } from '../context/AuthContext';

interface AccountDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeletionSuccess: () => void;
}

type Step = 'SELECT_METHOD' | 'ENTER_OTP' | 'FINAL_CONFIRM';

export const AccountDeletionModal: React.FC<AccountDeletionModalProps> = ({
  isOpen,
  onClose,
  onDeletionSuccess
}) => {
  const { user: authUser, getAuthToken } = useAuth();
  const [step, setStep] = useState<Step>('SELECT_METHOD');
  const [isLoadingInit, setIsLoadingInit] = useState(true);

  // Registered contact methods from server
  const [hasEmail, setHasEmail] = useState(false);
  const [rawEmail, setRawEmail] = useState<string>('');
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [hasMobile, setHasMobile] = useState(false);
  const [maskedMobile, setMaskedMobile] = useState<string | null>(null);
  const [supportOnly, setSupportOnly] = useState(false);

  // Selected verification method
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'mobile' | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isVerifyingOtp, setIsDeletingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Verified challenge token from server
  const [deletionChallengeId, setDeletionChallengeId] = useState<string | null>(null);

  // Final Confirmation State
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeletingAccount, setIsExecutingDeletion] = useState(false);

  // Helper to construct robust authentication headers
  const getAuthHeaders = async () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    try {
      if (getAuthToken) {
        const token = await getAuthToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (_) {}

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch (_) {}

    const uid = authUser?.id || authUser?.uid;
    if (uid) headers['x-user-id'] = uid;
    if (authUser?.email) headers['x-user-email'] = authUser.email;
    if (authUser?.phone) headers['x-user-phone'] = authUser.phone;

    return headers;
  };

  // Fetch registered contact methods on modal open
  useEffect(() => {
    if (isOpen) {
      setStep('SELECT_METHOD');
      setSelectedMethod(null);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError(null);
      setConfirmInput('');
      setDeletionChallengeId(null);
      fetchInitInfo();
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    let timer: any = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  const fetchInitInfo = async () => {
    setIsLoadingInit(true);
    try {
      const headers = await getAuthHeaders();

      const res = await fetch('/api/auth/account-deletion/init-info', {
        method: 'POST',
        headers
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setHasEmail(!!data.hasEmail);
        setRawEmail(data.rawEmail || authUser?.email || '');
        setMaskedEmail(data.maskedEmail);
        setHasMobile(!!data.hasMobile);
        setMaskedMobile(data.maskedMobile);
        setSupportOnly(!!data.supportOnly);

        // Auto-select method if only one exists
        if (data.hasEmail && !data.hasMobile) {
          setSelectedMethod('email');
        } else if (data.hasMobile && !data.hasEmail) {
          setSelectedMethod('mobile');
        }
      } else {
        toast.error('Failed to load account security info.');
      }
    } catch (err) {
      console.error('[Account Deletion Init] Error:', err);
    } finally {
      setIsLoadingInit(false);
    }
  };

  const handleRequestOtp = async (methodToUse?: 'email' | 'mobile') => {
    const method = methodToUse || selectedMethod;
    if (!method) {
      toast.error('Please select a verification method.');
      return;
    }

    setIsSendingOtp(true);
    setOtpError(null);

    try {
      const emailToUse = rawEmail || authUser?.email;

      // Dispatch through Supabase Auth (the exact same working SMTP channel as Login!)
      if (method === 'email' && emailToUse) {
        try {
          await supabase.auth.signInWithOtp({
            email: emailToUse.trim().toLowerCase()
          });
        } catch (sbErr) {
          console.warn('[AccountDeletionModal] Supabase client OTP dispatch notice:', sbErr);
        }
      }

      const headers = await getAuthHeaders();

      const res = await fetch('/api/auth/account-deletion/request-otp', {
        method: 'POST',
        headers,
        body: JSON.stringify({ method })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(data.message || 'Verification code sent!');
        setSelectedMethod(method);
        setResendCooldown(data.cooldownSeconds || 30);
        setStep('ENTER_OTP');
        // Auto-focus first input box
        setTimeout(() => inputRefs.current[0]?.focus(), 150);
      } else {
        const errorMsg = data.error || 'Unable to send verification code. Please try again.';
        setOtpError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error('[Request Deletion OTP] Error:', err);
      toast.error('Unable to send the verification code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // OTP Input handlers
  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (!cleanValue) {
      const updated = [...otpDigits];
      updated[index] = '';
      setOtpDigits(updated);
      return;
    }

    if (cleanValue.length === 1) {
      const updated = [...otpDigits];
      updated[index] = cleanValue;
      setOtpDigits(updated);
      setOtpError(null);

      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (cleanValue.length === 6) {
      // Handle pasting full 6 digits
      const digits = cleanValue.split('');
      setOtpDigits(digits);
      setOtpError(null);
      inputRefs.current[5]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pastedData.length === 6) {
      setOtpDigits(pastedData.split(''));
      setOtpError(null);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const submittedOtp = otpDigits.join('');
    if (submittedOtp.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsDeletingOtp(true);
    setOtpError(null);

    try {
      const emailToUse = rawEmail || authUser?.email;
      let isSupabaseVerified = false;

      // 1. If method is email, verify against Supabase Auth OTP (same validator as Login!)
      if (selectedMethod === 'email' && emailToUse) {
        try {
          const { error: sbVerifyErr } = await supabase.auth.verifyOtp({
            email: emailToUse.trim().toLowerCase(),
            token: submittedOtp,
            type: 'email'
          });
          if (!sbVerifyErr) {
            isSupabaseVerified = true;
          }
        } catch (_) {}
      }

      const headers = await getAuthHeaders();

      const res = await fetch('/api/auth/account-deletion/verify-otp', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          method: selectedMethod,
          otp: submittedOtp,
          isSupabaseVerified
        })
      });

      const data = await res.json();
      if (res.ok && data.ok && data.verified && data.deletionChallengeId) {
        setDeletionChallengeId(data.deletionChallengeId);
        setStep('FINAL_CONFIRM');
        toast.success('Identity verified!');
      } else {
        const errorMsg = data.error || 'Incorrect verification code.';
        setOtpError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error('[Verify Deletion OTP] Error:', err);
      setOtpError('Incorrect verification code.');
      toast.error('Incorrect verification code.');
    } finally {
      setIsDeletingOtp(false);
    }
  };

  const handleConfirmPermanentDeletion = async () => {
    if (confirmInput.trim() !== 'DELETE') {
      toast.error("Please type 'DELETE' in all capital letters to confirm.");
      return;
    }

    if (!deletionChallengeId) {
      toast.error('Missing security verification challenge. Please verify OTP again.');
      return;
    }

    setIsExecutingDeletion(true);

    try {
      const headers = await getAuthHeaders();

      const res = await fetch('/api/auth/account-deletion/confirm', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          deletionChallengeId,
          confirmationText: 'DELETE'
        })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success('Your account has been permanently deleted.', { duration: 5000 });
        onClose();
        
        // Execute complete client-side session & cache purge
        try {
          await logout();
        } catch (_) {}

        localStorage.clear();
        sessionStorage.clear();
        
        onDeletionSuccess();
      } else {
        const errorMsg = data.error || 'Your account could not be permanently deleted. Please try again.';
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error('[Permanent Deletion Confirm] Error:', err);
      toast.error('Your account could not be permanently deleted. No deletion has been confirmed. Please try again.');
    } finally {
      setIsExecutingDeletion(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-[#FAF8F5] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between p-4 sm:p-6 bg-white border-b border-stone-100 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 border border-red-100 shrink-0">
                <ShieldAlert size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-stone-900 text-base sm:text-lg uppercase tracking-tight truncate">Security Verification</h3>
                <p className="text-[11px] sm:text-xs text-stone-500 font-medium truncate">Frosty Bite Account Deletion</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-all cursor-pointer shrink-0 ml-1"
            >
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 max-w-full">
            {isLoadingInit ? (
              <div className="py-12 flex flex-col items-center justify-center text-stone-500 space-y-3">
                <RefreshCw size={28} className="animate-spin text-[#E76A54]" />
                <p className="text-xs font-bold uppercase tracking-wider">Verifying account security info…</p>
              </div>
            ) : supportOnly ? (
              /* Support Only Fallback */
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                  <Headset size={32} />
                </div>
                <h4 className="font-extrabold text-stone-900 text-base">Security Verification Needed</h4>
                <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
                  We need to verify your account before permanent deletion. Please contact Frosty Bite Support to complete verification.
                </p>
                <div className="pt-2">
                  <a
                    href="mailto:support@frostybite.app?subject=Account%20Deletion%20Verification%20Assistance"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-stone-800 transition-all"
                  >
                    <Mail size={16} /> Contact Support
                  </a>
                </div>
              </div>
            ) : (
              <>
                {/* STEP 1: SELECT VERIFICATION METHOD */}
                {step === 'SELECT_METHOD' && (
                  <div className="space-y-5">
                    <div>
                      <h4 className="font-extrabold text-stone-900 text-base">Verify your account</h4>
                      <p className="text-xs text-stone-500 mt-1">
                        We need to verify that you own this Frosty Bite account before permanently deleting it.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {/* Email Option */}
                      {hasEmail && maskedEmail && (
                        <div
                          onClick={() => setSelectedMethod('email')}
                          className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            selectedMethod === 'email'
                              ? 'bg-orange-50/80 border-[#E76A54] shadow-sm'
                              : 'bg-white border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              selectedMethod === 'email' ? 'bg-[#E76A54] text-white' : 'bg-stone-100 text-stone-600'
                            }`}>
                              <Mail size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-stone-900 uppercase tracking-wider truncate">Verify with Email</p>
                              <p className="text-xs text-stone-500 font-mono mt-0.5 truncate break-all">{maskedEmail}</p>
                            </div>
                          </div>
                          <input
                            type="radio"
                            name="method"
                            checked={selectedMethod === 'email'}
                            onChange={() => setSelectedMethod('email')}
                            className="accent-[#E76A54] w-4 h-4 cursor-pointer shrink-0"
                          />
                        </div>
                      )}

                      {/* Mobile Option */}
                      {hasMobile && maskedMobile && (
                        <div
                          onClick={() => setSelectedMethod('mobile')}
                          className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            selectedMethod === 'mobile'
                              ? 'bg-orange-50/80 border-[#E76A54] shadow-sm'
                              : 'bg-white border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              selectedMethod === 'mobile' ? 'bg-[#E76A54] text-white' : 'bg-stone-100 text-stone-600'
                            }`}>
                              <Smartphone size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-stone-900 uppercase tracking-wider truncate">Verify with Mobile</p>
                              <p className="text-xs text-stone-500 font-mono mt-0.5 truncate break-all">{maskedMobile}</p>
                            </div>
                          </div>
                          <input
                            type="radio"
                            name="method"
                            checked={selectedMethod === 'mobile'}
                            onChange={() => setSelectedMethod('mobile')}
                            className="accent-[#E76A54] w-4 h-4 cursor-pointer shrink-0"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleRequestOtp()}
                      disabled={!selectedMethod || isSendingOtp}
                      className="w-full h-13 sm:h-14 bg-[#E76A54] hover:bg-[#d55842] disabled:opacity-50 text-white rounded-2xl font-black uppercase text-xs tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSendingOtp ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Sending OTP…</span>
                        </>
                      ) : (
                        <span>Send Verification Code</span>
                      )}
                    </button>
                  </div>
                )}

                {/* STEP 2: ENTER OTP */}
                {step === 'ENTER_OTP' && (
                  <div className="space-y-4 sm:space-y-5 min-w-0">
                    <button
                      onClick={() => setStep('SELECT_METHOD')}
                      className="text-xs font-bold text-stone-500 hover:text-stone-900 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to options
                    </button>

                    <div>
                      <h4 className="font-extrabold text-stone-900 text-base">Enter 6-digit verification code</h4>
                      <p className="text-xs text-stone-500 mt-1 break-all">
                        Code sent to{' '}
                        <span className="font-mono font-bold text-stone-900">
                          {selectedMethod === 'email' ? maskedEmail : maskedMobile}
                        </span>
                      </p>
                    </div>

                    {/* 6 Responsive Flexible Grid Digit Inputs */}
                    <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5 py-1 sm:py-2 w-full max-w-full">
                      {otpDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { inputRefs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          onPaste={handlePaste}
                          autoComplete="one-time-code"
                          className="w-full h-12 sm:h-14 text-center text-lg sm:text-xl font-black font-mono bg-white border-2 border-stone-200 rounded-xl sm:rounded-2xl focus:border-[#E76A54] focus:outline-none transition-all shadow-xs min-w-0 p-0"
                        />
                      ))}
                    </div>

                    {/* Error Message */}
                    {otpError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
                        <AlertTriangle size={16} className="shrink-0" />
                        <span>{otpError}</span>
                      </div>
                    )}

                    {/* Verify & Resend Actions */}
                    <div className="space-y-3 pt-2">
                      <button
                        onClick={handleVerifyOtp}
                        disabled={otpDigits.join('').length !== 6 || isVerifyingOtp}
                        className="w-full h-14 bg-[#E76A54] hover:bg-[#d55842] disabled:opacity-50 text-white rounded-2xl font-black uppercase text-xs tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isVerifyingOtp ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            <span>Verifying Code…</span>
                          </>
                        ) : (
                          <span>Verify & Proceed</span>
                        )}
                      </button>

                      <div className="text-center">
                        <button
                          onClick={() => handleRequestOtp()}
                          disabled={resendCooldown > 0 || isSendingOtp}
                          className="text-xs font-bold text-[#E76A54] hover:underline disabled:text-stone-400 disabled:no-underline cursor-pointer"
                        >
                          {resendCooldown > 0
                            ? `Resend code in ${resendCooldown}s`
                            : 'Resend code'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: FINAL DELETION CONFIRMATION */}
                {step === 'FINAL_CONFIRM' && (
                  <div className="space-y-5">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                      <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-xs font-black text-emerald-900 uppercase tracking-wider">Identity verified ✓</p>
                        <p className="text-xs text-emerald-700">You've successfully verified ownership of this account.</p>
                      </div>
                    </div>

                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-red-600 font-black text-sm uppercase tracking-wide">
                        <AlertTriangle size={18} />
                        <span>Permanently delete your account?</span>
                      </div>
                      <p className="text-xs text-red-800 font-medium leading-relaxed">
                        This action cannot be undone. All your order history, active rewards, saved addresses, and profile data will be permanently removed.
                      </p>
                    </div>

                    <div className="space-y-2 pt-1">
                      <label className="text-xs font-extrabold text-stone-900 uppercase tracking-wider block">
                        Type <span className="font-mono bg-stone-200 px-1.5 py-0.5 rounded text-red-600 font-black">DELETE</span> to confirm
                      </label>
                      <input
                        type="text"
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value)}
                        placeholder="Type DELETE"
                        className="w-full h-12 px-4 bg-white border border-stone-300 rounded-xl font-mono text-sm font-bold uppercase tracking-widest focus:border-red-500 focus:outline-none transition-all"
                      />
                    </div>

                    <button
                      onClick={handleConfirmPermanentDeletion}
                      disabled={confirmInput.trim() !== 'DELETE' || isDeletingAccount}
                      className="w-full h-14 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-2xl font-black uppercase text-xs tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isDeletingAccount ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Deleting Account…</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} />
                          <span>Permanently Delete Account</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
