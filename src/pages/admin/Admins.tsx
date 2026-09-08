import React from 'react';
import { Shield, Mail, UserCheck, Star, BadgeCheck, Lock } from 'lucide-react';
import { ADMIN_EMAILS } from '../../constants';
import { motion } from 'motion/react';

export const Admins: React.FC = () => {
  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FAF8F5] text-[#E76A54] border border-stone-200 rounded-2xl">
              <Shield size={22} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900">
              Admin Access
            </h1>
          </div>
          <p className="text-stone-500 text-xs sm:text-sm font-medium">Manage and view authorized administrative accounts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white border border-stone-200/80 p-5 sm:p-6 rounded-3xl space-y-3 shadow-xs">
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center text-emerald-600">
            <Lock size={22} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900">Full Security</h3>
            <p className="text-xs text-stone-500 leading-relaxed mt-1">
              These accounts have complete control over the system, including orders, menu, and core settings.
            </p>
          </div>
        </div>

        <div className="bg-white border border-stone-200/80 p-5 sm:p-6 rounded-3xl space-y-3 shadow-xs">
          <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center text-blue-600">
            <UserCheck size={22} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900">Role Management</h3>
            <p className="text-xs text-stone-500 leading-relaxed mt-1">
              Admins can manage customer lists and oversee all operations within the dashboard.
            </p>
          </div>
        </div>

        <div className="bg-white border border-stone-200/80 p-5 sm:p-6 rounded-3xl space-y-3 shadow-xs">
          <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-amber-600">
            <BadgeCheck size={22} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900">Whitelisted</h3>
            <p className="text-xs text-stone-500 leading-relaxed mt-1">
              Authorized emails are protected by dual-layer verification (Code Constants + Supabase Rules).
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-stone-200/80 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-5 sm:p-6 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="text-[#E76A54]" size={20} />
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">Authorized Admin Accounts</h2>
          </div>
          <span className="px-3.5 py-1.5 bg-[#FAF8F5] text-[#E76A54] text-[10px] font-black uppercase tracking-widest rounded-full border border-stone-200">
            {ADMIN_EMAILS.length} Active Admins
          </span>
        </div>

        {/* Desktop View */}
        <div className="overflow-x-auto hidden sm:block">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50/60 text-[10px] font-black text-stone-500 uppercase tracking-widest border-b border-stone-100">
                <th className="px-6 py-4">Account Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Security Level</th>
                <th className="px-6 py-4">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {ADMIN_EMAILS.map((email, index) => (
                <motion.tr 
                  key={email}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group hover:bg-[#FAF8F5] transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-center text-[#E76A54] font-bold group-hover:scale-105 transition-transform">
                        {email[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-stone-900 group-hover:text-[#E76A54] transition-colors tracking-tight">
                          {email}
                        </span>
                        <span className="text-[10px] font-medium text-stone-400 uppercase tracking-widest">Administrator</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                       <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Live</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 rounded-xl border border-amber-200 w-fit">
                      <Shield size={12} className="text-amber-600" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Master Level</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-500 font-medium tracking-tight">
                    {index === 0 ? 'Primary Admin' : 'Secondary Admin'}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="sm:hidden divide-y divide-stone-100">
          {ADMIN_EMAILS.map((email, index) => (
            <div key={email} className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-center text-[#E76A54] font-bold text-sm">
                  {email[0].toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-bold text-stone-900 truncate">
                    {email}
                  </span>
                  <span className="text-[10px] font-medium text-stone-400 uppercase tracking-widest">
                    {index === 0 ? 'Primary Admin' : 'Secondary Admin'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-200">
                  <Shield size={11} className="text-amber-600" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Master Level</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Live</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 sm:p-8 bg-white rounded-3xl border border-stone-200/80 flex flex-col md:flex-row items-center gap-6 group shadow-xs">
        <div className="w-16 h-16 bg-[#FAF8F5] border border-stone-200 rounded-2xl flex items-center justify-center text-[#E76A54] group-hover:rotate-6 transition-transform duration-300">
          <Star size={32} />
        </div>
        <div className="flex-1 text-center md:text-left space-y-1.5">
          <h4 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">Need to add more admins?</h4>
          <p className="text-xs sm:text-sm text-stone-500 leading-relaxed font-medium">
            Administrative accounts are managed through the system constants. 
            Update the whitelist in constants configuration for additional bakery staff members.
          </p>
        </div>
      </div>
    </div>
  );
};
