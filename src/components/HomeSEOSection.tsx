import React from 'react';
import { RESTAURANT_WHATSAPP } from '../constants';
import { smoothScroll } from '../lib/utils';

export const HomeSEOSection: React.FC = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24 text-gray-400">
      <div className="glass-dark p-8 md:p-12 rounded-[40px] border border-white/5">
        <h1 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter uppercase mb-6">
          Welcome to Frosty Bite – Artisan Bakery & Frosty Treats
        </h1>
        <p className="text-lg leading-relaxed mb-12 max-w-4xl">
          Frosty Bite is your perfect destination for artisan bakery items, delicious cakes, and mouth-watering frosty treats. 
          We prepare every treat with high-quality ingredients to give you the best taste and experience.
        </p>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <h2 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-6 flex items-center gap-3">
              <span className="w-8 h-[2px] bg-primary"></span>
              Our Specialties
            </h2>
            <ul className="space-y-4 text-gray-300">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <span className="font-medium">Freshly Baked Cakes for every celebration</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <span className="font-medium">Delicious Pastries made with premium butter</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <span className="font-medium">Custom Cakes tailored to your special occasions</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <span className="font-medium">Fast and Easy Online Ordering with real-time tracking</span>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-6 flex items-center gap-3">
              <span className="w-8 h-[2px] bg-primary"></span>
              Why Choose Frosty Bite?
            </h2>
            <p className="text-gray-300 leading-relaxed text-base italic">
              At Frosty Bite, we focus on quality, freshness, and customer satisfaction. 
              Whether it's a birthday cake or a sweet pastry craving, we ensure every order is made with care and delivered fresh to your doorstep. 
              Our commitment to excellence makes us the top-rated artisan bakery.
            </p>
          </div>
        </div>

        <div className="mt-16 pt-12 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-4">
              Bulk Orders & Catering
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Planning a party or a corporate event? We offer specialized bulk order packages and catering services. 
              Contact us directly on WhatsApp to discuss your requirements and get a custom quote.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => window.open(`https://wa.me/${RESTAURANT_WHATSAPP}?text=${encodeURIComponent("Hi! I'd like to inquire about a bulk order for an event.")}`, '_blank')}
              className="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <div className="w-5 h-5 bg-white/20 rounded-lg flex items-center justify-center">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12.012 2c-5.508 0-9.987 4.479-9.987 9.988 0 1.761.459 3.474 1.33 4.988l-1.412 5.163 5.283-1.387c1.446.787 3.076 1.202 4.786 1.202 5.508 0 9.988-4.479 9.988-9.988s-4.48-9.988-9.988-9.988zm0 18.288c-1.554 0-3.079-.415-4.417-1.196l-.317-.188-3.284.862.877-3.208-.207-.329c-.859-1.365-1.312-2.946-1.312-4.57 0-4.569 3.717-8.287 8.287-8.287s8.287 3.717 8.287 8.287-3.718 8.287-8.287 8.287z"/></svg>
              </div>
              WhatsApp Inquiry
            </button>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-4">
              Order Your Favorite Treats
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Browse our complete bakery collection and order cakes and pastries online. 
              Enjoy fast delivery and make every moment special with Frosty Bite. From our oven to your heart, we promise a delightful experience.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => smoothScroll.toElement('#menu-section', { offset: -100 })}
              className="px-8 py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all"
            >
              View Our Menu
            </button>
            <button 
              onClick={() => smoothScroll.toElement('#reviews', { offset: -100 })}
              className="px-8 py-4 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white/10 transition-all"
            >
              About Us
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
