"use client";

import { useEffect, useState } from "react";
import { Copy, Check, X, Download, Link } from "lucide-react";
import QRCode from "qrcode";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrToken: string;
  projectTitle: string;
  projectCode: string;
  departments?: string;
}

export default function QRCodeModal({
  isOpen,
  onClose,
  qrToken,
  projectTitle,
  projectCode,
  departments = "IT, Finance, Operations"
}: QRCodeModalProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [scanUrl, setScanUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/meetings/scan/${qrToken}`;
    setScanUrl(url);

    QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF"
      }
    })
      .then((urlData) => setDataUrl(urlData))
      .catch((err) => console.error("Failed to generate QR code", err));
  }, [isOpen, qrToken]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(scanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `QR-${projectCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative bg-[#0b1326] border-[3px] border-slate-700/60 rounded-[28px] shadow-2xl max-w-[360px] w-full overflow-hidden animate-in zoom-in-95 duration-200 font-roboto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative pt-6 pb-4 px-6 text-center space-y-2">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors z-10"
            title="Close QR modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Audit Plan Title */}
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-[0.25em] font-roboto">
            Audit Plan
          </h3>

          {/* Project Code Badge */}
          <div className="inline-block px-5 py-1.5 rounded-lg bg-[#070c18]/90 border border-[#c79646]/30 shadow-inner">
            <span className="text-xl font-bold tracking-wider text-[#d9a84e] font-mono">
              {projectCode}
            </span>
          </div>
        </div>

        {/* Wavy Curve Transition with Gold Border */}
        <div className="relative w-full overflow-hidden leading-none pointer-events-none -mt-1">
          <svg className="relative block w-full h-8" viewBox="0 0 500 60" preserveAspectRatio="none">
            <path d="M0,40 C150,65 350,15 500,40 L500,60 L0,60 Z" fill="#ffffff" />
            <path d="M0,40 C150,65 350,15 500,40" fill="none" stroke="#c79646" strokeWidth="3" />
          </svg>
        </div>

        {/* Modal Body */}
        <div className="bg-white px-6 pb-6 pt-1 text-center flex flex-col items-center space-y-4">
          {/* QR Code Frame */}
          <div className="relative p-3 bg-white border-2 border-[#d9a24a]/70 rounded-3xl shadow-sm inline-block">
            {dataUrl ? (
              <img 
                src={dataUrl} 
                alt="Audit Plan QR Code" 
                className="w-[220px] h-[220px] object-contain rounded-xl"
              />
            ) : (
              <div className="w-[220px] h-[220px] flex items-center justify-center text-slate-400 text-sm">
                Generating QR...
              </div>
            )}
            {/* Center Hanuman Logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 bg-white rounded-xl p-1 shadow-md border border-slate-100 flex items-center justify-center">
                <img 
                  src="/hanuman-logo.png" 
                  alt="Hanuman Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>

          {/* Remarks Text */}
          <p className="text-[11.5px] text-slate-500 font-roboto font-normal leading-tight px-1">
            Scan to access your department Open Meetings.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full pt-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-sm ${
                copied
                  ? "bg-emerald-50 text-emerald-600 border-emerald-300"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link className="w-4 h-4 text-slate-500" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>

            <button
              type="button"
              onClick={handleDownloadQR}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-[#d9a24a] to-[#c58e37] hover:from-[#cb953d] hover:to-[#b6802c] text-white transition-all shadow-md cursor-pointer"
            >
              <Download className="w-4 h-4 text-white" />
              Download QR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

