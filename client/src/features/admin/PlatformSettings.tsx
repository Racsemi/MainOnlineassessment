import React, { useState, useEffect } from 'react';
import { Loader2, Save, Settings, FileText, FormInput, Sliders, CheckCircle2 } from 'lucide-react';
import api from '../../lib/axios';

import InstructionsEditor from './assessment-settings/InstructionsEditor';
import RegistrationFormBuilder, { type FormField } from './assessment-settings/RegistrationFormBuilder';
import FeatureToggles, { type AssessmentFeatures } from './assessment-settings/FeatureToggles';

const tabs = [
  { id: 'INSTRUCTIONS', label: 'Instructions & Rules', icon: FileText },
  { id: 'FORM',         label: 'Registration Form',   icon: FormInput },
  { id: 'FEATURES',     label: 'Feature Toggles',     icon: Sliders },
] as const;

type Tab = typeof tabs[number]['id'];

const PlatformSettings = () => {
  const [activeTab, setActiveTab] = useState<Tab>('INSTRUCTIONS');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const [instructions, setInstructions] = useState('');
  const [rules, setRules]               = useState('');
  const [registrationForm, setRegistrationForm] = useState<FormField[]>([]);
  const [features, setFeatures] = useState<AssessmentFeatures>({
    calculator: false, ide: false, copyPaste: false,
    tabTracking: true, rightClick: false, keyboardShortcuts: false
  });
  const [isProctored, setIsProctored] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        const data = res.data;
        if (data) {
          setInstructions(data.instructions || '');
          setRules(data.rules || '');
          if (data.registrationForm) setRegistrationForm(data.registrationForm);
          if (data.features) {
            setFeatures(f => ({ ...f, ...data.features }));
            if (data.features.isProctored !== undefined) setIsProctored(data.features.isProctored);
          }
        }
      } catch (err) {
        console.error('Failed to fetch settings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', { instructions, rules, registrationForm, features: { ...features, isProctored } });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-slate-400 text-sm">Loading settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in-up">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center space-x-3">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #8b5cf6)' }}>
              <Settings size={18} className="text-white" />
            </span>
            <span>Platform Settings</span>
          </h1>
          <p className="page-subtitle ml-12">Configure default rules, registration forms, and features for all assessments.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center space-x-2 font-semibold rounded-xl px-5 py-2.5 text-sm transition-all duration-300 ${
            saved
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'btn-primary'
          } disabled:opacity-50`}
        >
          {saving
            ? <Loader2 size={16} className="animate-spin" />
            : saved
            ? <CheckCircle2 size={16} />
            : <Save size={16} />
          }
          <span>{saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 pb-20">

        {/* Vertical Tab Nav */}
        <div className="w-full md:w-56 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'text-indigo-700 border border-indigo-200'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent'
                  }`}
                  style={isActive ? { background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)' } : {}}
                >
                  <Icon size={16} className={isActive ? 'text-primary' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'INSTRUCTIONS' && (
            <div className="card p-8">
              <h2 className="text-lg font-bold text-dark mb-1">Instructions & Rules</h2>
              <p className="text-sm text-slate-500 mb-6">These are displayed to candidates before they start the assessment.</p>
              <InstructionsEditor instructions={instructions} setInstructions={setInstructions} rules={rules} setRules={setRules} />
            </div>
          )}
          {activeTab === 'FORM' && (
            <div className="card p-8">
              <h2 className="text-lg font-bold text-dark mb-1">Registration Form</h2>
              <p className="text-sm text-slate-500 mb-6">Define the fields candidates must fill in before taking the assessment.</p>
              <RegistrationFormBuilder fields={registrationForm} setFields={setRegistrationForm} />
            </div>
          )}
          {activeTab === 'FEATURES' && (
            <div className="card p-8">
              <h2 className="text-lg font-bold text-dark mb-1">Environment Features</h2>
              <p className="text-sm text-slate-500 mb-6">Control what candidates can do during the assessment.</p>
              <FeatureToggles isProctored={isProctored} setIsProctored={setIsProctored} features={features} setFeatures={setFeatures} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlatformSettings;
