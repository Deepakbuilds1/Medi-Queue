import React, { useState } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  AlertTriangle, 
  Cookie, 
  Accessibility, 
  Lock, 
  BookOpen, 
  X, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  Printer,
  HeartPulse,
  Ban,
  PhoneCall,
  Clock,
  Building2,
  SlidersHorizontal
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';

export type LegalDocType = 
  | 'privacy' 
  | 'terms' 
  | 'disclaimer' 
  | 'cookies' 
  | 'accessibility' 
  | 'security' 
  | 'disclosure' 
  | 'dpa' 
  | 'acceptable-use' 
  | 'cancellation';

interface LegalPagesModalProps {
  isOpen: boolean;
  initialDoc?: LegalDocType;
  onClose: () => void;
  onOpenCookiePreferences?: () => void;
}

export const LegalPagesModal: React.FC<LegalPagesModalProps> = ({
  isOpen,
  initialDoc = 'privacy',
  onClose,
  onOpenCookiePreferences
}) => {
  const { activeClinic, activeClinicId } = useClinic();
  const [activeDoc, setActiveDoc] = useState<LegalDocType>(initialDoc);

  // Sync initialDoc when modal is triggered
  React.useEffect(() => {
    if (isOpen && initialDoc) {
      setActiveDoc(initialDoc);
    }
  }, [isOpen, initialDoc]);

  if (!isOpen) return null;

  const clinicName = activeClinic?.name || 'MediQueue Clinic';
  const clinicEmail = activeClinic?.email || 'support@mediqueue.clinic';
  const clinicPhone = activeClinic?.phone || '+1 (800) 555-0199';
  const clinicAddress = activeClinic?.address || '100 Medical Center Parkway, Suite 400';

  const docList = [
    { id: 'privacy' as LegalDocType, label: 'Privacy Policy', icon: ShieldCheck },
    { id: 'terms' as LegalDocType, label: 'Terms of Service', icon: FileText },
    { id: 'disclaimer' as LegalDocType, label: 'Medical & Queue Disclaimer', icon: AlertTriangle, highlight: true },
    { id: 'cancellation' as LegalDocType, label: 'Cancellation & No-Show Policy', icon: Clock },
    { id: 'cookies' as LegalDocType, label: 'Cookie & Storage Policy', icon: Cookie },
    { id: 'accessibility' as LegalDocType, label: 'Accessibility Statement', icon: Accessibility },
    { id: 'security' as LegalDocType, label: 'Security & Architecture', icon: Lock },
    { id: 'acceptable-use' as LegalDocType, label: 'Acceptable Use Policy', icon: Ban },
    { id: 'dpa' as LegalDocType, label: 'Data Processing Terms (DPA)', icon: Building2 },
    { id: 'disclosure' as LegalDocType, label: 'Responsible Disclosure', icon: BookOpen },
  ];

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[90vh]">
        
        {/* Modal Header */}
        <header className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 text-teal-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 id="legal-modal-title" className="font-extrabold text-base tracking-tight text-white">
                Legal Documentation & Regulatory Disclosures
              </h2>
              <p className="text-xs text-slate-400">
                Operating standards for {clinicName} • Tenant: {activeClinicId}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              aria-label="Print document"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Print document"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close legal modal"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Modal Body: Two Column (Sidebar navigation + Document content) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950">
          
          {/* Sidebar */}
          <nav 
            aria-label="Legal Document Selection"
            className="w-full md:w-64 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-3 space-y-1 overflow-y-auto shrink-0"
          >
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1.5">
              Available Documents
            </div>

            {docList.map(doc => {
              const Icon = doc.icon;
              const isActive = activeDoc === doc.id;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setActiveDoc(doc.id)}
                  className={`w-full p-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-teal-700 text-white font-bold shadow-xs'
                      : doc.highlight
                        ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : doc.highlight ? 'text-amber-500' : 'text-slate-400'}`} />
                    <span className="truncate">{doc.label}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-300'}`} />
                </button>
              );
            })}

            {onOpenCookiePreferences && (
              <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCookiePreferences();
                  }}
                  className="w-full p-2.5 rounded-xl text-left text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors flex items-center gap-2"
                >
                  <SlidersHorizontal className="w-4 h-4 text-teal-600" />
                  <span>Manage Cookie Preferences</span>
                </button>
              </div>
            )}
          </nav>

          {/* Document Content Area */}
          <main 
            tabIndex={0}
            className="flex-1 p-6 md:p-8 overflow-y-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 space-y-6 focus:outline-none"
          >
            
            {/* 1. PRIVACY POLICY */}
            {activeDoc === 'privacy' && (
              <article className="space-y-5 max-w-3xl">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">
                    DATA PROTECTION INVENTORY & PRIVACY
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    Privacy Policy
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Effective Date: Current Production Version • Last Reviewed: August 2026
                  </p>
                </div>

                <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl text-xs text-teal-900 dark:text-teal-200 space-y-1">
                  <p className="font-bold">Summary of Patient Data Collection:</p>
                  <p>
                    {clinicName} utilizes MediQueue strictly for organizing queue tokens and managing clinic waiting rooms. We collect only the minimum required information to generate your queue ticket and facilitate patient consultations.
                  </p>
                </div>

                <section className="space-y-3 text-xs leading-relaxed">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">1. Information We Collect</h4>
                  <p>When you book a token or register at {clinicName}, the following data points are created and stored:</p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li><strong>Patient Identification:</strong> Full name, age, gender, and contact phone number.</li>
                    <li><strong>Consultation Queue Details:</strong> Assigned doctor name, room number, token number (e.g. A-012), visit reason, and queue creation timestamp.</li>
                    <li><strong>Account Credentials:</strong> Email address and hashed authentication credentials managed via Google Firebase Authentication.</li>
                    <li><strong>Operational Logs:</strong> Timestamps of token calls, consultation start times, completion times, and status transitions (WAITING, CALLED, IN CONSULTATION, COMPLETED, CANCELLED).</li>
                  </ul>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">2. How Your Data Is Stored & Isolated</h4>
                  <p>
                    All patient data is stored in isolated multi-tenant Cloud Firestore database collections partitioned by clinic tenant ID (<code>/clinics/{activeClinicId}/tokens</code> and <code>/clinics/{activeClinicId}/patients</code>). 
                    Data access is governed by strict server-side Firestore security rules that prevent cross-clinic data leakage.
                  </p>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">3. Third-Party Processors & Infrastructure</h4>
                  <p>
                    MediQueue relies exclusively on Google Cloud Platform and Firebase infrastructure for authentication, database storage, and hosting. No patient data is sold, rented, or shared with third-party advertisers or data brokers.
                  </p>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">4. Your Privacy Rights & Data Portability</h4>
                  <p>
                    You have the right to inspect your queue history, download a copy of your patient profile in machine-readable JSON format, or request account deletion. To exercise these rights, navigate to <strong>Account Settings</strong> in your patient dashboard or contact the clinic administration at <a href={`mailto:${clinicEmail}`} className="text-teal-600 font-bold underline">{clinicEmail}</a>.
                  </p>
                </section>
              </article>
            )}

            {/* 2. TERMS OF SERVICE */}
            {activeDoc === 'terms' && (
              <article className="space-y-5 max-w-3xl">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">
                    USER AGREEMENT
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    Terms of Service
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Applicable to all Patients, Clinic Staff, and Visitors of {clinicName}
                  </p>
                </div>

                <section className="space-y-3 text-xs leading-relaxed">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">1. Service Description</h4>
                  <p>
                    MediQueue provides real-time digital queue management, appointment token generation, and waiting room status displays for healthcare clinics. By generating a token or accessing the portal, you agree to comply with these terms.
                  </p>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">2. Token Issuance & Queue Discipline</h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>Tokens are valid exclusively for the date of issue during clinic operating hours.</li>
                    <li>Tokens are non-transferable and must correspond to the patient receiving consultation.</li>
                    <li>Estimated wait times and queue positions are dynamic and may adjust based on medical urgency or consultation duration.</li>
                    <li>Patients called for consultation must present themselves to the assigned consultation room promptly. Tokens not claimed after multiple calls may be marked as SKIPPED or CANCELLED.</li>
                  </ul>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">3. User Conduct & Abuse Prevention</h4>
                  <p>
                    Users must provide accurate contact information. Generating spam tokens, attempting to bypass queue order through automated scripts, or attempting unauthorized access to clinic administration panels is strictly prohibited and results in immediate IP blocking and account termination.
                  </p>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">4. Service Availability</h4>
                  <p>
                    While {clinicName} strives for continuous availability, system updates or internet disruptions may occasionally affect real-time sync. In such cases, clinic receptionists maintain physical manual queue logs.
                  </p>
                </section>
              </article>
            )}

            {/* 3. MEDICAL DISCLAIMER */}
            {activeDoc === 'disclaimer' && (
              <article className="space-y-5 max-w-3xl">
                <div className="border-b border-amber-200 dark:border-amber-800/60 pb-4">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-extrabold text-[10px] uppercase tracking-widest">
                    <AlertTriangle className="w-4 h-4" />
                    CRITICAL REGULATORY & EMERGENCY NOTICE
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    Medical & Queue System Disclaimer
                  </h3>
                </div>

                <div className="p-5 bg-red-50 dark:bg-red-950/50 border-2 border-red-500 rounded-2xl text-red-900 dark:text-red-200 space-y-3">
                  <div className="flex items-center gap-2 font-black text-base text-red-700 dark:text-red-400">
                    <HeartPulse className="w-6 h-6 animate-pulse text-red-600" />
                    <span>EMERGENCY MEDICAL NOTICE</span>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed">
                    MediQueue is strictly an operational queue management and scheduling software. <strong>IT IS NOT AN EMERGENCY DISPATCH SYSTEM, TRIAGE TOOL, OR MEDICAL DIAGNOSTIC SERVICE.</strong>
                  </p>
                  <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-xl text-xs font-bold flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-red-700 shrink-0" />
                    <span>If you are experiencing chest pain, severe bleeding, difficulty breathing, or any life-threatening emergency, IMMEDIATELY call 911 / 112 or proceed to the nearest emergency department.</span>
                  </div>
                </div>

                <section className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">1. No Medical Advice Provided</h4>
                  <p>
                    Information displayed in this application—including doctor specialties, room numbers, visit reasons, and wait times—does not constitute medical advice, diagnosis, or treatment recommendations. Always seek the advice of your qualified physician.
                  </p>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">2. Queue Position Is Not Clinical Triage</h4>
                  <p>
                    Queue order is organized sequentially for general clinic consultations. In clinical practice, attending physicians and healthcare providers reserve the right to prioritize urgent medical cases ahead of general sequential queue order.
                  </p>
                </section>
              </article>
            )}

            {/* 4. CANCELLATION & NO-SHOW POLICY */}
            {activeDoc === 'cancellation' && (
              <article className="space-y-5 max-w-3xl">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">
                    QUEUE APPOINTMENT RULES
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    Token Cancellation & No-Show Policy
                  </h3>
                </div>

                <section className="space-y-3 text-xs leading-relaxed">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">1. Patient-Initiated Cancellations</h4>
                  <p>
                    If you are unable to attend your consultation, you can cancel your booked queue token directly through the <strong>My Tokens</strong> tab in the Patient Portal before your number is called. This frees up the consultation slot for waiting patients.
                  </p>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">2. No-Show & Missed Call Rules</h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>When your token number is broadcast on the TV Display and audio announcement, you have <strong>5 minutes</strong> to present yourself at the doctor's room.</li>
                    <li>If you do not appear after three consecutive call attempts, your token status will be transitioned to <strong>SKIPPED</strong>.</li>
                    <li>Skipped tokens can be reactivated once by informing the reception desk within 30 minutes of the missed call.</li>
                  </ul>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">3. End-of-Day Automatic Expiry</h4>
                  <p>
                    All unresolved queue tokens (WAITING or SKIPPED) automatically expire at the conclusion of clinic operating hours each day and do not carry over to subsequent days.
                  </p>
                </section>
              </article>
            )}

            {/* 5. COOKIES & LOCAL STORAGE */}
            {activeDoc === 'cookies' && (
              <article className="space-y-5 max-w-3xl">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">
                    STORAGE DISCLOSURE
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    Cookie & Local Storage Policy
                  </h3>
                </div>

                <section className="space-y-3 text-xs leading-relaxed">
                  <p>
                    MediQueue uses essential browser storage mechanisms to maintain session state, active clinic preferences, and security authentication tokens. We do not employ third-party tracking or advertising cookies.
                  </p>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">Detailed Storage Inventory:</h4>
                  
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                        <tr>
                          <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Storage Key / Technology</th>
                          <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Type</th>
                          <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Purpose</th>
                          <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Lifespan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                        <tr>
                          <td className="p-2.5 font-bold text-teal-700 dark:text-teal-400">mediqueue_active_clinic_id</td>
                          <td className="p-2.5">localStorage</td>
                          <td className="p-2.5 font-sans">Remembers the active medical clinic tenant selected by the user.</td>
                          <td className="p-2.5 font-sans">Persistent</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-indigo-700 dark:text-indigo-400">mediqueue_super_admin_session</td>
                          <td className="p-2.5">sessionStorage</td>
                          <td className="p-2.5 font-sans">Holds the verified cryptographically random Super Admin session token.</td>
                          <td className="p-2.5 font-sans">Browser tab session</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-300">firebase:authUser:*</td>
                          <td className="p-2.5">IndexedDB</td>
                          <td className="p-2.5 font-sans">Maintains secure JWT token for Firebase Authentication.</td>
                          <td className="p-2.5 font-sans">Session / Refresh</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-300">mediqueue_cookie_preferences</td>
                          <td className="p-2.5">localStorage</td>
                          <td className="p-2.5 font-sans">Records user consent choices for sound alerts and theme preferences.</td>
                          <td className="p-2.5 font-sans">1 Year</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </article>
            )}

            {/* 6. ACCESSIBILITY STATEMENT */}
            {activeDoc === 'accessibility' && (
              <article className="space-y-5 max-w-3xl">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">
                    INCLUSION & USABILITY
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    Accessibility Statement
                  </h3>
                </div>

                <section className="space-y-3 text-xs leading-relaxed">
                  <p>
                    {clinicName} is committed to making its digital patient portal, TV waiting room displays, and administration tools accessible to all individuals, including people with disabilities, following <strong>WCAG 2.1 Level AA</strong> guidelines.
                  </p>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">Accessibility Features Implemented:</h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li><strong>Audio & Visual Call Notifications:</strong> Real-time chime and spoken voice synthesis accompany on-screen visual token callouts for individuals with visual or auditory impairments.</li>
                    <li><strong>High Contrast & Large Typography:</strong> TV waiting room display utilizes large, high-contrast monospace numbering visible from across waiting areas.</li>
                    <li><strong>Full Keyboard Navigability:</strong> All form controls, modals, and tab navigation support standard keyboard navigation (Tab, Enter, Escape, Arrow keys) with visible focus rings.</li>
                    <li><strong>ARIA Semantics:</strong> Dialogs, status alerts, live queue updates, and form errors declare appropriate ARIA roles (<code>role="dialog"</code>, <code>aria-live="polite"</code>, <code>aria-invalid</code>).</li>
                  </ul>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">Feedback & Assistance:</h4>
                  <p>
                    If you encounter any accessibility barriers while using MediQueue, please contact our support team at <a href={`mailto:${clinicEmail}`} className="text-teal-600 font-bold underline">{clinicEmail}</a> or phone {clinicPhone}.
                  </p>
                </section>
              </article>
            )}

            {/* 7. SECURITY & ARCHITECTURE */}
            {activeDoc === 'security' && (
              <article className="space-y-5 max-w-3xl">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">
                    SYSTEM HARDENING & INTEGRITY
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    Security Policy & Architecture
                  </h3>
                </div>

                <section className="space-y-3 text-xs leading-relaxed">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">1. Multi-Tenant Role-Based Access Control (RBAC)</h4>
                  <p>
                    MediQueue strictly enforces multi-tenant data boundaries. System access is compartmentalized into discrete roles: <code>SUPER_ADMIN</code>, <code>CLINIC_ADMIN</code>, <code>DOCTOR</code>, <code>RECEPTIONIST</code>, and <code>PATIENT</code>. Patient accounts are cryptographically restricted from accessing administration dashboards or querying patient directories.
                  </p>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">2. Server-Side Protection & Rate Limiting</h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li><strong>Timing-Safe Evaluation:</strong> Super Admin PIN checks execute server-side using <code>crypto.timingSafeEqual</code> to prevent side-channel timing attacks.</li>
                    <li><strong>Anti-Brute Force Lockout:</strong> IP addresses attempting more than 5 consecutive invalid administrative logins are automatically locked out for 15 minutes.</li>
                    <li><strong>Audit Logging:</strong> All administrative logins, clinic creations, role modifications, and status toggles are recorded to an immutable <code>auditLogs</code> Firestore collection.</li>
                  </ul>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">3. Encryption & Data in Transit</h4>
                  <p>
                    All web traffic is forced over HTTPS using modern TLS 1.3 encryption. Database connections between clients, servers, and Cloud Firestore are encrypted in transit and at rest using Google-managed AES-256 keys.
                  </p>
                </section>
              </article>
            )}

            {/* 8. ACCEPTABLE USE POLICY */}
            {activeDoc === 'acceptable-use' && (
              <article className="space-y-5 max-w-3xl">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">
                    RULES OF ENGAGEMENT
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    Acceptable Use Policy
                  </h3>
                </div>

                <section className="space-y-3 text-xs leading-relaxed">
                  <p>
                    This policy governs acceptable behavior when utilizing the MediQueue platform. Failure to adhere to these terms may result in account termination and legal reporting.
                  </p>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">Prohibited Actions:</h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>Booking phantom or fake queue tokens without legitimate consultation intent.</li>
                    <li>Using automated bots, scrapers, or scripts to manipulate queue numbers or extract patient lists.</li>
                    <li>Attempting SQL injection, XSS payload submission, or vulnerability fuzzing against production endpoints without explicit authorization.</li>
                    <li>Impersonating medical doctors, clinic administrators, or other patients.</li>
                  </ul>
                </section>
              </article>
            )}

            {/* 9. DATA PROCESSING TERMS */}
            {activeDoc === 'dpa' && (
              <article className="space-y-5 max-w-3xl">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">
                    ENTERPRISE CLINIC TERMS
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    Data Processing Agreement (DPA)
                  </h3>
                </div>

                <section className="space-y-3 text-xs leading-relaxed">
                  <p>
                    These Data Processing Terms apply to clinic operators deploying MediQueue multi-tenant instances.
                  </p>
                  <p>
                    <strong>Controller vs. Processor Roles:</strong> The subscribing medical clinic operates as the <strong>Data Controller</strong> determining the purposes and clinical procedures for patient consultations. MediQueue operates as the <strong>Data Processor</strong> storing and processing queue tokens strictly on behalf of the clinic.
                  </p>
                  <p>
                    <strong>Sub-processors:</strong> MediQueue engages Google Cloud Platform and Firebase (Google LLC) as core hosting and database sub-processors adhering to SOC 2, ISO 27001, and cloud security frameworks.
                  </p>
                </section>
              </article>
            )}

            {/* 10. RESPONSIBLE DISCLOSURE */}
            {activeDoc === 'disclosure' && (
              <article className="space-y-5 max-w-3xl">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">
                    VULNERABILITY REPORTING
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    Responsible Vulnerability Disclosure
                  </h3>
                </div>

                <section className="space-y-3 text-xs leading-relaxed">
                  <p>
                    We welcome reports from external security researchers to maintain the security of our clinic management platform.
                  </p>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white pt-2">Reporting Process:</h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>Submit details of findings to <a href={`mailto:${clinicEmail}`} className="text-teal-600 font-bold underline">{clinicEmail}</a> with subject line <code>[SECURITY VULNERABILITY] MediQueue</code>.</li>
                    <li>Provide reproduction steps and technical proof of concept without altering or deleting patient data.</li>
                    <li>Allow our engineering team 5 business days to review and remediate before public disclosure.</li>
                  </ul>
                </section>
              </article>
            )}

            {/* Document Footer */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
              <span>{clinicName} • {clinicAddress}</span>
              <span>Need legal assistance? Contact <a href={`mailto:${clinicEmail}`} className="text-teal-600 underline font-semibold">{clinicEmail}</a></span>
            </div>

          </main>
        </div>

        {/* Modal Bottom Actions */}
        <footer className="px-6 py-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Viewing: <span className="font-bold text-slate-800 dark:text-slate-200">{docList.find(d => d.id === activeDoc)?.label}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Close Document
          </button>
        </footer>

      </div>
    </div>
  );
};
