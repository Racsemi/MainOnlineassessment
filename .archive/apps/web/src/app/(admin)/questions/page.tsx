'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { 
  BookOpen, Search, Plus, Filter, Code2, CheckSquare, 
  Tag, Clock, Award, ChevronRight, X, FileCode, Trash2, Edit2, Play, PlusCircle
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Papa from 'papaparse';

const CATEGORIES = ['All', 'Aptitude', 'Logical Reasoning', 'Data Structures', 'Algorithms', 'Operating Systems', 'DBMS', 'Computer Networks', 'OOP', 'Web Development'];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    title: '',
    problemStatement: '',
    category: 'Data Structures',
    difficulty: 'EASY',
    questionType: 'MCQ_SINGLE',
    score: 2,
    negativeScore: 0,
    explanation: '',
    // MCQ State
    options: [
      { key: 'A', text: '', isCorrect: true },
      { key: 'B', text: '', isCorrect: false },
      { key: 'C', text: '', isCorrect: false },
      { key: 'D', text: '', isCorrect: false }
    ],
    // CODING State
    codingDetails: {
      inputFormat: '',
      outputFormat: '',
      constraints: '',
      timeLimitMs: 2000,
      memoryLimitMb: 256,
      allowedLanguages: ['javascript', 'python', 'cpp', 'java'],
      starterCode: { javascript: '', python: '', cpp: '', java: '' },
      testCases: [
        { input: '', expectedOutput: '', isHidden: false, scoreWeight: 1.0, explanation: '' }
      ]
    }
  });

  // Bulk Upload State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);

  const loadQuestions = async () => {
    setLoading(true);
    let query = `/questions?limit=100`;
    if (selectedCategory !== 'All') query += `&category=${encodeURIComponent(selectedCategory)}`;
    if (selectedType !== 'ALL') query += `&questionType=${selectedType}`;
    if (search) query += `&search=${encodeURIComponent(search)}`;

    const res = await fetchApi(query);
    if (res.success && res.data) {
      setQuestions(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadQuestions();
  }, [selectedCategory, selectedType]);

  const resetForm = () => {
    setEditId(null);
    setForm({
      title: '', problemStatement: '', category: 'Data Structures', difficulty: 'EASY',
      questionType: 'MCQ_SINGLE', score: 2, negativeScore: 0, explanation: '',
      options: [
        { key: 'A', text: '', isCorrect: true },
        { key: 'B', text: '', isCorrect: false },
        { key: 'C', text: '', isCorrect: false },
        { key: 'D', text: '', isCorrect: false }
      ],
      codingDetails: {
        inputFormat: '', outputFormat: '', constraints: '', timeLimitMs: 2000, memoryLimitMb: 256,
        allowedLanguages: ['javascript', 'python', 'cpp', 'java'], starterCode: { javascript: '', python: '', cpp: '', java: '' },
        testCases: [{ input: '', expectedOutput: '', isHidden: false, scoreWeight: 1.0, explanation: '' }]
      }
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (q: any) => {
    setEditId(q.id);
    const options = q.options?.map((o: any) => ({
      key: o.optionKey, text: o.content, isCorrect: o.isCorrect
    })) || [];
    
    // Fill up to 4 if less
    while(options.length < 4) {
      options.push({ key: String.fromCharCode(65 + options.length), text: '', isCorrect: false });
    }

    setForm({
      title: q.title,
      problemStatement: q.problemStatement,
      category: q.category,
      difficulty: q.difficulty,
      questionType: q.questionType,
      score: q.score,
      negativeScore: q.negativeScore,
      explanation: q.explanation || '',
      options: options,
      codingDetails: q.codingDetails ? {
        inputFormat: q.codingDetails.inputFormat || '',
        outputFormat: q.codingDetails.outputFormat || '',
        constraints: q.codingDetails.constraints || '',
        timeLimitMs: q.codingDetails.timeLimitMs || 2000,
        memoryLimitMb: q.codingDetails.memoryLimitMb || 256,
        allowedLanguages: q.codingDetails.allowedLanguages ? JSON.parse(q.codingDetails.allowedLanguages) : ['javascript', 'python', 'cpp', 'java'],
        starterCode: q.codingDetails.starterCodeJson ? JSON.parse(q.codingDetails.starterCodeJson) : {},
        testCases: q.codingDetails.testCases?.map((tc: any) => ({
          input: tc.input, expectedOutput: tc.expectedOutput, isHidden: tc.isHidden, scoreWeight: tc.scoreWeight, explanation: tc.explanation || ''
        })) || []
      } : {
        inputFormat: '', outputFormat: '', constraints: '', timeLimitMs: 2000, memoryLimitMb: 256,
        allowedLanguages: ['javascript', 'python', 'cpp', 'java'], starterCode: {},
        testCases: []
      }
    });
    setSelectedQuestion(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    const res = await fetchApi(`/questions/${id}`, { method: 'DELETE' });
    if (res.success) {
      setSelectedQuestion(null);
      loadQuestions();
    } else {
      alert(res.message);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);

    const payload: any = {
      title: form.title,
      problemStatement: form.problemStatement,
      category: form.category,
      difficulty: form.difficulty,
      questionType: form.questionType,
      score: Number(form.score),
      negativeScore: Number(form.negativeScore),
      explanation: form.explanation
    };

    if (form.questionType === 'MCQ_SINGLE' || form.questionType === 'MCQ_MULTIPLE') {
      const validOptions = form.options.filter(o => o.text.trim() !== '');
      if (validOptions.length < 2) {
        alert("Please provide at least 2 options.");
        setModalLoading(false);
        return;
      }
      const corrects = validOptions.filter(o => o.isCorrect).length;
      if (form.questionType === 'MCQ_SINGLE' && corrects !== 1) {
        alert("MCQ_SINGLE requires exactly 1 correct answer.");
        setModalLoading(false);
        return;
      }
      if (form.questionType === 'MCQ_MULTIPLE' && corrects < 1) {
        alert("MCQ_MULTIPLE requires at least 1 correct answer.");
        setModalLoading(false);
        return;
      }
      payload.options = validOptions.map((o, i) => ({ optionKey: String.fromCharCode(65 + i), text: o.text, isCorrect: o.isCorrect }));
    } else {
      const { inputFormat, outputFormat, constraints, timeLimitMs, memoryLimitMb, allowedLanguages, testCases } = form.codingDetails;
      if (!inputFormat || !outputFormat) {
        alert("Input and Output formats are required for coding questions.");
        setModalLoading(false);
        return;
      }
      if (testCases.length === 0 || !testCases[0].input || !testCases[0].expectedOutput) {
        alert("At least one valid test case (input + expected output) is required.");
        setModalLoading(false);
        return;
      }
      payload.codingDetails = {
        inputFormat, outputFormat, constraints, timeLimitMs: Number(timeLimitMs), memoryLimitMb: Number(memoryLimitMb),
        allowedLanguages, testCases
      };
    }

    const endpoint = editId ? `/questions/${editId}` : '/questions';
    const method = editId ? 'PUT' : 'POST';

    const res = await fetchApi(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    setModalLoading(false);
    if (res.success) {
      setIsModalOpen(false);
      resetForm();
      loadQuestions();
    } else {
      alert(res.message);
    }
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBulkFile(file);
      setBulkResults(null);
      
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setParsedRows(results.data);
        }
      });
    }
  };

  const submitBulkUpload = async () => {
    if (parsedRows.length === 0) return;
    setBulkLoading(true);
    const res = await fetchApi('/questions/import', {
      method: 'POST',
      body: JSON.stringify({ questions: parsedRows })
    });
    setBulkLoading(false);
    if (res.success) {
      setBulkResults(res);
      loadQuestions();
    } else {
      setBulkResults({ failedCount: parsedRows.length, importedCount: 0, errors: res.errors || [res.message] });
    }
  };

  const handleDownloadSample = () => {
    const csvContent = "question,type,optionA,optionB,optionC,optionD,optionE,correctAnswer,marks,negativeMarks,difficulty,category,tags,explanation\n"
      + "What is the time complexity of binary search?,MCQ_SINGLE,O(n),O(log n),O(n^2),O(1),,B,2,0,MEDIUM,Algorithms,Search,Binary search halves the search space each time.\n"
      + "Which of these are NoSQL databases?,MCQ_MULTIPLE,MongoDB,PostgreSQL,Redis,MySQL,Cassandra,A|C|E,4,1,HARD,DBMS,NoSQL,MongoDB Redis and Cassandra are NoSQL.";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'racsemi_mcq_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <Navbar title="Question Repository" />

      <main className="p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Question Bank</h2>
            <p className="text-xs text-gray-500">Manage MCQs and Coding questions for assessments.</p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setIsBulkModalOpen(true)} className="bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border border-gray-300 flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              <span>Bulk MCQ Upload</span>
            </button>
            <button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Add Question</span>
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4 rounded-2xl space-y-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadQuestions()}
                placeholder="Search by title, statement, or tags..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700">
                <option value="ALL">All Types</option>
                <option value="MCQ_SINGLE">Single MCQ</option>
                <option value="MCQ_MULTIPLE">Multiple MCQ</option>
                <option value="CODING">Coding</option>
              </select>
              <button onClick={loadQuestions} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium px-4 py-2 rounded-xl">
                Search
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap border ${selectedCategory === cat ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center text-gray-500 text-sm">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm bg-gray-50 rounded-2xl border border-gray-200">No questions found.</div>
          ) : (
            questions.map((q) => (
              <div key={q.id} onClick={() => setSelectedQuestion(q)} className="bg-white border border-gray-200 hover:border-blue-300 p-5 rounded-2xl transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group shadow-sm hover:shadow-md">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    {q.questionType === 'CODING' ? <span className="p-1 rounded bg-indigo-50 text-indigo-600 border border-indigo-200"><Code2 className="w-3.5 h-3.5" /></span> : <span className="p-1 rounded bg-blue-50 text-blue-600 border border-blue-200"><CheckSquare className="w-3.5 h-3.5" /></span>}
                    <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-600">{q.title}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase border ${q.difficulty === 'EASY' ? 'bg-green-50 text-green-700 border-green-200' : q.difficulty === 'MEDIUM' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{q.difficulty}</span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{q.problemStatement}</p>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="text-gray-700 font-medium">{q.category}</span>
                    <span>•</span>
                    <span>{q.score} Marks</span>
                    {q.options && q.options.length > 0 && <span>• {q.options.length} Options</span>}
                    {q.codingDetails?.testCases && <span>• {q.codingDetails.testCases.length} Tests</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer: Inspect Question */}
        {selectedQuestion && (
          <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-xl bg-white border-l border-gray-200 h-full p-6 overflow-y-auto shadow-2xl flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded">{selectedQuestion.questionType}</span>
                  <span className="text-xs text-gray-500 font-medium">{selectedQuestion.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleOpenEdit(selectedQuestion)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700" title="Edit"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(selectedQuestion.id)} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  <button onClick={() => setSelectedQuestion(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{selectedQuestion.title}</h3>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700 whitespace-pre-wrap">{selectedQuestion.problemStatement}</div>
                </div>
                {selectedQuestion.options && selectedQuestion.options.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Options</h4>
                    <div className="space-y-2">
                      {selectedQuestion.options.map((opt: any) => (
                        <div key={opt.id} className={`p-3 rounded-xl border text-xs flex justify-between ${opt.isCorrect ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-gray-200'}`}>
                          <div className="flex gap-2">
                            <span className="font-bold">{opt.optionKey}</span>
                            <span>{opt.content}</span>
                          </div>
                          {opt.isCorrect && <span className="font-bold text-green-600">Correct</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedQuestion.codingDetails && (
                  <div className="space-y-4 text-xs">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Coding Details</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 bg-gray-50 rounded-xl border"><span className="text-gray-500 block">Time Limit</span><span className="font-bold text-gray-900">{selectedQuestion.codingDetails.timeLimitMs} ms</span></div>
                      <div className="p-3 bg-gray-50 rounded-xl border"><span className="text-gray-500 block">Memory Limit</span><span className="font-bold text-gray-900">{selectedQuestion.codingDetails.memoryLimitMb} MB</span></div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border space-y-1">
                      <span className="text-gray-500 font-semibold">Input Format</span>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedQuestion.codingDetails.inputFormat}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border space-y-1">
                      <span className="text-gray-500 font-semibold">Output Format</span>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedQuestion.codingDetails.outputFormat}</p>
                    </div>
                    <div className="space-y-2 mt-4">
                      <span className="font-semibold text-gray-500">Test Cases ({selectedQuestion.codingDetails.testCases?.length || 0})</span>
                      {selectedQuestion.codingDetails.testCases?.map((tc: any, i: number) => (
                        <div key={tc.id} className="p-3 bg-gray-50 rounded-xl border space-y-1">
                          <div className="flex justify-between"><span className="font-bold">Test {i + 1}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tc.isHidden ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{tc.isHidden ? 'HIDDEN' : 'PUBLIC'}</span></div>
                          <p className="font-mono bg-white p-1 rounded border">In: {tc.input}</p>
                          <p className="font-mono bg-white p-1 rounded border">Out: {tc.expectedOutput}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create/Edit Question */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 shadow-xl rounded-2xl max-w-4xl w-full p-6 space-y-4 max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">{editId ? 'Edit Question' : 'Create Question'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900"><X className="w-5 h-5" /></button>
              </div>
              
              <form onSubmit={handleSaveQuestion} className="space-y-6 text-xs">
                {/* Meta details */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-4 md:col-span-1">
                    <label className="block text-gray-700 font-semibold mb-1">Type</label>
                    <select disabled={!!editId} value={form.questionType} onChange={(e) => setForm({...form, questionType: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                      <option value="MCQ_SINGLE">MCQ (Single)</option>
                      <option value="MCQ_MULTIPLE">MCQ (Multiple)</option>
                      <option value="CODING">Coding Problem</option>
                    </select>
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <label className="block text-gray-700 font-semibold mb-1">Difficulty</label>
                    <select value={form.difficulty} onChange={(e) => setForm({...form, difficulty: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </select>
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <label className="block text-gray-700 font-semibold mb-1">Marks</label>
                    <input type="number" step="0.5" value={form.score} onChange={(e) => setForm({...form, score: Number(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2" />
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <label className="block text-gray-700 font-semibold mb-1">Negative Marks</label>
                    <input type="number" step="0.5" value={form.negativeScore} onChange={(e) => setForm({...form, negativeScore: Number(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2" />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Title</label>
                  <input required value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2" placeholder="Question Title" />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Problem Statement</label>
                  <textarea rows={4} required value={form.problemStatement} onChange={(e) => setForm({...form, problemStatement: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono" placeholder="Detailed problem statement..." />
                </div>

                {/* MCQ SPECIFIC */}
                {(form.questionType === 'MCQ_SINGLE' || form.questionType === 'MCQ_MULTIPLE') && (
                  <div className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <h4 className="font-bold text-blue-900">Options Configuration</h4>
                    <p className="text-gray-500 mb-2">{form.questionType === 'MCQ_SINGLE' ? 'Select EXACTLY ONE correct answer.' : 'Select ONE OR MORE correct answers.'}</p>
                    {form.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <input
                          type={form.questionType === 'MCQ_SINGLE' ? 'radio' : 'checkbox'}
                          name="mcq_correct"
                          checked={opt.isCorrect}
                          onChange={(e) => {
                            const newOptions = [...form.options];
                            if (form.questionType === 'MCQ_SINGLE') {
                              newOptions.forEach(o => o.isCorrect = false);
                            }
                            newOptions[i].isCorrect = e.target.checked;
                            setForm({ ...form, options: newOptions });
                          }}
                          className="w-4 h-4 text-blue-600 focus:ring-0 border-gray-300"
                        />
                        <span className="font-bold text-gray-700">{String.fromCharCode(65 + i)}</span>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => {
                            const newOptions = [...form.options];
                            newOptions[i].text = e.target.value;
                            setForm({ ...form, options: newOptions });
                          }}
                          placeholder={`Option ${String.fromCharCode(65 + i)}`}
                          className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2"
                        />
                        <button type="button" onClick={() => {
                          const newOptions = form.options.filter((_, idx) => idx !== i);
                          setForm({ ...form, options: newOptions });
                        }} className="p-2 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                    {form.options.length < 8 && (
                      <button type="button" onClick={() => setForm({...form, options: [...form.options, { key: String.fromCharCode(65 + form.options.length), text: '', isCorrect: false }]})} className="flex items-center gap-1 text-blue-600 font-semibold hover:underline mt-2">
                        <PlusCircle className="w-3.5 h-3.5" /> Add Option
                      </button>
                    )}
                  </div>
                )}

                {/* CODING SPECIFIC */}
                {form.questionType === 'CODING' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-700 font-semibold mb-1">Time Limit (ms)</label>
                        <input type="number" required value={form.codingDetails.timeLimitMs} onChange={(e) => setForm({...form, codingDetails: {...form.codingDetails, timeLimitMs: Number(e.target.value)}})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-semibold mb-1">Memory Limit (MB)</label>
                        <input type="number" required value={form.codingDetails.memoryLimitMb} onChange={(e) => setForm({...form, codingDetails: {...form.codingDetails, memoryLimitMb: Number(e.target.value)}})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Input Format</label>
                      <textarea rows={2} required value={form.codingDetails.inputFormat} onChange={(e) => setForm({...form, codingDetails: {...form.codingDetails, inputFormat: e.target.value}})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono" placeholder="Format of standard input..." />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Output Format</label>
                      <textarea rows={2} required value={form.codingDetails.outputFormat} onChange={(e) => setForm({...form, codingDetails: {...form.codingDetails, outputFormat: e.target.value}})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono" placeholder="Format of standard output..." />
                    </div>
                    <div>
                      <label className="block text-gray-700 font-semibold mb-1">Constraints</label>
                      <textarea rows={2} value={form.codingDetails.constraints} onChange={(e) => setForm({...form, codingDetails: {...form.codingDetails, constraints: e.target.value}})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono" placeholder="1 <= N <= 10^5..." />
                    </div>

                    <div className="space-y-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <h4 className="font-bold text-indigo-900 flex justify-between items-center">
                        <span>Test Cases</span>
                        <button type="button" onClick={() => setForm({...form, codingDetails: {...form.codingDetails, testCases: [...form.codingDetails.testCases, { input: '', expectedOutput: '', isHidden: false, scoreWeight: 1, explanation: '' }]}})} className="flex items-center gap-1 text-indigo-600 font-semibold hover:underline">
                          <PlusCircle className="w-3.5 h-3.5" /> Add Test Case
                        </button>
                      </h4>
                      {form.codingDetails.testCases.map((tc, i) => (
                        <div key={i} className="p-3 bg-white border border-gray-200 rounded-xl space-y-2 relative">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-700">Test #{i + 1}</span>
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-1 cursor-pointer text-gray-600">
                                <input type="checkbox" checked={tc.isHidden} onChange={(e) => {
                                  const newTc = [...form.codingDetails.testCases];
                                  newTc[i].isHidden = e.target.checked;
                                  setForm({...form, codingDetails: {...form.codingDetails, testCases: newTc}});
                                }} /> Hidden Test
                              </label>
                              <button type="button" onClick={() => {
                                const newTc = form.codingDetails.testCases.filter((_, idx) => idx !== i);
                                setForm({...form, codingDetails: {...form.codingDetails, testCases: newTc}});
                              }} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <textarea rows={2} required placeholder="Input (stdin)" value={tc.input} onChange={(e) => {
                               const newTc = [...form.codingDetails.testCases];
                               newTc[i].input = e.target.value;
                               setForm({...form, codingDetails: {...form.codingDetails, testCases: newTc}});
                            }} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono text-[11px]" />
                            <textarea rows={2} required placeholder="Expected Output (stdout)" value={tc.expectedOutput} onChange={(e) => {
                               const newTc = [...form.codingDetails.testCases];
                               newTc[i].expectedOutput = e.target.value;
                               setForm({...form, codingDetails: {...form.codingDetails, testCases: newTc}});
                            }} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono text-[11px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white py-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                  <button type="submit" disabled={modalLoading} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm">
                    {modalLoading ? 'Saving...' : 'Save Question'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Bulk Upload */}
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 shadow-xl rounded-2xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <h3 className="text-base font-bold text-gray-900">Bulk Upload MCQ Questions</h3>
                <button onClick={() => { setIsBulkModalOpen(false); setBulkFile(null); setParsedRows([]); setBulkResults(null); }} className="text-gray-400 hover:text-gray-900">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!bulkResults ? (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                    <p className="font-medium">For V1, bulk upload supports MCQ_SINGLE and MCQ_MULTIPLE only. Coding questions must be added manually.</p>
                    <button onClick={handleDownloadSample} className="px-3 py-1.5 bg-amber-100 border border-amber-300 hover:bg-amber-200 font-semibold rounded-lg whitespace-nowrap ml-4">
                      Download Sample CSV
                    </button>
                  </div>
                  
                  <input type="file" accept=".csv" onChange={handleBulkUpload} className="block w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />

                  {parsedRows.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-semibold text-green-600">✓ Detected {parsedRows.length} rows</p>
                      <div className="max-h-48 overflow-y-auto bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-gray-500 border-b border-gray-200">
                              <th className="pb-2 font-medium">Question</th>
                              <th className="pb-2 font-medium">Type</th>
                              <th className="pb-2 font-medium">Correct</th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-700">
                            {parsedRows.slice(0, 5).map((r, i) => (
                              <tr key={i} className="border-b border-gray-200">
                                <td className="py-2 truncate max-w-[200px]">{r.question}</td>
                                <td className="py-2">{r.type}</td>
                                <td className="py-2">{r.correctAnswer}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {parsedRows.length > 5 && <p className="text-gray-400 pt-2 italic">... and {parsedRows.length - 5} more</p>}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t border-gray-200 gap-3">
                    <button onClick={() => setIsBulkModalOpen(false)} className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-xl">Cancel</button>
                    <button onClick={submitBulkUpload} disabled={parsedRows.length === 0 || bulkLoading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl disabled:opacity-50 shadow-sm">
                      {bulkLoading ? 'Importing...' : 'Confirm Import'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <p className="font-bold text-gray-900 text-sm">Import Summary</p>
                    <p className="text-green-600">Successfully Imported: {bulkResults.importedCount}</p>
                    <p className="text-red-600">Failed: {bulkResults.failedCount}</p>
                  </div>
                  {bulkResults.errors && bulkResults.errors.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-semibold text-red-600">Validation Errors:</p>
                      <ul className="list-disc pl-4 space-y-1 text-gray-700 max-h-40 overflow-y-auto font-mono text-[11px]">
                        {bulkResults.errors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button onClick={() => setIsBulkModalOpen(false)} className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium">Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
