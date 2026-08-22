// QRCode.jsx — minimal QR renderer used by the 2FA enrolment flow.
import qrcodeGenerator from 'qrcode-generator';

/**
 * Renders a QR code for an arbitrary string as an <img> with an inline data URL.
 * Returns null (instead of throwing) when the payload cannot be encoded.
 */
function QRCodeImage({ value, size = 168, alt = 'QR kód' }) {
  const src = React.useMemo(() => {
    if (!value) return '';
    try {
      const qr = qrcodeGenerator(0, 'M');
      qr.addData(String(value));
      qr.make();
      return qr.createDataURL(6, 8);
    } catch {
      return '';
    }
  }, [value]);

  if (!src) return null;
  return React.createElement('img', {
    src,
    alt,
    width: size,
    height: size,
    style: {
      width: size,
      height: size,
      display: 'block',
      borderRadius: 8,
      border: '1px solid #ece7dc',
      background: '#ffffff',
      imageRendering: 'pixelated',
    },
  });
}

Object.assign(window, { QRCodeImage });
