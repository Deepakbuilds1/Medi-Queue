import React, { useState, useRef, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  UploadCloud, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Building2,
  FileImage,
  Layers,
  X
} from 'lucide-react';
import { 
  uploadClinicLogo, 
  removeClinicLogo, 
  validateLogoFile,
  fileToDataUrl,
  ALLOWED_LOGO_TYPES, 
  MAX_LOGO_FILE_SIZE_BYTES 
} from '../../services/clinicService';
import { getImageKitConfig, ImageKitConfig } from '../../services/imagekitService';
import { Button } from '../shared/Button';

interface ClinicBrandingSectionProps {
  clinicId: string;
  clinicName: string;
  currentLogo?: string;
  isSuperAdminView?: boolean;
  onLogoUpdated?: (newUrl: string) => void;
  onLogoRemoved?: () => void;
}

export const ClinicBrandingSection: React.FC<ClinicBrandingSectionProps> = ({
  clinicId,
  clinicName,
  currentLogo = '',
  isSuperAdminView = false,
  onLogoUpdated,
  onLogoRemoved,
}) => {
  // Staged File state (Pending Save)
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(currentLogo);
  const [isMarkedForRemoval, setIsMarkedForRemoval] = useState<boolean>(false);
  
  // Upload and Action states
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [ikConfig, setIkConfig] = useState<ImageKitConfig | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch ImageKit status
  useEffect(() => {
    getImageKitConfig().then((cfg) => setIkConfig(cfg)).catch(() => {});
  }, []);

  // Sync preview if currentLogo changes externally (e.g. Firestore listener)
  useEffect(() => {
    if (!stagedFile && !isMarkedForRemoval) {
      setPreviewUrl(currentLogo);
    }
  }, [currentLogo, stagedFile, isMarkedForRemoval]);

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    setStatusMessage(null);

    const validation = validateLogoFile(file);
    if (!validation.valid) {
      setStatusMessage({
        type: 'error',
        text: validation.error || 'Invalid file format or size.'
      });
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setStagedFile(file);
      setPreviewUrl(dataUrl);
      setIsMarkedForRemoval(false);
      setStatusMessage({
        type: 'success',
        text: `Selected "${file.name}" (${(file.size / 1024).toFixed(1)} KB). Click "Save Logo Changes" to upload.`
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: 'Failed to process selected image for preview.'
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Stage removal
  const handleStageRemoval = () => {
    setStagedFile(null);
    setPreviewUrl('');
    setIsMarkedForRemoval(true);
    setStatusMessage({
      type: 'success',
      text: 'Logo removal staged. Click "Save Logo Changes" to confirm removal.'
    });
  };

  // Cancel staged changes
  const handleCancelStaged = () => {
    setStagedFile(null);
    setPreviewUrl(currentLogo);
    setIsMarkedForRemoval(false);
    setStatusMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Save changes (Execute Upload or Removal)
  const handleSaveLogo = async () => {
    if (!clinicId) {
      setStatusMessage({ type: 'error', text: 'Missing clinic ID.' });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setStatusMessage(null);

    try {
      if (isMarkedForRemoval) {
        // Execute Removal
        await removeClinicLogo(clinicId);
        setIsMarkedForRemoval(false);
        setPreviewUrl('');
        if (onLogoRemoved) onLogoRemoved();
        setStatusMessage({
          type: 'success',
          text: 'Clinic logo removed successfully. Default branding is now active.'
        });
      } else if (stagedFile) {
        // Execute Upload
        const result = await uploadClinicLogo(clinicId, stagedFile, (progress) => {
          setUploadProgress(progress);
        });
        setStagedFile(null);
        setPreviewUrl(result.logoUrl);
        if (onLogoUpdated) onLogoUpdated(result.logoUrl);
        setStatusMessage({
          type: 'success',
          text: 'Clinic logo uploaded and synchronized across all portals successfully!'
        });
      }
    } catch (err: any) {
      console.error('Logo update failed:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to update clinic logo. Please try again.'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const hasPendingChanges = stagedFile !== null || isMarkedForRemoval;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
      
      {/* Header Banner */}
      <div className="p-5 border-b border-[#E2E8F0] bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 border border-teal-200/80 text-[#087F73] rounded-xl">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[#0F172A]">
                Clinic Branding & Logo
              </h3>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-[#087F73]">
                Multi-Tenant Scoped
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize the logo for <span className="font-semibold text-slate-700">{clinicName}</span>. Appears on Admin dashboards, Patient portal, TV displays, and printed receipts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-[#E2E8F0] shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#087F73]" />
          <span className="font-mono text-[11px] font-semibold">{clinicId}</span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        
        {/* Status Notification */}
        {statusMessage && (
          <div className={`p-4 rounded-xl border text-xs font-semibold flex items-start justify-between gap-3 animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-start gap-2.5">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusMessage.text}</span>
            </div>
            <Button 
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Dismiss message"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Branding Preview & Upload Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Logo Visual Preview Box */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {stagedFile ? 'Preview (Unsaved)' : isMarkedForRemoval ? 'Default Fallback' : 'Current Active Logo'}
            </span>

            <div className="relative group">
              {previewUrl ? (
                <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-xs bg-white flex items-center justify-center p-1">
                  <img 
                    src={previewUrl} 
                    alt={`${clinicName} Logo Preview`} 
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-[#087F73] text-white font-bold text-3xl flex items-center justify-center shadow-xs border-2 border-slate-200">
                  {clinicName ? clinicName.charAt(0).toUpperCase() : 'M'}
                </div>
              )}

              {stagedFile && (
                <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-amber-500 text-white font-bold text-[9px] uppercase rounded-full shadow-xs animate-pulse">
                  Staged
                </span>
              )}
            </div>

            <div>
              <h4 className="font-bold text-xs text-[#0F172A]">
                {clinicName}
              </h4>
              <p className="text-[11px] text-slate-400">
                {previewUrl ? 'Custom clinic brand asset' : 'Standard geometric icon fallback'}
              </p>
            </div>
          </div>

          {/* Upload Dropzone & Controls */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleInputChange}
              accept={ALLOWED_LOGO_TYPES.join(', ')}
              className="hidden"
              disabled={isUploading}
            />

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-2.5 ${
                isDragOver 
                  ? 'border-[#087F73] bg-teal-50/70 scale-[1.01]' 
                  : 'border-slate-300 bg-slate-50/50 hover:border-[#087F73] hover:bg-teal-50/30'
              } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-200 text-[#087F73] flex items-center justify-center">
                <UploadCloud className="w-5 h-5" />
              </div>

              <div>
                <span className="text-xs font-bold text-slate-800">
                  Click to browse or drag & drop logo here
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supported formats: <strong className="text-slate-600">PNG, JPG, JPEG, WEBP</strong> (Max 5MB)
                </p>
              </div>
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="Secondary"
                  size="md"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  leftIcon={<FileImage className="w-3.5 h-3.5 text-[#087F73]" />}
                >
                  {previewUrl ? 'Change Logo' : 'Upload Logo'}
                </Button>

                {(previewUrl || stagedFile) && (
                  <Button
                    type="button"
                    variant="Destructive"
                    size="md"
                    onClick={handleStageRemoval}
                    disabled={isUploading || isMarkedForRemoval}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Remove Logo
                  </Button>
                )}
              </div>

              {/* Pending Changes Save Buttons */}
              {hasPendingChanges && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={handleCancelStaged}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="Primary"
                    size="md"
                    onClick={handleSaveLogo}
                    disabled={isUploading}
                    isLoading={isUploading}
                    leftIcon={!isUploading ? <CheckCircle2 className="w-3.5 h-3.5" /> : undefined}
                  >
                    {isUploading ? `Saving... ${uploadProgress > 0 ? `${uploadProgress}%` : ''}` : 'Save Logo Changes'}
                  </Button>
                </div>
              )}
            </div>

            {/* ImageKit Folder & Storage Hierarchy Info */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5 font-mono">
                <Layers className="w-3.5 h-3.5 text-[#087F73]" />
                <span>ImageKit Folder: <strong className="text-slate-700">/clinics/{clinicId}/logo/</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${ikConfig?.isConfigured ? 'bg-emerald-500' : 'bg-teal-600'}`} />
                <span className="font-semibold text-[10px] uppercase">
                  {ikConfig?.isConfigured ? 'ImageKit Connected' : 'ImageKit Storage'}
                </span>
              </div>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="space-y-1.5 pt-2 animate-in fade-in">
                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                  <span>Uploading logo to ImageKit Media Storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#087F73] transition-all duration-200 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};
