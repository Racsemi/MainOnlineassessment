import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Loader2, Plus, Trash2 } from 'lucide-react';
import api from '../../lib/axios';

const QuestionEditor = () => {
  const navigate = useNavigate();
  const [type, setType] = useState('SINGLE_CHOICE');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('General');
  const [marks, setMarks] = useState(1);
  const [difficulty, setDifficulty] = useState('Medium');
  const [saving, setSaving] = useState(false);

  // MCQ State
  const [options, setOptions] = useState([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false }
  ]);
  const [expectedAnswer, setExpectedAnswer] = useState('');
  const [tolerance, setTolerance] = useState(0);

  // Coding State
  const [codingTitle, setCodingTitle] = useState('');
  const [codingDesc, setCodingDesc] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [constraints, setConstraints] = useState('');
  const [timeLimit, setTimeLimit] = useState(2000);
  const [memoryLimit, setMemoryLimit] = useState(256);
  const [allowedLanguages, setAllowedLanguages] = useState(['PYTHON', 'JAVA', 'CPP', 'JS']);
  const [testCases, setTestCases] = useState([
    { input: '', expectedOutput: '', isHidden: false }
  ]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (type === 'CODING') {
        await api.post('/questions/coding', {
          title: codingTitle,
          description: codingDesc,
          inputFormat,
          outputFormat,
          constraints,
          marks: Number(marks),
          timeLimit: Number(timeLimit),
          memoryLimit: Number(memoryLimit),
          allowedLanguages,
          testCases
        });
      } else {
        await api.post('/questions/mcq', {
          text,
          type,
          category,
          difficulty,
          marks: Number(marks),
          options: (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') ? options : [],
          expectedAnswer,
          tolerance: Number(tolerance)
        });
      }
      navigate('/admin/questions');
    } catch (err) {
      console.error(err);
      alert('Failed to save question.');
    } finally {
      setSaving(false);
    }
  };

  const addTestCase = () => {
    setTestCases([...testCases, { input: '', expectedOutput: '', isHidden: false }]);
  };

  const updateTestCase = (index: number, field: string, value: any) => {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    setTestCases(updated);
  };

  const removeTestCase = (index: number) => {
    if (testCases.length > 1) {
      setTestCases(testCases.filter((_, i) => i !== index));
    }
  };

  const toggleLanguage = (lang: string) => {
    if (allowedLanguages.includes(lang)) {
      setAllowedLanguages(allowedLanguages.filter(l => l !== lang));
    } else {
      setAllowedLanguages([...allowedLanguages, lang]);
    }
  };

  const isSaveDisabled = saving || (type === 'CODING' ? !codingTitle || !codingDesc : !text);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-dark">Add Question</h1>
          <p className="text-gray-500 mt-1">Create a new question for the bank</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate('/admin/questions')}
            className="px-5 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            <span>{saving ? 'Saving...' : 'Save Question'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
          <div className="flex space-x-6 bg-gray-50 p-2 rounded-lg inline-flex">
            {['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'CODING'].map((t) => (
              <label key={t} className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="type" 
                  checked={type === t} 
                  onChange={() => setType(t)}
                  className="text-primary focus:ring-primary w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">{t.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Category / Tag</label>
            <input 
              type="text" 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Frontend, Arrays, System Design"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
            <input 
              type="number" 
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {type === 'CODING' ? (
          <div className="space-y-6 border-t border-gray-100 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Problem Title</label>
              <input 
                type="text" 
                value={codingTitle}
                onChange={e => setCodingTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. Two Sum"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Problem Description</label>
              <textarea 
                rows={5}
                value={codingDesc}
                onChange={e => setCodingDesc(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-sans"
                placeholder="Describe the problem, input logic, output logic, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Input Format (Optional)</label>
                <textarea 
                  rows={2}
                  value={inputFormat}
                  onChange={e => setInputFormat(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  placeholder="e.g. First line contains integer N..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Output Format (Optional)</label>
                <textarea 
                  rows={2}
                  value={outputFormat}
                  onChange={e => setOutputFormat(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  placeholder="e.g. Return a single integer..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Constraints</label>
              <textarea 
                rows={2}
                value={constraints}
                onChange={e => setConstraints(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono bg-gray-50"
                placeholder="e.g. 2 <= nums.length <= 10^4"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (ms)</label>
                <input 
                  type="number" 
                  value={timeLimit}
                  onChange={e => setTimeLimit(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Memory Limit (MB)</label>
                <input 
                  type="number" 
                  value={memoryLimit}
                  onChange={e => setMemoryLimit(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Languages</label>
                <div className="flex flex-wrap gap-2">
                  {['PYTHON', 'JAVA', 'CPP', 'JS'].map(lang => (
                    <label key={lang} className="flex items-center space-x-1 cursor-pointer bg-gray-100 px-2 py-1 rounded text-xs font-bold">
                      <input 
                        type="checkbox" 
                        checked={allowedLanguages.includes(lang)}
                        onChange={() => toggleLanguage(lang)}
                        className="text-primary rounded focus:ring-primary w-3 h-3"
                      />
                      <span>{lang}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">Test Cases</label>
                <button 
                  onClick={addTestCase}
                  className="text-sm bg-gray-100 hover:bg-gray-200 text-dark px-3 py-1.5 rounded-lg font-medium flex items-center transition-colors"
                >
                  <Plus size={16} className="mr-1" /> Add Test Case
                </button>
              </div>
              
              <div className="space-y-4">
                {testCases.map((tc, index) => (
                  <div key={index} className="flex gap-4 items-start bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Input</span>
                          <textarea 
                            rows={2}
                            value={tc.input}
                            onChange={e => updateTestCase(index, 'input', e.target.value)}
                            className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                            placeholder="Input args"
                          />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Expected Output</span>
                          <textarea 
                            rows={2}
                            value={tc.expectedOutput}
                            onChange={e => updateTestCase(index, 'expectedOutput', e.target.value)}
                            className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                            placeholder="Return value"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer w-fit">
                          <input 
                            type="checkbox" 
                            checked={tc.isHidden}
                            onChange={e => updateTestCase(index, 'isHidden', e.target.checked)}
                            className="text-primary rounded focus:ring-primary"
                          />
                          <span>Hide this test case from candidates (eval only)</span>
                        </label>
                      </div>
                    </div>
                    {testCases.length > 1 && (
                      <button 
                        onClick={() => removeTestCase(index)}
                        className="p-2 text-gray-400 hover:text-danger hover:bg-red-50 rounded-lg transition-colors mt-6"
                        title="Remove Test Case"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 border-t border-gray-100 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
              <textarea 
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Enter your question here..."
              />
            </div>

            {(type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Options</label>
                <div className="space-y-3">
                  {options.map((opt, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <input 
                        type={type === 'SINGLE_CHOICE' ? "radio" : "checkbox"} 
                        name="correct-option"
                        checked={opt.isCorrect}
                        onChange={(e) => {
                          const newOpts = [...options];
                          if (type === 'SINGLE_CHOICE') {
                            newOpts.forEach(o => o.isCorrect = false);
                          }
                          newOpts[index].isCorrect = e.target.checked;
                          setOptions(newOpts);
                        }}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <input 
                        type="text" 
                        value={opt.text}
                        onChange={(e) => {
                          const newOpts = [...options];
                          newOpts[index].text = e.target.value;
                          setOptions(newOpts);
                        }}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionEditor;
