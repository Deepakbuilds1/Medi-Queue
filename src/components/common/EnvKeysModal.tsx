import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, Save, CheckCircle2, ShieldAlert, X, RefreshCw } from 'lucide-react';

interface EnvVarItem {
  key: string;
  value: string;
  description?: string;
  isSecret?: boolean;
}

interface EnvKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'mediqueue_custom_env_vars';

export const EnvKeysModal: React.FC<EnvKeysModalProps> = ({ isOpen, onClose }) => {
  const [envVars, setEnvVars] = useState<EnvVarItem[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showValues, setShowValues] = useState<{ [key: string]: boolean }>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Load initial stored variables or defaults
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setEnvVars(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading stored env vars', e);
      }
    } else {
      // Default initial templates matching .env.example
      const defaults: EnvVarItem[] = [
        {
          key: 'GEMINI_API_KEY',
          value: (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || '',
          description: 'Used for AI automated triage and smart queue analytics.',
          isSecret: true,
        },
        {
          key: 'APP_URL',
          value: (typeof process !== 'undefined' && process.env && process.env.APP_URL) || window.location.origin,
          description: 'Hosting App URL for public share and webhooks.',
          isSecret: false,
        },
        {
          key: 'VITE_CLINIC_API_KEY',
          value: '',
          description: 'Custom client-side integration secret key.',
          isSecret: true,
        }
      ];
      setEnvVars(defaults);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    }
  }, []);

  if (!isOpen) return null;

  const handleToggleValue = (keyName: string) => {
    setShowValues(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const handleUpdateValue = (keyName: string, value: string) => {
    setEnvVars(prev => prev.map(item => item.key === keyName ? { ...item, value } : item));
  };

  const handleAddVar = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!cleanKey) return;

    if (envVars.some(item => item.key === cleanKey)) {
      alert(`Variable key ${cleanKey} already exists.`);
      return;
    }

    const newItem: EnvVarItem = {
      key: cleanKey,
      value: newValue.trim(),
      description: newDesc.trim() || 'Custom Environment Variable Key',
      isSecret: true,
    };

    const updated = [...envVars, newItem];
    setEnvVars(updated);
    setNewKey('');
    setNewValue('');
    setNewDesc('');
  };

  const handleDeleteVar = (keyName: string) => {
    const updated = envVars.filter(item => item.key !== keyName);
    setEnvVars(updated);
  };

  const handleSaveAll = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envVars));
    // Also attach to window runtime object if applicable
    if (typeof window !== 'undefined') {
      (window as any).__APP_ENV_KEYS__ = envVars.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {} as Record<string, string>);
    }

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  const resetDefaults = () => {
    const defaults: EnvVarItem[] = [
      {
        key: 'GEMINI_API_KEY',
        value: (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || '',
        description: 'Used for AI automated triage and smart queue analytics.',
        isSecret: true,
      },
      {
        key: 'APP_URL',
        value: (typeof process !== 'undefined' && process.env && process.env.APP_URL) || window.location.origin,
        description: 'Hosting App URL for public share and webhooks.',
        isSecret: false,
      },
      {
        key: 'VITE_CLINIC_API_KEY',
        value: '',
        description: 'Custom client-side integration secret key.',
        isSecret: true,
      }
    ];
    setEnvVars(defaults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">Manual Environment Variable Keys Manager</h3>
              <p className="text-xs text-slate-400">Configure and input secret API keys and environment variables</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200 text-xs">
          
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              Environment variables updated successfully!
            </div>
          )}

          {/* Quick Notice */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 rounded-xl leading-relaxed flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">Key Management & Runtime Injection</p>
              <p className="text-[11px] opacity-90">
                Variables set here are saved locally and mapped to <code className="font-mono text-amber-600 dark:text-amber-300">process.env</code> / client runtime context. For production deployments, variables declared in <code className="font-mono text-amber-600 dark:text-amber-300">.env.example</code> can also be entered in AI Studio Settings.
              </p>
            </div>
          </div>

          {/* Existing Variables List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                Active Variable Keys ({envVars.length})
              </h4>
              <button 
                onClick={resetDefaults}
                className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Reset Defaults
              </button>
            </div>

            <div className="space-y-2.5">
              {envVars.map((item) => {
                const isShowing = showValues[item.key];
                return (
                  <div key={item.key} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 text-xs">
                          {item.key}
                        </span>
                        {item.isSecret && (
                          <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                            SECRET
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteVar(item.key)}
                        title="Delete key"
                        className="text-slate-400 hover:text-red-500 p-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type={isShowing || !item.isSecret ? "text" : "password"}
                        value={item.value}
                        onChange={(e) => handleUpdateValue(item.key, e.target.value)}
                        placeholder={`Enter value for ${item.key}...`}
                        className="w-full pr-10 pl-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                      {item.isSecret && (
                        <button
                          type="button"
                          onClick={() => handleToggleValue(item.key)}
                          className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                        >
                          {isShowing ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>

                    {item.description && (
                      <p className="text-[10px] text-slate-400 italic">
                        {item.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add New Key Form */}
          <form onSubmit={handleAddVar} className="p-3.5 bg-slate-100 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-500" />
              Add Custom Environment Variable Key
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Key Name *</label>
                <input
                  type="text"
                  required
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. STRIPE_API_KEY"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs uppercase"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Key Value</label>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Enter key secret value..."
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description (Optional)</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Short description of this environment variable..."
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>

            <button
              type="submit"
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              Add Key Variable
            </button>
          </form>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <p className="text-[10px] text-slate-400 font-mono">
            Key changes update runtime environment
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Save Environment Keys
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
