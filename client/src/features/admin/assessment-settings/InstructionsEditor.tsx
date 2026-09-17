import React from 'react';

interface InstructionsEditorProps {
  instructions: string;
  setInstructions: (val: string) => void;
  rules: string;
  setRules: (val: string) => void;
}

const InstructionsEditor: React.FC<InstructionsEditorProps> = ({ instructions, setInstructions, rules, setRules }) => {
  const loadDefaults = () => {
    setInstructions(`Welcome to the Online Assessment!
Please read all the questions carefully before answering.
Ensure you have a stable internet connection and a quiet environment.
Good luck!`);
    setRules(`1. Ensure your camera and microphone are working properly.
2. Do not switch tabs or minimize the browser window. Doing so will flag your test.
3. Full-screen mode is mandatory. Escaping full-screen will trigger a warning.
4. Use of mobile phones, external materials, or other devices is strictly prohibited.
5. Plagiarism in coding answers will result in immediate disqualification.`);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex justify-end mb-4">
        <button 
          onClick={loadDefaults}
          className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Load Default Templates
        </button>
      </div>
      <div>
        <div className="mb-2">
          <h3 className="text-lg font-bold text-dark">Welcome Instructions</h3>
          <p className="text-sm text-gray-500">This text will be shown to candidates immediately when they open the test link.</p>
        </div>
        <textarea 
          rows={5}
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50"
          placeholder="Welcome to the assessment! Please make sure you have a stable internet connection..."
        />
      </div>

      <div className="pt-6 border-t border-gray-100">
        <div className="mb-2">
          <h3 className="text-lg font-bold text-danger">Strict Rules & Disclaimers</h3>
          <p className="text-sm text-gray-500">These are the strict behavioral rules candidates must explicitly agree to before starting.</p>
        </div>
        <textarea 
          rows={6}
          value={rules || ''}
          onChange={e => setRules(e.target.value)}
          className="w-full px-4 py-3 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-red-50/30"
          placeholder="1. Do not exit full screen mode.&#10;2. Do not look away from the camera.&#10;3. External IDEs are strictly prohibited."
        />
      </div>
    </div>
  );
};

export default InstructionsEditor;
