import React from 'react';
import { format } from 'date-fns';
import { Order } from '../../types';
import { Printer, X } from 'lucide-react';

interface KOTPrintProps {
  order: Order;
  onClose?: () => void;
}

export const KOTPrint: React.FC<KOTPrintProps> = ({ order, onClose }) => {
  const date = order.created_at ? new Date(order.created_at) : new Date();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white text-black p-6 rounded-2xl shadow-2xl w-full max-w-md relative print:shadow-none print:rounded-none print:p-0 print:max-w-none">
        {/* UI Controls - Hidden during print */}
        <div className="absolute -top-12 right-0 flex gap-3 print:hidden">
          <button
            onClick={handlePrint}
            className="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg"
          >
            <Printer size={18} />
            Print Bill
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="bg-white/10 text-white p-2 rounded-xl hover:bg-white/20 transition-colors backdrop-blur-md"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Bill Content */}
        <div className="kot-print-container font-mono text-sm w-full mx-auto">
          {/* Header */}
          <div className="text-center border-b border-dashed border-black pb-4 mb-4">
            <img 
              src="https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg" 
              alt="Frosty Bite Logo" 
              className="h-16 w-auto mx-auto mb-2 object-contain grayscale brightness-0"
              referrerPolicy="no-referrer"
            />
            <p className="text-xs font-bold">Artisan Bakery & Frozen Treats</p>
            <p className="text-[10px] mt-1">123 Food Street, Hyderabad, TS</p>
            <p className="text-[10px]">Ph: +91 77358 00239</p>
            <div className="mt-2 py-1 border-y border-dashed border-black/20">
              <p className="text-xs font-black uppercase tracking-widest">TAX INVOICE / KOT</p>
            </div>
          </div>

          {/* Order Info */}
          <div className="grid grid-cols-2 gap-y-1 mb-4 text-[11px]">
            <span className="font-bold">Order ID:</span>
            <span className="text-right">#{order.id.slice(-8).toUpperCase()}</span>
            <span className="font-bold">Date:</span>
            <span className="text-right">{format(date, 'dd/MM/yyyy')}</span>
            <span className="font-bold">Time:</span>
            <span className="text-right">{format(date, 'HH:mm:ss')}</span>
          </div>

          {/* Customer Details */}
          <div className="border-t border-dashed border-black pt-2 mb-4 text-[11px]">
            <p className="font-black uppercase mb-1">Customer Details:</p>
            <div className="grid grid-cols-[80px_1fr] gap-y-0.5">
              <span className="text-gray-600">Name:</span>
              <span className="font-bold">{order.customer_name}</span>
              <span className="text-gray-600">Phone:</span>
              <span className="font-bold">{order.phone}</span>
              <span className="text-gray-600">Address:</span>
              <span className="leading-tight">{order.address}</span>
              {order.notes && (
                <>
                  <span className="text-gray-600">Notes:</span>
                  <span className="font-bold text-orange-600 italic">{order.notes}</span>
                </>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border-y border-dashed border-black py-2 mb-4">
            <div className="grid grid-cols-[1fr_40px_60px_70px] font-black text-[10px] mb-2 uppercase border-b border-black/10 pb-1">
              <span>Item Description</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">Total</span>
            </div>
            <div className="space-y-1.5">
              {order.items.map((item, index) => {
                const name = typeof item === 'string' ? item : item.name;
                const qty = typeof item === 'string' ? 1 : item.quantity;
                const price = typeof item === 'string' ? 0 : item.price;
                return (
                  <div key={index} className="grid grid-cols-[1fr_40px_60px_70px] text-[11px] leading-tight">
                    <span className="uppercase">{name}</span>
                    <span className="text-center">x{qty}</span>
                    <span className="text-right">{price.toFixed(2)}</span>
                    <span className="text-right font-bold">{(price * qty).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Billing Summary */}
          <div className="space-y-1 mb-4 border-b border-dashed border-black pb-4">
            <div className="flex justify-between text-[11px]">
              <span>Subtotal:</span>
              <span>₹{(order.subtotal || (order.total - (order.gst || 0))).toFixed(2)}</span>
            </div>
            {order.gst !== undefined && (
              <div className="flex justify-between text-[11px]">
                <span>GST (5%):</span>
                <span>₹{order.gst.toFixed(2)}</span>
              </div>
            )}
            {order.delivery_charge !== undefined && (
              <div className="flex justify-between text-[11px]">
                <span>Delivery Charge:</span>
                <span>{order.delivery_charge === 0 ? 'FREE' : `₹${order.delivery_charge.toFixed(2)}`}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black mt-2 pt-2 border-t border-black/10">
              <span>GRAND TOTAL:</span>
              <span>₹{order.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-gray-100 p-2 rounded mb-4 text-[11px] print:bg-transparent print:p-0 print:border print:border-black/10">
            <div className="flex justify-between">
              <span className="font-bold">Payment Method:</span>
              <span className="uppercase">{order.payment_method || 'N/A'}</span>
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="font-bold">Payment Status:</span>
              <span className={`uppercase font-black ${order.payment_status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                {order.payment_status || 'PENDING'}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center space-y-1">
            <p className="text-[10px] font-bold italic">Stay Frosty! Thank you for choosing Frosty Bite!</p>
            <p className="text-[9px] text-gray-500">Visit again for more fresh delights.</p>
            <div className="pt-4">
              <p className="text-[8px] opacity-50">*** End of Invoice ***</p>
            </div>
          </div>
        </div>

        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .kot-print-container, .kot-print-container * {
              visibility: visible;
            }
            .kot-print-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 80mm;
              margin: 0;
              padding: 0;
              border: none;
            }
            @page {
              size: 80mm auto;
              margin: 0;
            }
          }
        `}</style>
      </div>
    </div>
  );
};
