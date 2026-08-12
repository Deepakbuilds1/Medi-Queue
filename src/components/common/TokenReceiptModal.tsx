import React from 'react';
import { Printer, CheckCircle, Building2, X } from 'lucide-react';
import { QueueToken } from '../../types';

interface TokenReceiptModalProps {
  isOpen: boolean;
  token: QueueToken | null;
  clinicName?: string;
  clinicLogo?: string;
  onClose: () => void;
}

export const TokenReceiptModal: React.FC<TokenReceiptModalProps> = ({
  isOpen,
  token,
  clinicName = 'CITY CARE CLINIC',
  clinicLogo,
  onClose
}) => {
  if (!isOpen || !token) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-2 text-teal-600 font-semibold text-sm">
            <CheckCircle className="w-5 h-5 text-teal-600" />
            Token Generated
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Ticket Receipt Area */}
        <div id="printable-token-receipt" className="p-6 text-center space-y-4 font-sans bg-white">
          
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-5 bg-slate-50/50">
            {/* Clinic Logo & Name */}
            <div className="flex flex-col items-center gap-2">
              {clinicLogo ? (
                <img src={clinicLogo} alt={clinicName} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="p-2.5 bg-teal-100 text-teal-700 rounded-full">
                  <Building2 className="w-6 h-6" />
                </div>
              )}
              <h2 className="text-base font-extrabold tracking-wider text-slate-800 uppercase">{clinicName}</h2>
            </div>

            <hr className="my-3 border-slate-200 border-dashed" />

            {/* Token Badge */}
            <div className="py-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">YOUR TOKEN</span>
              <div className="text-5xl font-black text-teal-700 my-2 font-mono tracking-tight">
                {token.tokenNumber}
              </div>
            </div>

            <hr className="my-3 border-slate-200 border-dashed" />

            {/* Patient & Doctor details */}
            <div className="text-left space-y-2 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Patient:</span>
                <span className="font-bold text-slate-900">{token.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Doctor:</span>
                <span className="font-bold text-teal-700">{token.doctorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Room:</span>
                <span className="font-medium text-slate-800">{token.roomNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Date & Time:</span>
                <span className="font-medium text-slate-700">
                  {new Date(token.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 text-center">
              <p className="text-[11px] font-medium text-slate-500 italic">Please wait for your turn.</p>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 flex items-center gap-3 border-t border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4" />
            PRINT TOKEN
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-xs"
          >
            DONE
          </button>
        </div>

      </div>
    </div>
  );
};
