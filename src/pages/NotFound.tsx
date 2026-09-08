import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Home, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8 max-w-lg"
      >
        <div className="relative">
          <h1 className="text-[12rem] font-black italic text-white/5 select-none leading-none">404</h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-primary/20 rounded-[32px] flex items-center justify-center text-primary animate-pulse">
              <ShoppingBag size={48} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-4xl font-black uppercase tracking-tighter italic text-white">Lost in the frost?</h2>
          <p className="text-zinc-500 font-medium max-w-xs mx-auto leading-relaxed">
            The page you're looking for seems to have melted away or never existed in our bakery.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={() => navigate(-1)} 
            variant="outline" 
            className="px-8 py-4 flex items-center gap-2 group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Go Back
          </Button>
          <Link to="/">
            <Button className="px-8 py-4 flex items-center gap-2 group w-full sm:w-auto">
              <Home size={18} className="group-hover:scale-110 transition-transform" />
              Return Home
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
