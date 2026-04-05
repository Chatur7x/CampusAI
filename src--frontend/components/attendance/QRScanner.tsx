import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { X, Camera, RefreshCw } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        // Successfully scanned
        scanner.clear();
        onScanSuccess(decodedText);
      },
      (_errorMessage) => {
        // Scan failed (usually just "no QR code found in frame")
        // We don't want to spam the UI with this
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />
      
      <div className="w-full max-w-md relative">
        <div className="absolute -top-16 right-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full w-12 h-12"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="text-center mb-8 space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex items-center justify-center">
              <Camera className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight italic uppercase italic">Scanner Active</h2>
          <p className="text-slate-400 text-sm font-medium">Position the classroom QR code within the frame</p>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border-2 border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.2)] bg-slate-900">
          <div id="qr-reader" className="w-full aspect-square" />
          
          {/* Scanning Animation Overlays */}
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 border-y border-blue-500/20 h-40 pointer-events-none">
            <div className="w-full h-[2px] bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-[scan_3s_infinite]" />
          </div>
        </div>

        <div className="mt-8 flex justify-center">
           <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Auto-Detection Mode
           </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-80px); opacity: 0.2; }
          50% { transform: translateY(80px); opacity: 1; }
        }
        #qr-reader {
          border: none !important;
        }
        #qr-reader img {
          display: none !important;
        }
        #qr-reader__dashboard_section_csr button {
          background-color: rgb(37, 99, 235) !important;
          color: white !important;
          border-radius: 0.75rem !important;
          padding: 0.5rem 1rem !important;
          font-weight: 600 !important;
          border: none !important;
          margin-top: 1rem !important;
        }
        #qr-reader__status_span {
            display: none !important;
        }
      `}</style>
    </div>
  );
}
