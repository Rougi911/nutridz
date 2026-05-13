import React, { useEffect, useRef } from 'react';
import Quagga from '@ericblade/quagga2';

export default function BarcodeScanner({ onDetected, onError }) {
  const containerRef = useRef(null);
  // Ref pour avoir toujours le dernier callback sans relancer l'effet
  const onDetectedRef = useRef(onDetected);
  const startedRef = useRef(false);
  const lastRef = useRef({ code: null, time: 0 });

  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    const handleDetected = (result) => {
      const code = result.codeResult.code;
      const now = Date.now();
      // Debounce : ignorer le même code pendant 2s
      if (code === lastRef.current.code && now - lastRef.current.time < 2000) return;
      lastRef.current = { code, time: now };
      onDetectedRef.current(code);
    };

    Quagga.init(
      {
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: containerRef.current,
          constraints: {
            width: { ideal: 800 },
            height: { ideal: 600 },
            facingMode: 'environment',
          },
        },
        locator: { patchSize: 'medium', halfSample: true },
        numOfWorkers: 2,
        frequency: 10,
        decoder: { readers: ['ean_reader', 'ean_8_reader', 'code_128_reader'] },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error('[BarcodeScanner] Init:', err);
          onError?.("Impossible d'accéder à la caméra. Autorisez l'accès dans les paramètres du navigateur.");
          return;
        }
        startedRef.current = true;
        Quagga.start();
      }
    );

    Quagga.onDetected(handleDetected);

    return () => {
      Quagga.offDetected(handleDetected);
      if (startedRef.current) {
        Quagga.stop();
        startedRef.current = false;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 12, overflow: 'hidden', background: '#000', minHeight: 260 }}>
      {/* Quagga injecte <video> et <canvas> ici */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Viseur */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'relative',
          width: '72%', height: 80,
          border: '1.5px solid rgba(255,255,255,0.5)',
          borderRadius: 6,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
        }}>
          {/* Coins verts */}
          {[
            { top: -2, left: -2, borderTop: '3px solid #4ADE80', borderLeft: '3px solid #4ADE80', borderRadius: '4px 0 0 0' },
            { top: -2, right: -2, borderTop: '3px solid #4ADE80', borderRight: '3px solid #4ADE80', borderRadius: '0 4px 0 0' },
            { bottom: -2, left: -2, borderBottom: '3px solid #4ADE80', borderLeft: '3px solid #4ADE80', borderRadius: '0 0 0 4px' },
            { bottom: -2, right: -2, borderBottom: '3px solid #4ADE80', borderRight: '3px solid #4ADE80', borderRadius: '0 0 4px 0' },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 18, height: 18, ...s }} />
          ))}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 14, letterSpacing: 0.2 }}>
          Cadrez le code-barres dans la zone
        </p>
      </div>
    </div>
  );
}
