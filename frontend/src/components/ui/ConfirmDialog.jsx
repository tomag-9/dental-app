import React from 'react';
import { Button } from '@mui/material';
import Modal from './Modal';

const ConfirmDialog = ({ open, title = 'Potvrdenie', description, confirmText = 'Potvrdiť', cancelText = 'Zrušiť', onCancel, onConfirm, confirmColor = 'error' }) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    actions={[
      <Button key="cancel" onClick={onCancel}>{cancelText}</Button>,
      <Button key="confirm" color={confirmColor} variant="contained" onClick={onConfirm}>{confirmText}</Button>,
    ]}
  >
    {description}
  </Modal>
);

export default ConfirmDialog;
