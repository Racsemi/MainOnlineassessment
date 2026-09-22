import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Send, X, Code2, Plus, Sparkles } from 'lucide-react';
import api from '../../lib/axios';

interface CodingQuestion {
  id: string;
  title: string;
  description: string;
  difficulty?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  allowedLanguages?: string[];
  testCases?: Array<{ input: string; expectedOutput: string }>;
}

interface QuestionPusherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPushProblem: (problem: {
    title: string;
    description: string;
    inputFormat?: string;
    outputFormat?: string;
    constraints?: string;
    starterCode?: string;
    language: string;
    testCases?: Array<{ input: string; expectedOutput: string }>;
  }) => void;
}

export const QuestionPusherModal: React.FC<QuestionPusherModalProps> = ({
  isOpen,
  onClose,
  onPushProblem,
}) => {
  const [questions, setQuestions] = useState<CodingQuestion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState<CodingQuestion | null>(null);
  const [customMode, setCustomMode] = useState(false);

  // Custom question fields
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customStarterCode, setCustomStarterCode] = useState('');
  const [customLanguage, setCustomLanguage] = useState('javascript');

  useEffect(() => {
    if (!isOpen) return;
    api.get('/questions')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setQuestions(res.data);
          if (res.data.length > 0) {
            setSelectedQuestion(res.data[0]);
          }
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePush = () => {
    if (customMode) {
      if (!customTitle.trim() || !customDescription.trim()) return;
      onPushProblem({
        title: customTitle.trim(),
        description: customDescription.trim(),
        starterCode: customStarterCode,
        language: customLanguage,
      });
    } else if (selectedQuestion) {
      const starter = `// Problem: ${selectedQuestion.title}\n// Language: ${selectedQuestion.allowedLanguages?.[0] || 'JavaScript'}\n\nfunction solve(input) {\n  // Your solution here\n  return input;\n}\n`;
      onPushProblem({
        title: selectedQuestion.title,
        description: selectedQuestion.description || (selectedQuestion as any).text,
        inputFormat: selectedQuestion.inputFormat,
        outputFormat: selectedQuestion.outputFormat,
        constraints: selectedQuestion.constraints,
        starterCode: starter,
        language: (selectedQuestion.allowedLanguages?.[0] || 'javascript').toLowerCase(),
        testCases: selectedQuestion.testCases,
      });
    }
    onClose();
  };

  const filteredQuestions = questions.filter((q) =>
    q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q as any).text?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl h-[620px] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Push Problem to Candidate</h3>
              <p className="text-xs text-slate-500">
                Choose a question from your question bank or compose a custom challenge live.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setCustomMode(!customMode)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                customMode 
                  ? 'bg-primary border-primary text-white' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Plus size={14} />
              <span>{customMode ? 'Browse Bank' : 'Custom Question'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {!customMode ? (
            <>
              {/* Left: Question List */}
              <div className="w-2/5 border-r border-slate-200 flex flex-col bg-slate-50">
                <div className="p-3 border-b border-slate-200 bg-white">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search questions..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:bg-white"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                  {filteredQuestions.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      No questions found. Try composing a custom question.
                    </div>
                  ) : (
                    filteredQuestions.map((q) => {
                      const isSelected = selectedQuestion?.id === q.id;
                      const title = q.title || (q as any).text;
                      return (
                        <button
                          key={q.id}
                          onClick={() => setSelectedQuestion(q)}
                          className={`w-full text-left p-3 rounded-xl transition-all border ${
                            isSelected
                              ? 'bg-primary/10 border-primary text-slate-900 shadow-sm'
                              : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold line-clamp-1">{title}</span>
                            {q.difficulty && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                                q.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-800' :
                                q.difficulty === 'Hard' ? 'bg-red-100 text-red-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {q.difficulty}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                            {q.description || (q as any).text}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right: Question Preview */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between bg-white">
                {selectedQuestion ? (
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Problem Preview</span>
                      <h4 className="text-lg font-bold text-slate-900 mt-0.5">
                        {selectedQuestion.title || (selectedQuestion as any).text}
                      </h4>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {selectedQuestion.description || (selectedQuestion as any).text}
                    </div>

                    {selectedQuestion.constraints && (
                      <div>
                        <h5 className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Constraints</h5>
                        <p className="text-xs text-slate-800 bg-slate-50 p-3 rounded-xl font-mono border border-slate-200">
                          {selectedQuestion.constraints}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Select a question from the list to preview
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Custom Question Form */
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Problem Title *</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Reverse a Linked List / Two Sum"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-primary focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Language</label>
                <select
                  value={customLanguage}
                  onChange={(e) => setCustomLanguage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-primary focus:bg-white"
                >
                  <option value="javascript">JavaScript (Node.js)</option>
                  <option value="python">Python 3</option>
                  <option value="cpp">C++ (GCC 13)</option>
                  <option value="java">Java 21</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Problem Description & Examples *</label>
                <textarea
                  rows={4}
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Explain the problem statement, inputs, outputs, and sample test cases..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-primary focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Starter Code Template (Optional)</label>
                <textarea
                  rows={4}
                  value={customStarterCode}
                  onChange={(e) => setCustomStarterCode(e.target.value)}
                  placeholder="function solution(args) { ... }"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-primary focus:bg-white font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center space-x-1.5">
            <Sparkles size={14} className="text-primary" />
            <span>Problem will instantly appear on candidate's screen and code editor.</span>
          </span>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePush}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-dark text-white shadow-sm transition-all"
            >
              <Send size={14} />
              <span>Push to Candidate</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default QuestionPusherModal;
