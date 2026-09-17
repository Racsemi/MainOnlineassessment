import React from 'react';
import { ShieldAlert, Calculator, Code, Keyboard, Copy, MousePointer2 } from 'lucide-react';

export interface AssessmentFeatures {
  calculator: boolean;
  ide: boolean;
  copyPaste: boolean;
  tabTracking: boolean;
  rightClick: boolean;
  keyboardShortcuts: boolean;
}

interface FeatureTogglesProps {
  isProctored: boolean;
  setIsProctored: (val: boolean) => void;
  features: AssessmentFeatures;
  setFeatures: (val: AssessmentFeatures) => void;
}

const FeatureToggles: React.FC<FeatureTogglesProps> = ({ isProctored, setIsProctored, features, setFeatures }) => {
  const toggleFeature = (key: keyof AssessmentFeatures) => {
    setFeatures({ ...features, [key]: !features[key] });
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="bg-warning/10 border border-warning/20 p-6 rounded-2xl flex justify-between items-center shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-warning-dark flex items-center"><ShieldAlert size={24} className="mr-2" /> Core Proctoring Module</h3>
          <p className="text-sm text-yellow-800 mt-2 max-w-lg">
            Enforces full-screen mode, adds blur overlays on exit, and periodically captures webcam snapshots to be reviewed in the integrity reports.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={isProctored} onChange={e => setIsProctored(e.target.checked)} />
          <div className="w-16 h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      <div>
        <h3 className="text-lg font-bold text-dark mb-4">Candidate Environment Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Calculator size={20} /></div>
              <div>
                <p className="font-bold text-dark text-sm">On-Screen Calculator</p>
                <p className="text-xs text-gray-500">Allow candidates to use a basic calculator widget.</p>
              </div>
            </div>
            <input type="checkbox" checked={features.calculator} onChange={() => toggleFeature('calculator')} className="w-5 h-5 text-primary rounded border-gray-300" />
          </div>

          <div className="border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Code size={20} /></div>
              <div>
                <p className="font-bold text-dark text-sm">External IDE Access</p>
                <p className="text-xs text-gray-500">Allow using external code editors (disables some tracking).</p>
              </div>
            </div>
            <input type="checkbox" checked={features.ide} onChange={() => toggleFeature('ide')} className="w-5 h-5 text-primary rounded border-gray-300" />
          </div>
          
          <div className="border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Copy size={20} /></div>
              <div>
                <p className="font-bold text-dark text-sm">Copy / Paste</p>
                <p className="text-xs text-gray-500">Enable clipboard actions inside the assessment window.</p>
              </div>
            </div>
            <input type="checkbox" checked={features.copyPaste} onChange={() => toggleFeature('copyPaste')} className="w-5 h-5 text-primary rounded border-gray-300" />
          </div>

          <div className="border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg"><MousePointer2 size={20} /></div>
              <div>
                <p className="font-bold text-dark text-sm">Right-Click Context Menu</p>
                <p className="text-xs text-gray-500">Allow right-clicking on the assessment page.</p>
              </div>
            </div>
            <input type="checkbox" checked={features.rightClick} onChange={() => toggleFeature('rightClick')} className="w-5 h-5 text-primary rounded border-gray-300" />
          </div>

          <div className="border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg"><ShieldAlert size={20} /></div>
              <div>
                <p className="font-bold text-dark text-sm">Tab Tracking & Strict Focus</p>
                <p className="text-xs text-gray-500">Flag candidate when they switch tabs or minimize window.</p>
              </div>
            </div>
            <input type="checkbox" checked={features.tabTracking} onChange={() => toggleFeature('tabTracking')} className="w-5 h-5 text-primary rounded border-gray-300" />
          </div>

          <div className="border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Keyboard size={20} /></div>
              <div>
                <p className="font-bold text-dark text-sm">Keyboard Shortcuts</p>
                <p className="text-xs text-gray-500">Allow keyboard shortcuts during the assessment.</p>
              </div>
            </div>
            <input type="checkbox" checked={features.keyboardShortcuts} onChange={() => toggleFeature('keyboardShortcuts')} className="w-5 h-5 text-primary rounded border-gray-300" />
          </div>

        </div>
      </div>
    </div>
  );
};

export default FeatureToggles;
