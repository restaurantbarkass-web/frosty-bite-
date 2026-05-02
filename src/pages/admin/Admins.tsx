import React from 'react';
import { Shield, Mail, UserCheck, Star, BadgeCheck, Lock } from 'lucide-react';
import { ADMIN_EMAILS } from '../../constants';
import { motion } from 'motion/react';

export const Admins: React.FC = () => {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Shield className="text-primary" size={24} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
              Admin <span className="text-primary italic">Access</span>
            </h1>
          </div>
          <p className="text-gray-500 font-medium">Manage and view authorized administrative accounts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-3xl space-y-4">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
            <Lock size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Full Security</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              These accounts have complete control over the system, including orders, menu, and core settings.
            </p>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-3xl space-y-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
            <UserCheck size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Role Management</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Admins can manage customer lists and assign rider roles within the dashboard.
            </p>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-3xl space-y-4">
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
            <BadgeCheck size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Whitelisted</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Authorized emails are protected by dual-layer verification (Code Constants + Firebase Rules).
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="text-primary" size={20} />
            <h2 className="text-xl font-bold text-white tracking-tight">Authorized Admin Accounts</h2>
          </div>
          <span className="px-4 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20">
            {ADMIN_EMAILS.length} Active Admins
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-white/5">
                <th className="px-8 py-4">Account Email</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Security Level</th>
                <th className="px-8 py-4">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ADMIN_EMAILS.map((email, index) => (
                <motion.tr 
                  key={email}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:scale-110 transition-transform">
                        {email[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white group-hover:text-primary transition-colors tracking-tight">
                          {email}
                        </span>
                        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Administrator</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                       <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Live</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/10 w-fit">
                      <Shield size={12} className="text-amber-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Master Level</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-xs text-gray-500 font-medium tracking-tight">
                    {index === 0 ? 'Primary Admin' : 'Secondary Admin'}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-8 bg-primary/5 rounded-3xl border border-primary/10 flex flex-col md:flex-row items-center gap-8 group">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:rotate-12 transition-transform duration-500">
          <Star size={40} />
        </div>
        <div className="flex-1 text-center md:text-left space-y-2">
          <h4 className="text-xl font-bold text-white tracking-tight italic uppercase">Need to add more admins?</h4>
          <p className="text-sm text-gray-400 leading-relaxed font-medium">
            Administrative accounts are managed through the system core and environment configuration. 
            Contact the development team to update the whitelist or modify system rules for additional staff members.
          </p>
        </div>
      </div>
    </div>
  );
};
