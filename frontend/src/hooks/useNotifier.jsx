import { useState, useCallback } from 'react';
import { Snackbar, Alert } from '@mui/material';

export default function useNotifier() {
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  const notify = useCallback((message, severity = 'info') => {
    setToast({ open: true, message, severity });
  }, []);

  const Toast = () => (
    <Snackbar
      open={toast.open}
      autoHideDuration={3000}
      onClose={() => setToast((t) => ({ ...t, open: false }))}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert onClose={() => setToast((t) => ({ ...t, open: false }))} severity={toast.severity} sx={{ width: '100%' }}>
        {toast.message}
      </Alert>
    </Snackbar>
  );

  return { notify, Toast };
}
