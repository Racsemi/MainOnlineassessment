import React, { useState } from 'react';
import { Save, Loader2, Plus, Trash2, X } from 'lucide-react';
import api from '../../lib/axios';

interface InlineQuestionEditorProps {
  sectionId?: string;
  initialData?: any;
  onSave: (questionId: string) => void;
  onCancel: () => void;
}

const InlineQuestionEditor: React.FC<InlineQuestionEditorProps> = ({ sectionId, initialData, onSave, onCancel }) => {
  const isEdit = !!initialData;
  const [type, setType] = useState(initialData?.type || 'SINGLE_CHOICE');
  const [text, setText] = useState(initialData?.text || '');
  const [category, setCategory] = useState(initialData?.category || 'General');
  const [marks, setMarks] = useState(initialData?.marks || 1);
  const [negativeMarks, setNegativeMarks] = useState<number | ''>(initialData?.negativeMarks ?? '');
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || 'Medium');
  const [saving, setSaving] = useState(false);

  // MCQ State
  const defaultOptions = [
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false }
  ];
  const [options, setOptions] = useState(initialData?.options || defaultOptions);
  const [expectedAnswer, setExpectedAnswer] = useState(initialData?.expectedAnswer || '');
  const [tolerance, setTolerance] = useState(initialData?.tolerance || 0);

  // Coding State
  const [codingTitle, setCodingTitle] = useState(initialData?.title || '');
  const [codingDesc, setCodingDesc] = useState(initialData?.description || '');
  const [inputFormat, setInputFormat] = useState(initialData?.inputFormat || '');
  const [outputFormat, setOutputFormat] = useState(initialData?.outputFormat || '');
  const [constraints, setConstraints] = useState(initialData?.constraints || '');
  const [timeLimit, setTimeLimit] = useState(initialData?.timeLimit || 2000);
  const [memoryLimit, setMemoryLimit] = useState(initialData?.memoryLimit || 256);
  const [allowedLanguages, setAllowedLanguages] = useState(initialData?.allowedLanguages || ['PYTHON', 'JAVA', 'CPP', 'JS']);
  const [testCases, setTestCases] = useState(initialData?.testCases || [
    { input: '', expectedOutput: '', isHidden: false }
  ]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let res;
      if (type === 'CODING') {
        const payload = {
          sectionId: isEdit ? undefined : sectionId,
          title: codingTitle,
          description: codingDesc,
          inputFormat,
          outputFormat,
          constraints,
          marks: Number(marks),
          timeLimit: Number(timeLimit),
          memoryLimit: Number(memoryLimit),
          allowedLanguages,
          testCases: testCases.map((tc: any) => ({ input: tc.input, expectedOutput: tc.expectedOutput, isHidden: tc.isHidden }))
        };
        if (isEdit) {
          res = await api.put(`/questions/coding/${initialData.id}`, payload);
        } else {
          res = await api.post('/questions/coding', payload);
        }
      } else {
        const payload = {
          sectionId: isEdit ? undefined : sectionId,
          text,
          type,
          category,
          difficulty,
          marks: Number(marks),
          negativeMarks: negativeMarks === '' ? null : Number(negativeMarks),
          options: (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') ? options.map((opt: any) => ({ text: opt.text, isCorrect: opt.isCorrect })) : [],
          expectedAnswer,
          tolerance: Number(tolerance)
        };
        if (isEdit) {
          res = await api.put(`/questions/mcq/${initialData.id}`, payload);
        } else {
          res = await api.post('/questions/mcq', payload);
        }
      }
      onSave(res.data.id);
    } catch (err) {
      console.error(err);
      alert('Failed to save question.');
    } finally {
      setSaving(false);
    }
  };

  const addTestCase = () => setTestCases([...testCases, { input: '', expectedOutput: '', isHidden: false }]);
  const updateTestCase = (index: number, field: string, value: any) => {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    setTestCases(updated);
  };
  const removeTestCase = (index: number) => {
    if (testCases.length > 1) setTestCases(testCases.filter((_: any, i: number) => i !== index));
  };
  const toggleLanguage = (lang: string) => {
    if (allowedLanguages.includes(lang)) setAllowedLanguages(allowedLanguages.filter((l: string) => l !== lang));
    else setAllowedLanguages([...allowedLanguages, lang]);
  };

  const isSaveDisabled = saving || (type === 'CODING' ? !codingTitle || !codingDesc : !text);

  return (
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
        <div>
          <h2 className="text-xl font-bold text-dark">{isEdit ? 'Edit Question' : 'Create Inline Question'}</h2>
          <p className="text-sm text-gray-500">{isEdit ? 'Update this question.' : 'This question will be automatically added to the section.'}</p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-6 overflow-y-auto flex-1 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
          <div className="flex space-x-4 bg-gray-50 p-2 rounded-lg inline-flex">
            {['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SINGLE_LINE', 'PARAGRAPH', 'CODING'].map((t) => (
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
            <input 
              type="number" 
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Negative Marks (Optional)</label>
            <input 
              type="number" 
              step="0.1"
              value={negativeMarks}
              onChange={(e) => setNegativeMarks(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. 0.25"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category / Tag</label>
            <input 
              type="text" 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Frontend"
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
                rows={4}
                value={codingDesc}
                onChange={e => setCodingDesc(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Constraints</label>
                <textarea 
                  rows={2}
                  value={constraints}
                  onChange={e => setConstraints(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-mono bg-gray-50"
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
                <button onClick={addTestCase} className="text-sm bg-gray-100 hover:bg-gray-200 text-dark px-3 py-1.5 rounded-lg font-medium flex items-center transition-colors">
                  <Plus size={16} className="mr-1" /> Add Test Case
                </button>
              </div>
              
              <div className="space-y-4">
                {testCases.map((tc: any, index: number) => (
                  <div key={index} className="flex gap-4 items-start bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Input</span>
                        <textarea 
                          rows={2}
                          value={tc.input}
                          onChange={e => updateTestCase(index, 'input', e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Expected Output</span>
                        <textarea 
                          rows={2}
                          value={tc.expectedOutput}
                          onChange={e => updateTestCase(index, 'expectedOutput', e.target.value)}
                          className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    {testCases.length > 1 && (
                      <button onClick={() => removeTestCase(index)} className="p-2 text-gray-400 hover:text-danger hover:bg-red-50 rounded-lg transition-colors mt-6">
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
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {(type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Options</label>
                <div className="space-y-3">
                  {options.map((opt: any, index: number) => (
                    <div key={index} className="flex items-center space-x-3">
                      <input 
                        type={type === 'SINGLE_CHOICE' ? "radio" : "checkbox"} 
                        name="correct-option"
                        checked={opt.isCorrect}
                        onChange={(e) => {
                          const newOpts = [...options];
                          if (type === 'SINGLE_CHOICE') newOpts.forEach(o => o.isCorrect = false);
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
            
            {(type === 'SINGLE_LINE' || type === 'NUMERIC') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Answer (Optional)</label>
                <input 
                  type={type === 'NUMERIC' ? "number" : "text"}
                  value={expectedAnswer}
                  onChange={(e) => setExpectedAnswer(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50 rounded-b-xl">
        <button onClick={onCancel} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">
          Cancel
        </button>
        <button 
          onClick={handleSave}
          disabled={isSaveDisabled}
          className="bg-primary hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          <span>{saving ? 'Saving...' : 'Save & Attach'}</span>
        </button>
      </div>
    </div>
  );
};

export default InlineQuestionEditor;
