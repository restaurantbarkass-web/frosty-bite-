import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountDeletionModal } from '../components/AccountDeletionModal';

export const AccountDeletionPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <AccountDeletionModal
        isOpen={true}
        onClose={() => navigate('/profile')}
        onDeletionSuccess={() => navigate('/')}
      />
    </div>
  );
};

export default AccountDeletionPage;
