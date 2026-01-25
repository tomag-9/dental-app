import React, { useState } from 'react';
import InvoiceHistory from './InvoiceHistory';
import InvoiceCreate from './InvoiceCreate';

const Invoices = ({ token, setError }) => {
  const [currentView, setCurrentView] = useState('history'); // 'history' or 'create'

  const handleCreateNew = () => {
    setCurrentView('create');
  };

  const handleBackToHistory = () => {
    setCurrentView('history');
  };

  if (currentView === 'create') {
    return (
      <InvoiceCreate 
        token={token} 
        setError={setError} 
        onBack={handleBackToHistory}
      />
    );
  }

  return (
    <InvoiceHistory 
      token={token} 
      setError={setError} 
      onCreateNew={handleCreateNew}
    />
  );
};

export default Invoices;