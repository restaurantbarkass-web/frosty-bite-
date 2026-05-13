import React from 'react';
import { Crown, Sparkles, Zap, Award } from 'lucide-react';
import { cn } from '../lib/utils';

interface StoryCardProps {
  user: {
    name: string;
    avatar: string;
    avatar_url?: string;
    title?: string;
    level: number;
    points: number;
    tier: string;
  };
  type: 'avatar' | 'rank' | 'personality';
}

export const StoryCard: React.FC<StoryCardProps> = ({ user, type }) => {
  return (
    <div 
      id="story-card" 
      className="w-[1080px] h-[1920px] bg-black flex flex-col items-center justify-between p-24 overflow-hidden relative"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[200px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-purple-500/20 rounded-full blur-[200px] translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_#fff_1px,_transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* App Logo / Header */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/40">
           <Zap className="text-white w-12 h-12" />
        </div>
        <h2 className="text-white text-5xl font-black uppercase tracking-[0.4em] italic mt-4">
          Frosty <span className="text-primary italic">Bite</span>
        </h2>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full flex flex-col items-center text-center">
        {type === 'avatar' && (
          <div className="flex flex-col items-center gap-12">
            <div className="relative">
              <div className="absolute -inset-8 bg-gradient-to-tr from-primary via-purple-500 to-cyan-500 rounded-full blur-3xl opacity-50 animate-pulse" />
              <div className="relative w-[600px] h-[600px] rounded-full border-[10px] border-white shadow-2xl overflow-hidden bg-white p-2">
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className={cn(
                    "w-full h-full object-cover",
                    !user.avatar_url && "scale-125 translate-y-8"
                  )} 
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white rounded-[3rem] shadow-2xl flex items-center justify-center border-8 border-black">
                <Award className="text-primary w-24 h-24" />
              </div>
            </div>

            <div className="mt-16">
              <h1 className="text-8xl font-black text-white tracking-tighter mb-4">
                {user.name.split(' ')[0]}
              </h1>
              <p className="text-3xl font-bold text-primary uppercase tracking-[0.5em] mb-12">
                Certified {user.title || 'Foodie'}
              </p>
            </div>
          </div>
        )}

        {type === 'rank' && (
          <div className="flex flex-col items-center gap-16 w-full">
            <div className="text-primary font-black text-4xl uppercase tracking-[0.5em] mb-4">LOYALTY STATUS</div>
            <div className="relative w-full max-w-2xl bg-white/[0.03] border border-white/10 rounded-[5rem] p-20 backdrop-blur-3xl overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
                  <Crown size={200} className="text-white" />
               </div>
               
               <div className="flex flex-col items-center gap-8 relative z-10">
                  <Crown size={120} className="text-yellow-500 mb-4" />
                  <div className="text-zinc-500 font-black tracking-[0.4em] text-2xl uppercase">Current Tier</div>
                  <div className="text-white font-black text-9xl tracking-tighter leading-none italic uppercase">
                    {user.tier}
                  </div>
                  
                  <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden mt-12">
                     <div className="h-full bg-primary w-[75%]" />
                  </div>
                  <div className="text-2xl font-bold text-zinc-400 uppercase tracking-widest">
                    Level {user.level} • {user.points} XP
                  </div>
               </div>
            </div>
          </div>
        )}

        {type === 'personality' && (
          <div className="flex flex-col items-center gap-12 w-full">
            <div className="text-cyan-400 font-black text-4xl uppercase tracking-[0.5em]">AI FOOD PERSONALITY</div>
            
            <div className="relative w-full max-w-2xl h-[800px] flex flex-col items-center justify-center p-20 rounded-[5rem] overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-purple-500/20 to-cyan-500/30 blur-[100px]" />
               
               <div className="relative z-10 flex flex-col items-center text-center gap-12">
                  <div className="w-48 h-48 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md">
                    <Sparkles size={80} className="text-white" />
                  </div>
                  
                  <div className="space-y-4">
                    <p className="text-white/60 font-medium text-4xl italic">"Your vibe is"</p>
                    <h2 className="text-white font-black text-8xl tracking-tighter italic uppercase leading-tight">
                       The Midnight <br /> <span className="text-primary">Croissant</span> King
                    </h2>
                  </div>
                  
                  <div className="mt-8 px-12 py-6 bg-white/5 border border-white/10 rounded-full backdrop-blur-3xl">
                     <p className="text-zinc-400 font-black text-2xl tracking-[0.2em] uppercase">97% Vibe Matched</p>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Call to Action */}
      <div className="relative z-10 w-full flex flex-col items-center gap-12 opacity-80 pb-12">
        <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="flex items-center gap-6">
          <p className="text-zinc-500 font-black text-3xl tracking-[0.3em] uppercase">Join the revolution</p>
          <div className="w-3 h-3 rounded-full bg-primary" />
          <p className="text-white font-black text-3xl tracking-[0.1em]">@FROSTYBITE.APP</p>
        </div>
        <p className="text-zinc-600 font-bold text-2xl">Made with Frosty AI ✨</p>
      </div>
    </div>
  );
};
