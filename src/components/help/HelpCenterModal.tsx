import React, { useState } from 'react';
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  Mail, 
  Phone, 
  Building2, 
  Monitor, 
  Ticket, 
  Stethoscope, 
  ShieldCheck, 
  X, 
  CheckCircle2, 
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';
import { useAuth } from '../../context/AuthContext';

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FAQItem {
  id: string;
  category: 'patient' | 'staff' | 'display' | 'admin';
  question: string;
  answer: string;
}

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({ isOpen, onClose }) => {
  const { activeClinic, activeClinicId } = useClinic();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'patient' | 'staff' | 'display' | 'admin'>('all');
  const [expandedFaq, setExpandedFaq] = useState<string | null>('p1');

  // Support Form State
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportSubmitted, setSupportSubmitted] = useState(false);

  if (!isOpen) return null;

  const clinicName = activeClinic?.name || 'MediQueue Clinic';
  const clinicEmail = activeClinic?.email || 'support@mediqueue.clinic';
  const clinicPhone = activeClinic?.phone || '+1 (800) 555-0199';

  const faqs: FAQItem[] = [
    {
      id: 'p1',
      category: 'patient',
      question: 'How do I generate a queue token for my doctor visit?',
      answer: 'Navigate to the Patient Portal, select the Book Token tab, choose your attending doctor and consultation room, enter your name and phone number, and click Generate Token. A live ticket with your token number (e.g. A-015) will be generated instantly.'
    },
    {
      id: 'p2',
      category: 'patient',
      question: 'How will I know when it is my turn for consultation?',
      answer: 'Your current queue status updates in real-time on your phone screen in the My Tokens tab. Additionally, the clinic TV display will flash your token number and sound an audible chime and voice callout announcing your room.'
    },
    {
      id: 'p3',
      category: 'patient',
      question: 'Can I cancel my token if I need to leave?',
      answer: 'Yes. In the Patient Portal under My Tokens, click the Cancel Token button on any active waiting token. This frees up the slot for other patients and updates the clinic queue immediately.'
    },
    {
      id: 's1',
      category: 'staff',
      question: 'How do clinic receptionists call the next patient?',
      answer: 'Log in to the Admin Panel and open the Token Queue page. Click the "Call Next" button or click "Call" on any individual token to trigger the TV display announcement and voice synthesizer.'
    },
    {
      id: 's2',
      category: 'staff',
      question: 'What should staff do if a patient does not appear?',
      answer: 'After calling the patient three times without response, click "Skip" to move the token to SKIPPED status. If the patient arrives later, staff can reactivate the token or call them into consultation.'
    },
    {
      id: 'd1',
      category: 'display',
      question: 'How do we launch the TV waiting room public display?',
      answer: 'Open the URL path /display in any browser on the clinic waiting room TV or smart monitor. Click the "Fullscreen" button to enter distraction-free kiosk display mode. Audio announcements will play automatically as tokens are called.'
    },
    {
      id: 'd2',
      category: 'display',
      question: 'Why is audio not playing on the TV display?',
      answer: 'Modern web browsers require a single initial user click to enable autoplay audio. When opening the display on your TV, click anywhere on the screen or toggle the sound button to grant browser audio permissions.'
    },
    {
      id: 'a1',
      category: 'admin',
      question: 'How does Multi-Tenant clinic switching work?',
      answer: 'Super Administrators can manage multiple physical clinics from the Super Admin Console. In the top navigation bar or sidebar, click the Clinic Switcher dropdown to instantly toggle between assigned medical tenants.'
    }
  ];

  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch = 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage) return;
    setSupportSubmitted(true);
    setTimeout(() => {
      setSupportMessage('');
      setSupportSubject('');
      setSupportSubmitted(false);
    }, 4000);
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-center-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[85vh]">
        
        {/* Header */}
        <header className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="help-center-title" className="font-bold text-base text-white">
                MediQueue Support & Knowledge Base
              </h2>
              <p className="text-xs text-slate-400">
                Operating guides, TV display troubleshooting & clinic assistance for {clinicName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Content Body: Search & Category filter */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-800 dark:text-slate-200">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles, token guides, TV display audio setup..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-teal-600 shadow-xs"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Topics' },
              { id: 'patient', label: 'Patient Guide' },
              { id: 'staff', label: 'Staff & Reception' },
              { id: 'display', label: 'TV Waiting Display' },
              { id: 'admin', label: 'Multi-Clinic Admin' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* FAQs Accordion */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Frequently Asked Questions ({filteredFaqs.length})
            </h3>

            {filteredFaqs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 space-y-1">
                <HelpCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-bold text-xs">No matching help articles found</p>
                <p className="text-[11px]">Try adjusting your search keywords or submit an inquiry below.</p>
              </div>
            ) : (
              filteredFaqs.map(faq => {
                const isExpanded = expandedFaq === faq.id;
                return (
                  <div 
                    key={faq.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/60 overflow-hidden shadow-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                      className="w-full p-3.5 text-left font-bold text-slate-900 dark:text-white flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <span>{faq.question}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-teal-600 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 text-slate-600 dark:text-slate-300 text-xs leading-relaxed border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/30">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Contact Support Section */}
          <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-teal-600" />
                  <span>Direct Clinic Support</span>
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Need immediate help with a consultation queue or display setup?
                </p>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-teal-600" />
                  <strong>{clinicPhone}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-teal-600" />
                  <strong>{clinicEmail}</strong>
                </span>
              </div>
            </div>

            {supportSubmitted ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Inquiry submitted to clinic administration. We will reply shortly.</span>
              </div>
            ) : (
              <form onSubmit={handleSupportSubmit} className="space-y-3">
                <input
                  type="text"
                  required
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  placeholder="Subject (e.g. TV display audio issue, token question)"
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
                <textarea
                  required
                  rows={3}
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="Describe your issue or question in detail..."
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-xs"
                >
                  Submit Inquiry
                </button>
              </form>
            )}
          </div>

        </div>

        {/* Footer */}
        <footer className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            Tenant: <strong className="text-slate-600 dark:text-slate-300">{activeClinicId}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Close Support
          </button>
        </footer>

      </div>
    </div>
  );
};
