import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Order } from '../../types';
import { OrderConfirmationPage } from '../../pages/admin/OrderConfirmationPage';

interface AdminConfirmationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export const AdminConfirmationSuccessModal: React.FC<AdminConfirmationSuccessModalProps> = ({
  isOpen,
  onClose,
  order
}) => {
  if (!isOpen || !order) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/90 backdrop-blur-xl custom-scrollbar">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 15 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="min-h-screen w-full flex flex-col justify-between"
        >
          <OrderConfirmationPage
            order={order}
            onBack={onClose}
            isStandalonePage={false}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
