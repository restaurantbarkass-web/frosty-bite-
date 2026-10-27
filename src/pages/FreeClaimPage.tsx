import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Gift, CheckCircle2, AlertCircle, ArrowLeft, Cake, Truck, 
  MapPin, Phone, User, Sparkles, ShoppingBag, ShieldCheck
} from 'lucide-react';
import { loyaltyService } from '../services/loyaltyService';
import { Button } from '../components/Button';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';

export const FreeClaimPage: React.FC = () => {
  const { code: routeCode } = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialCode = routeCode || searchParams.get('code') || searchParams.get('token') || '';
  const initialVCode = searchParams.get('vcode') || '';

  const [verificationCode, setVerificationCode] = useState(initialVCode);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('pickup');
  const [loading, setLoading] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{ orderId: string; rewardName: string } | null>(null);

  const [claimInfo, setClaimInfo] = useState<any | null>(null);
  const [infoLoading, setInfoLoading] = useState(!!initialCode);
  const [infoError, setInfoError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialCode) return;
    let isMounted = true;
    const fetchInfo = async () => {
      setInfoLoading(true);
      try {
        const info = await loyaltyService.getClaimPageInfo(initialCode);
        if (isMounted && info) {
          setClaimInfo(info);
          if (info.customerName && info.customerName !== 'Valued Customer') {
            setCustomerName(info.customerName);
          }
          if (info.customerContact) {
            setPhone(info.customerContact);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setInfoError(err?.message || 'Failed to load reward preview.');
        }
      } finally {
        if (isMounted) setInfoLoading(false);
      }
    };
    fetchInfo();
    return () => { isMounted = false; };
  }, [initialCode]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      toast.error('Please enter your 6-character verification code.');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      toast.error('Please enter your mobile phone number.');
      return;
    }
    if (fulfillmentType === 'delivery' && !address.trim()) {
      toast.error('Please enter your delivery address.');
      return;
    }

    setLoading(true);
    try {
      const res = await loyaltyService.claimFreeReward({
        token: initialCode,
        verificationCode: verificationCode.trim().toUpperCase(),
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        fulfillmentType
      } as any);

      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      toast.success('Your free bakery treat has been claimed!');
      setSuccessOrder({
        orderId: res.orderId,
        rewardName: res.rewardName || 'Free Mystery Gift'
      });
    } catch (err: any) {
      toast.error(err?.message || 'Could not claim reward. Please check your verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#4A2E2A] flex flex-col items-center justify-start p-4 sm:p-8 font-sans">
      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-stone-600 hover:text-[#4A2E2A] font-medium text-sm transition-colors cursor-pointer bg-white/80 px-4 py-2 rounded-full shadow-xs border border-stone-200"
        >
          <ArrowLeft size={16} />
          <span>Home</span>
        </button>
        <div className="flex items-center gap-1.5 bg-orange-100/60 text-orange-700 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-200/50">
          <Sparkles size={14} className="text-orange-500" />
          <span>Free Mystery Gift Claim</span>
        </div>
      </div>

      {successOrder ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-orange-200 text-center space-y-6"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={44} />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Claim Confirmed!
            </span>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight">Your Treat is on the Way! 🧁</h2>
            <p className="text-sm text-stone-600">
              We have generated your genuine bakery order for <strong>{successOrder.rewardName}</strong>.
            </p>
          </div>

          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Order Reference</p>
            <p className="text-xl font-mono font-black text-primary">#{successOrder.orderId}</p>
            <p className="text-xs text-stone-500">Total Payable: <strong className="text-emerald-600">₹0 (Free Gift Claim)</strong></p>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              onClick={() => navigate(`/order-tracking/${successOrder.orderId}`)}
              variant="primary"
              className="w-full py-4 bg-[#E76A54] hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer shadow-md"
            >
              Track My Gift Order
            </Button>
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="w-full py-3 border-stone-200 text-stone-700 rounded-2xl cursor-pointer"
            >
              Back to Menu
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-100 space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-gradient-to-tr from-orange-400 to-pink-500 text-white rounded-2xl shadow-md">
              <Gift size={28} />
            </div>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight">Claim Your Free Gift</h2>
            <p className="text-xs text-stone-500">
              Enter the verification code from your WhatsApp notification to confirm your reward order.
            </p>
          </div>

          {infoLoading && (
            <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 text-center text-xs text-orange-700 animate-pulse">
              Verifying reward link details...
            </div>
          )}

          {claimInfo && (
            <div className="p-4 bg-orange-50/70 rounded-2xl border border-orange-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                  Unlocked Reward
                </span>
                <span className="text-xs font-bold text-stone-600">
                  {claimInfo.customerType === 'guest' ? '👤 Guest Reward' : '🌟 Member Reward'}
                </span>
              </div>
              <h3 className="text-base font-black text-stone-900">{claimInfo.prizeName}</h3>
              <p className="text-xs text-stone-600 leading-relaxed">{claimInfo.prizeDescription}</p>
              {claimInfo.expiresAt && (
                <p className="text-[10px] text-stone-400">
                  ⏳ Valid until: {new Date(claimInfo.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {claimInfo?.status === 'redeemed' && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800 font-medium text-center">
              🎉 This reward has already been claimed and placed as an order!
            </div>
          )}

          {claimInfo?.status === 'revoked' && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-800 font-medium text-center">
              ⚠️ This redemption link has been revoked by bakery administration.
            </div>
          )}

          {claimInfo?.isExpired && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800 font-medium text-center">
              ⏳ This reward voucher link has expired.
            </div>
          )}

          <form onSubmit={handleClaim} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black uppercase text-stone-700 mb-1">
                🔐 Verification Code / Reward Code
              </label>
              <input
                type="text"
                required
                placeholder="e.g. FB1234 or FB-REW-XXXX"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.toUpperCase())}
                className="w-full p-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-center font-mono font-bold text-base tracking-widest text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div className="pt-2 border-t border-stone-100 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-stone-600">Fulfillment Method</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFulfillmentType('pickup')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                    fulfillmentType === 'pickup'
                      ? 'bg-orange-50 border-primary text-primary shadow-xs'
                      : 'bg-stone-50 border-stone-200 text-stone-600'
                  }`}
                >
                  <Cake size={18} />
                  <span>In-Store Pickup</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentType('delivery')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                    fulfillmentType === 'delivery'
                      ? 'bg-orange-50 border-primary text-primary shadow-xs'
                      : 'bg-stone-50 border-stone-200 text-stone-600'
                  }`}
                >
                  <Truck size={18} />
                  <span>Home Delivery</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-black uppercase text-stone-700 mb-1">Your Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-stone-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="Enter your mobile number"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>

              {fulfillmentType === 'delivery' && (
                <div>
                  <label className="block text-[11px] font-black uppercase text-stone-700 mb-1">Delivery Address</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="House / Flat no, Street, Landmark, City"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              className="w-full py-4 bg-[#E76A54] hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer shadow-md mt-4"
            >
              {loading ? 'Validating & Placing Order...' : 'Claim My Free Gift 🎁'}
            </Button>
          </form>
        </motion.div>
      )}
    </div>
  );
};
