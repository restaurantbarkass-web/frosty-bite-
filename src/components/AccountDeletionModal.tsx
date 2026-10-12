import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ShieldAlert, Mail, ArrowLeft, RefreshCw, CheckCircle2, 
  Trash2, AlertTriangle, ArrowUpRight, FileText, Lock, 
  HeartHandshake, ChevronRight, MessageSquare, Clock, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabase';
import { logout as authLogout } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { SlideToConfirm } from './ui/SlideToConfirm';

export interface AccountDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeletionSuccess: () => void;
}

type WizardStep = 'INSTRUCTIONS' | 'REASON' | 'EMAIL_OTP' | 'FINAL_DECISION' | 'DELETED';

const REASON_OPTIONS = [
  'I no longer need this account.',
  'I experienced ordering or delivery issues.',
  'I experienced payment issues.',
  'I have privacy concerns.',
  'I receive too many notifications.',
  'I am creating a new account.',
  'Other.'
];

export const AccountDeletionModal: React.FC<AccountDeletionModalProps> = ({
  isOpen,
  onClose,
  onDeletionSuccess
}) => {
  const { user: authUser, getAuthToken, logout } = useAuth();
  
  // Step state
  const [step, setStep] = useState<WizardStep>('INSTRUCTIONS');
  const [isLoadingInit, setIsLoadingInit] = useState(true);

  // Step 1: Instructions State
  const [instructionsAcknowledged, setInstructionsAcknowledged] = useState(false);
  const [hasActiveOrders, setHasActiveOrders] = useState(false);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  // User Security Contact info
  const [rawEmail, setRawEmail] = useState<string>('');
  const [maskedEmail, setMaskedEmail] = useState<string>('');

  // Step 2: Reason State
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');

  // Step 3: OTP State
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Step 4: Final Confirmation State
  const [deletionChallengeId, setDeletionChallengeId] = useState<string | null>(null);
  const [finalCheckboxConfirmed, setFinalCheckboxConfirmed] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Step 5: Post-Deletion Redirect Countdown
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // Helper to build authentication headers
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

    return headers;
  };

  // Reset & load info on open
  useEffect(() => {
    if (isOpen) {
      setStep('INSTRUCTIONS');
      setInstructionsAcknowledged(false);
      setSelectedReason('');
      setFeedback('');
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError(null);
      setDeletionChallengeId(null);
      setFinalCheckboxConfirmed(false);
      setIsDeletingAccount(false);
      setRedirectCountdown(5);
      fetchInitInfo();
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // Post-deletion redirect timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (step === 'DELETED' && redirectCountdown > 0) {
      timer = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            handleFinalFinish();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, redirectCountdown]);

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
        const validEmail = data.rawEmail || authUser?.email || '';
        setRawEmail(validEmail);
        setMaskedEmail(data.maskedEmail || (validEmail ? maskClientEmail(validEmail) : 'your registered email'));
        setHasActiveOrders(!!data.hasActiveOrders);
        setActiveOrdersCount(data.activeOrdersCount || 0);
      } else {
        // Fallback to local authUser email
        if (authUser?.email) {
          setRawEmail(authUser.email);
          setMaskedEmail(maskClientEmail(authUser.email));
        }
      }
    } catch (err) {
      console.warn('[Account Deletion Init] Warning:', err);
      if (authUser?.email) {
        setRawEmail(authUser.email);
        setMaskedEmail(maskClientEmail(authUser.email));
      }
    } finally {
      setIsLoadingInit(false);
    }
  };

  function maskClientEmail(email: string): string {
    if (!email || !email.includes('@')) return 'your registered email';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}*@${domain}`;
    return `${local[0]}${'*'.repeat(Math.min(6, local.length - 2))}${local[local.length - 1]}@${domain}`;
  }

  // Request Email OTP
  const handleRequestEmailOtp = async (reasonToUse?: string, feedbackToUse?: string) => {
    const finalReason = reasonToUse || selectedReason;
    const finalFeedback = feedbackToUse !== undefined ? feedbackToUse : feedback;

    if (!finalReason) {
      toast.error('Please select a reason before continuing.');
      return;
    }

    setIsSendingOtp(true);
    setOtpError(null);

    try {
      const targetEmail = rawEmail || authUser?.email;
      if (targetEmail) {
        // Dispatch via Supabase Auth OTP channel (same as login)
        try {
          await supabase.auth.signInWithOtp({
            email: targetEmail.trim().toLowerCase()
          });
        } catch (sbErr) {
          console.warn('[AccountDeletion] Supabase client OTP dispatch notice:', sbErr);
        }
      }

      const headers = await getAuthHeaders();
      const res = await fetch('/api/auth/account-deletion/request-otp', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          method: 'email',
          reason: finalReason,
          feedback: finalFeedback.slice(0, 500)
        })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(data.message || 'Verification code sent to your email!');
        setResendCooldown(data.cooldownSeconds || 60);
        setStep('EMAIL_OTP');
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 200);
      } else {
        const errorMsg = data.error || 'Failed to dispatch verification code. Please try again.';
        setOtpError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error('[Request Deletion OTP] Error:', err);
      toast.error('Unable to send verification code. Please check your connection.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // OTP Input handlers
  const handleOtpChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      const updated = [...otpDigits];
      updated[index] = '';
      setOtpDigits(updated);
      return;
    }

    if (clean.length === 1) {
      const updated = [...otpDigits];
      updated[index] = clean;
      setOtpDigits(updated);
      setOtpError(null);

      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (clean.length === 6) {
      const digits = clean.split('');
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
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      setOtpError(null);
      inputRefs.current[5]?.focus();
    }
  };

  // Verify submitted OTP
  const handleVerifyOtp = async () => {
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    try {
      const targetEmail = rawEmail || authUser?.email;
      let isSupabaseVerified = false;

      if (targetEmail) {
        try {
          const { error: sbErr } = await supabase.auth.verifyOtp({
            email: targetEmail.trim().toLowerCase(),
            token: code,
            type: 'email'
          });
          if (!sbErr) {
            isSupabaseVerified = true;
          }
        } catch (_) {}
      }

      const headers = await getAuthHeaders();
      const res = await fetch('/api/auth/account-deletion/verify-otp', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          method: 'email',
          otp: code,
          isSupabaseVerified,
          reason: selectedReason,
          feedback: feedback.slice(0, 500)
        })
      });

      const data = await res.json();
      if (res.ok && data.ok && data.verified && data.deletionChallengeId) {
        setDeletionChallengeId(data.deletionChallengeId);
        toast.success('Identity verified successfully!');
        setStep('FINAL_DECISION');
      } else {
        const errorMsg = data.error || 'Incorrect verification code. Please check your email.';
        setOtpError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error('[Verify Deletion OTP] Error:', err);
      const msg = 'Unable to verify code. Please try again.';
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Final Swipe Execution
  const handleExecuteDeletion = async () => {
    if (!finalCheckboxConfirmed) {
      toast.error('Please acknowledge the final confirmation checkbox before swiping.');
      throw new Error('Confirmation checkbox not acknowledged');
    }

    if (!deletionChallengeId) {
      toast.error('Missing verification challenge. Please verify your OTP code again.');
      setStep('EMAIL_OTP');
      throw new Error('Missing verification challenge');
    }

    setIsDeletingAccount(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/auth/account-deletion/confirm', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          deletionChallengeId,
          confirmationText: 'SWIPE_CONFIRMED',
          reason: selectedReason,
          feedback: feedback.slice(0, 500)
        })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        // Transition to completed farewell screen
        setStep('DELETED');

        // Execute local logout and clean cache
        try {
          if (logout) await logout();
          else await authLogout();
        } catch (_) {}

        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();
      } else {
        const errorMsg = data.error || 'Account could not be deleted. Please contact bakery support.';
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error('[Account Deletion Final Execution] Error:', err);
      toast.error(err?.message || 'Deletion failed. Please try again.');
      throw err;
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleFinalFinish = () => {
    onClose();
    onDeletionSuccess();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-xl bg-[#FAF8F5] rounded-3xl shadow-2xl border border-stone-200/90 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header Bar with Progress Indicator */}
          <div className="bg-white border-b border-stone-200/80 px-5 py-4 sm:px-6 sm:py-5 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 border border-red-100 shadow-xs shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-stone-900 text-base sm:text-lg tracking-tight uppercase truncate">
                    Account Deletion
                  </h3>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 truncate">
                    Frosty Bite Bakery • Security Center
                  </p>
                </div>
              </div>

              {step !== 'DELETED' && (
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* 4-Step Wizard Progress Bar */}
            {step !== 'DELETED' && (
              <div className="mt-4 pt-3 border-t border-stone-100 grid grid-cols-4 gap-2">
                {[
                  { id: 'INSTRUCTIONS', label: '1. Review' },
                  { id: 'REASON', label: '2. Reason' },
                  { id: 'EMAIL_OTP', label: '3. Email OTP' },
                  { id: 'FINAL_DECISION', label: '4. Confirm' }
                ].map((item, idx) => {
                  const stepOrder = ['INSTRUCTIONS', 'REASON', 'EMAIL_OTP', 'FINAL_DECISION'];
                  const currentIndex = stepOrder.indexOf(step);
                  const isCurrent = step === item.id;
                  const isPassed = currentIndex > idx;

                  return (
                    <div key={item.id} className="flex flex-col gap-1.5">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          isPassed 
                            ? 'bg-emerald-500' 
                            : isCurrent 
                            ? 'bg-[#E76A54]' 
                            : 'bg-stone-200'
                        }`} 
                      />
                      <span className={`text-[10px] font-black uppercase tracking-wider text-center truncate ${
                        isCurrent ? 'text-stone-900 font-extrabold' : isPassed ? 'text-emerald-700' : 'text-stone-400'
                      }`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-5 sm:p-7 overflow-y-auto space-y-5 text-stone-800 leading-relaxed">
            {isLoadingInit ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-3 text-stone-500">
                <RefreshCw size={26} className="animate-spin text-[#E76A54]" />
                <p className="text-xs font-black uppercase tracking-wider">Loading account security details…</p>
              </div>
            ) : (
              <>
                {/* ================= STEP 1: INSTRUCTIONS ================= */}
                {step === 'INSTRUCTIONS' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div>
                      <h4 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                        Before You Leave
                      </h4>
                      <p className="text-xs sm:text-sm text-stone-600 mt-1.5 font-medium leading-relaxed">
                        We are respectful of your choice and grateful for your time with Frosty Bite Bakery. Please review these essential details regarding permanent account deletion.
                      </p>
                    </div>

                    {/* Active Order Notice if present */}
                    {hasActiveOrders && (
                      <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start gap-3">
                        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-amber-900">
                            Active Orders Detected ({activeOrdersCount})
                          </p>
                          <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                            You currently have active bakery orders in progress. Active orders, pending refunds, and dispute inquiries should be resolved before closing your account.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 4-Step Explanation */}
                    <div className="bg-white rounded-2xl border border-stone-200/80 p-4 sm:p-5 shadow-xs space-y-3">
                      <h5 className="text-[11px] font-black uppercase tracking-widest text-stone-400">
                        How Permanent Deletion Works
                      </h5>
                      <ol className="space-y-2.5 text-xs text-stone-700">
                        <li className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-800 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                          <span><strong>Review Policies & Data Scope:</strong> Understand what personal data and rewards will be permanently wiped.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-800 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                          <span><strong>Share Reason:</strong> Help our bakery kitchen understand why you are leaving.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-800 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                          <span><strong>Email OTP Verification:</strong> Securely confirm account ownership via your registered email.</span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-800 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">4</span>
                          <span><strong>Swipe to Confirm:</strong> Perform an intentional swipe gesture to finalize permanent deletion.</span>
                        </li>
                      </ol>
                    </div>

                    {/* Data Removal Warning Cards */}
                    <div className="space-y-2.5">
                      <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-2xl flex items-start gap-3">
                        <Trash2 size={16} className="text-red-500 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-black text-red-900 uppercase tracking-wider">Personal Data Destruction</p>
                          <p className="text-red-700 mt-0.5">
                            Saved addresses, wishlist items, dietary preferences, custom avatar configs, and all loyalty rewards points will be irreversibly erased.
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 bg-stone-100 border border-stone-200 rounded-2xl flex items-start gap-3">
                        <FileText size={16} className="text-stone-500 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-black text-stone-900 uppercase tracking-wider">Statutory Record Retention</p>
                          <p className="text-stone-600 mt-0.5">
                            Completed historical financial invoices and transaction records will be retained in anonymized format where required by applicable tax and accounting laws.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Acknowledgment Checkbox */}
                    <div className="p-4 bg-orange-50/60 border border-orange-200/80 rounded-2xl">
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={instructionsAcknowledged}
                          onChange={(e) => setInstructionsAcknowledged(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded accent-[#E76A54] cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-bold text-stone-800 leading-snug">
                          I acknowledge that deleting my Frosty Bite account is permanent and irreversible, and that all eligible personal data will be erased.
                        </span>
                      </label>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                      <button
                        onClick={() => setStep('REASON')}
                        disabled={!instructionsAcknowledged}
                        className="w-full flex-1 h-12 min-h-[48px] px-5 bg-[#E76A54] hover:bg-[#d55842] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold uppercase text-xs sm:text-[13px] tracking-wider transition-all shadow-sm hover:shadow-md active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 group"
                      >
                        <span>Continue to Delete Account</span>
                        <ChevronRight size={17} strokeWidth={2.5} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </button>

                      <button
                        onClick={onClose}
                        className="w-full sm:w-auto h-12 min-h-[48px] px-6 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 border border-stone-200/60 rounded-xl font-bold uppercase text-xs sm:text-[13px] tracking-wider transition-all cursor-pointer flex items-center justify-center"
                      >
                        Keep My Account
                      </button>
                    </div>

                    {/* Policy Links Footer */}
                    <div className="pt-2 border-t border-stone-200/70 flex flex-wrap items-center justify-center gap-4 text-[11px] font-bold text-stone-500">
                      <a
                        href="https://frosty-bite-privacy-and-policy.vercel.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-stone-900 underline inline-flex items-center gap-1"
                      >
                        Terms & Conditions <ArrowUpRight size={11} />
                      </a>
                      <span>•</span>
                      <a
                        href="https://frosty-bite-privacy-and-policy.vercel.app/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-stone-900 underline inline-flex items-center gap-1"
                      >
                        Privacy Policy & Account Deletion Policy <ArrowUpRight size={11} />
                      </a>
                    </div>
                  </div>
                )}

                {/* ================= STEP 2: REASON ================= */}
                {step === 'REASON' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <button
                      onClick={() => setStep('INSTRUCTIONS')}
                      className="text-xs font-black uppercase tracking-wider text-stone-500 hover:text-stone-900 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to Instructions
                    </button>

                    <div>
                      <h4 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                        Help Us Understand
                      </h4>
                      <p className="text-xs sm:text-sm text-stone-600 mt-1 font-medium leading-relaxed">
                        Your feedback helps our pastry chefs and support team improve. Please tell us why you are choosing to delete your account.
                      </p>
                    </div>

                    {/* Selectable Reasons List */}
                    <div className="space-y-2.5">
                      {REASON_OPTIONS.map((reason) => {
                        const isSelected = selectedReason === reason;
                        return (
                          <div
                            key={reason}
                            onClick={() => setSelectedReason(reason)}
                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-orange-50/90 border-[#E76A54] shadow-xs'
                                : 'bg-white border-stone-200 hover:border-stone-300'
                            }`}
                          >
                            <span className="text-xs sm:text-sm font-bold text-stone-800 pr-2">
                              {reason}
                            </span>
                            <input
                              type="radio"
                              name="deletionReason"
                              checked={isSelected}
                              onChange={() => setSelectedReason(reason)}
                              className="accent-[#E76A54] w-4 h-4 cursor-pointer shrink-0"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Optional Feedback Text Area */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-wider text-stone-700">
                          Additional Feedback (Optional)
                        </label>
                        <span className="text-[10px] font-mono text-stone-400 font-bold">
                          {feedback.length}/500
                        </span>
                      </div>
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value.slice(0, 500))}
                        placeholder="Tell us what we could have done better... (optional)"
                        rows={3}
                        maxLength={500}
                        className="w-full p-3.5 bg-white border border-stone-300 rounded-2xl text-xs sm:text-sm text-stone-800 focus:border-[#E76A54] focus:outline-none transition-all placeholder:text-stone-400 resize-none shadow-xs"
                      />
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex gap-2.5 pt-2">
                      <button
                        onClick={() => setStep('INSTRUCTIONS')}
                        className="h-12 min-h-[48px] px-5 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 border border-stone-200/60 rounded-xl font-bold uppercase text-xs sm:text-[13px] tracking-wider transition-all cursor-pointer shrink-0 flex items-center justify-center"
                      >
                        Back
                      </button>

                      <button
                        onClick={() => handleRequestEmailOtp()}
                        disabled={!selectedReason || isSendingOtp}
                        className="flex-1 h-12 min-h-[48px] px-5 bg-[#E76A54] hover:bg-[#d55842] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold uppercase text-xs sm:text-[13px] tracking-wider transition-all shadow-sm hover:shadow-md active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 group"
                      >
                        {isSendingOtp ? (
                          <>
                            <RefreshCw size={17} className="animate-spin shrink-0" />
                            <span>Sending Verification Code…</span>
                          </>
                        ) : (
                          <>
                            <span>Continue to Verification</span>
                            <ChevronRight size={17} strokeWidth={2.5} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* ================= STEP 3: EMAIL OTP ================= */}
                {step === 'EMAIL_OTP' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <button
                      onClick={() => setStep('REASON')}
                      className="text-xs font-black uppercase tracking-wider text-stone-500 hover:text-stone-900 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to Reason
                    </button>

                    <div>
                      <h4 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                        Email OTP Verification
                      </h4>
                      <p className="text-xs sm:text-sm text-stone-600 mt-1 font-medium leading-relaxed">
                        To protect your account, we’ve sent a single-use 6-digit security code to your registered email:
                      </p>
                    </div>

                    {/* Masked Registered Email Pill */}
                    <div className="p-3.5 bg-stone-100 rounded-2xl border border-stone-200 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#E76A54] flex items-center justify-center shrink-0">
                        <Mail size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                          Registered Email Destination
                        </p>
                        <p className="text-xs font-mono font-black text-stone-900 truncate">
                          {maskedEmail}
                        </p>
                      </div>
                    </div>

                    {/* 6 Digit Numeric Inputs */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-wider text-stone-700 block">
                        Enter 6-Digit Code
                      </label>
                      <div className="grid grid-cols-6 gap-2 sm:gap-3 w-full">
                        {otpDigits.map((digit, idx) => (
                          <input
                            key={idx}
                            ref={(el) => { inputRefs.current[idx] = el; }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(idx, e)}
                            onPaste={handlePaste}
                            autoComplete="one-time-code"
                            className="w-full h-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-black bg-white border-2 border-stone-200 rounded-2xl focus:border-[#E76A54] focus:outline-none transition-all shadow-xs"
                          />
                        ))}
                      </div>
                    </div>

                    {/* Error Display */}
                    {otpError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-600 flex items-center gap-2">
                        <AlertTriangle size={16} className="shrink-0" />
                        <span>{otpError}</span>
                      </div>
                    )}

                    {/* Security Notice */}
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} /> Valid for 5 minutes
                      </span>

                      <button
                        onClick={() => handleRequestEmailOtp()}
                        disabled={resendCooldown > 0 || isSendingOtp}
                        className="text-xs font-black text-[#E76A54] hover:underline disabled:text-stone-400 disabled:no-underline cursor-pointer"
                      >
                        {resendCooldown > 0
                          ? `Resend code in ${resendCooldown}s`
                          : 'Resend code'}
                      </button>
                    </div>

                    {/* Verify Action */}
                    <div className="flex gap-2.5 pt-2">
                      <button
                        onClick={() => setStep('REASON')}
                        className="h-12 min-h-[48px] px-5 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 border border-stone-200/60 rounded-xl font-bold uppercase text-xs sm:text-[13px] tracking-wider transition-all cursor-pointer shrink-0 flex items-center justify-center"
                      >
                        Back
                      </button>

                      <button
                        onClick={handleVerifyOtp}
                        disabled={otpDigits.join('').length !== 6 || isVerifyingOtp}
                        className="flex-1 h-12 min-h-[48px] px-5 bg-[#E76A54] hover:bg-[#d55842] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold uppercase text-xs sm:text-[13px] tracking-wider transition-all shadow-sm hover:shadow-md active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 group"
                      >
                        {isVerifyingOtp ? (
                          <>
                            <RefreshCw size={17} className="animate-spin shrink-0" />
                            <span>Verifying Code…</span>
                          </>
                        ) : (
                          <>
                            <span>Verify & Proceed</span>
                            <ChevronRight size={17} strokeWidth={2.5} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* ================= STEP 4: FINAL DECISION ================= */}
                {step === 'FINAL_DECISION' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5">
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      <p className="text-xs font-bold text-emerald-800">
                        Email verified: Account ownership confirmed ✓
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                        Your Final Decision
                      </h4>
                      <p className="text-xs sm:text-sm text-stone-600 mt-1 font-medium leading-relaxed">
                        Please confirm your decision to permanently delete your account. This action cannot be reversed.
                      </p>
                    </div>

                    {/* Selected Reason Summary */}
                    <div className="p-4 bg-white border border-stone-200/90 rounded-2xl space-y-1.5 shadow-xs">
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                        Selected Reason for Leaving
                      </p>
                      <p className="text-xs sm:text-sm font-black text-stone-900">
                        "{selectedReason}"
                      </p>
                      {feedback && (
                        <p className="text-xs text-stone-600 italic pt-1 border-t border-stone-100">
                          Additional note: "{feedback}"
                        </p>
                      )}
                    </div>

                    {/* Summary of Data Categories to be Deleted */}
                    <div className="p-4 bg-red-50/80 border border-red-200 rounded-2xl space-y-2.5">
                      <div className="flex items-center gap-2 text-red-700 font-black text-xs uppercase tracking-wider">
                        <AlertTriangle size={16} />
                        <span>Categories of Data That Will Be Deleted</span>
                      </div>
                      <ul className="text-xs text-red-800 space-y-1 list-disc pl-4 leading-relaxed">
                        <li>Customer profile, avatar seeds, and contact credentials</li>
                        <li>Saved delivery addresses and GPS drop-off notes</li>
                        <li>Wishlist items and dietary preference tags</li>
                        <li>Frosty Rewards points, unlocked badges, and bakery loyalty status</li>
                      </ul>
                      <p className="text-[11px] text-red-600 font-bold pt-1 border-t border-red-200/60">
                        * In accordance with statutory law, past fiscal invoices will be retained in anonymized format.
                      </p>
                    </div>

                    {/* Confirmation Checkbox */}
                    <div className="p-4 bg-white border border-red-200 rounded-2xl shadow-xs">
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={finalCheckboxConfirmed}
                          onChange={(e) => setFinalCheckboxConfirmed(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded accent-red-600 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-bold text-stone-900 leading-snug">
                          I understand that permanent deletion cannot be undone and confirms the destruction of my Frosty Bite Bakery profile and all associated data.
                        </span>
                      </label>
                    </div>

                    {/* Interactive Swipe to Permanently Delete Slider */}
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] font-black uppercase tracking-widest text-center text-stone-500">
                        Swipe to Permanently Delete
                      </p>
                      <SlideToConfirm
                        onConfirm={handleExecuteDeletion}
                        disabled={!finalCheckboxConfirmed || isDeletingAccount}
                        variant="danger"
                        threshold={0.90}
                        label="Slide to Permanently Delete"
                        releaseLabel="Release to Delete Account"
                        processingLabel="Deleting Account Data…"
                        successLabel="Account Deleted"
                        icon={<Trash2 size={18} />}
                        className="w-full"
                      />
                    </div>

                    <div className="text-center pt-1">
                      <button
                        onClick={onClose}
                        disabled={isDeletingAccount}
                        className="text-xs font-black uppercase tracking-wider text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
                      >
                        Keep My Account (Cancel)
                      </button>
                    </div>
                  </div>
                )}

                {/* ================= STEP 5: DELETED / FAREWELL ================= */}
                {step === 'DELETED' && (
                  <div className="text-center py-8 space-y-5 animate-in fade-in duration-300">
                    <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-[#E76A54] border border-stone-200 shadow-inner">
                      <HeartHandshake size={40} />
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-2xl font-black text-stone-900 tracking-tight">
                        Account Permanently Deleted
                      </h4>
                      <p className="text-xs sm:text-sm text-stone-600 max-w-sm mx-auto leading-relaxed">
                        Your Frosty Bite Bakery account and all associated personal data have been completely erased from our systems.
                      </p>
                    </div>

                    <div className="p-4 bg-stone-100/80 rounded-2xl border border-stone-200 max-w-sm mx-auto text-xs text-stone-600">
                      <p className="font-bold">Thank you for having been part of our bakery family.</p>
                      <p className="text-stone-400 mt-1">We wish you the very best.</p>
                    </div>

                    <div className="pt-3 space-y-2">
                      <button
                        onClick={handleFinalFinish}
                        className="w-full max-w-xs mx-auto min-h-[56px] py-4 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-black uppercase text-sm tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center"
                      >
                        Return to Bakery Home ({redirectCountdown}s)
                      </button>
                    </div>
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
