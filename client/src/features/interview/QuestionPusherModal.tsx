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
          // Filter to questions that have coding details or convert
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-4xl h-[620px] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Push Problem to Candidate</h3>
              <p className="text-xs text-slate-400">
                Select a problem from your question bank or compose a custom challenge live.
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
                  : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              <Plus size={14} />
              <span>{customMode ? 'Browse Bank' : 'Custom Question'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
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
              <div className="w-2/5 border-r border-white/10 flex flex-col bg-slate-950/40">
                <div className="p-3 border-b border-white/10">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search questions..."
                      className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredQuestions.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      No questions found. Try creating a custom question.
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
                              ? 'bg-primary/20 border-primary text-white shadow-sm'
                              : 'bg-transparent border-transparent hover:bg-white/5 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold line-clamp-1">{title}</span>
                            {q.difficulty && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${
                                q.difficulty === 'Easy' ? 'bg-emerald-500/20 text-emerald-400' :
                                q.difficulty === 'Hard' ? 'bg-red-500/20 text-red-400' :
                                'bg-amber-500/20 text-amber-400'
                              }`}>
                                {q.difficulty}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                            {q.description || (q as any).text}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right: Question Preview */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between bg-slate-900/60">
                {selectedQuestion ? (
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold text-primary tracking-wider uppercase">Problem Preview</span>
                      <h4 className="text-lg font-bold text-white mt-0.5">
                        {selectedQuestion.title || (selectedQuestion as any).text}
                      </h4>
                    </div>

                    <div className="bg-slate-950 border border-white/5 rounded-xl p-4 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedQuestion.description || (selectedQuestion as any).text}
                    </div>

                    {selectedQuestion.constraints && (
                      <div>
                        <h5 className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Constraints</h5>
                        <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl font-mono border border-white/5">
                          {selectedQuestion.constraints}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Select a question from the list to preview
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Custom Question Form */
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-900/60">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Problem Title *</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Reverse a Linked List / Two Sum"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Language</label>
                  <select
                    value={customLanguage}
                    onChange={(e) => setCustomLanguage(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="javascript">JavaScript (Node.js)</option>
                    <option value="python">Python 3</option>
                    <option value="cpp">C++ (GCC 13)</option>
                    <option value="java">Java 21</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Problem Description & Examples *</label>
                <textarea
                  rows={4}
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Explain the problem statement, inputs, outputs, and sample test cases..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Starter Code Template (Optional)</label>
                <textarea
                  rows={4}
                  value={customStarterCode}
                  onChange={(e) => setCustomStarterCode(e.target.value)}
                  placeholder="function solution(args) { ... }"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-950/70 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center space-x-1.5">
            <Sparkles size={14} className="text-primary" />
            <span>Problem will immediately appear on the candidate's screen and code editor.</span>
          </span>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePush}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-white shadow-md transition-all"
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
