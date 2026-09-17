import React from 'react';

interface GeneralSettingsProps {
  title: string;
  setTitle: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ title, setTitle, description, setDescription }) => {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Assessment Title *</label>
        <input 
          type="text" 
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg font-medium"
          placeholder="e.g. Senior Backend Engineer - Node.js"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
        <textarea 
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Brief summary of the assessment purpose..."
        />
      </div>
    </div>
  );
};

export default GeneralSettings;
