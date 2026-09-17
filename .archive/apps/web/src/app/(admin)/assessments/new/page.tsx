'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  FileCode2, 
  Layers, 
  BookOpen, 
  Award, 
  ShieldCheck, 
  Users, 
  Calendar, 
  Eye, 
  Send,
  Plus,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Papa from 'papaparse';

const STEPS = [
  { id: 1, name: 'Basic Info', icon: FileCode2 },
  { id: 2, name: 'Sections', icon: Layers },
  { id: 3, name: 'Questions', icon: BookOpen },
  { id: 4, name: 'Evaluation', icon: Award },
  { id: 5, name: 'Integrity', icon: ShieldCheck },
  { id: 6, name: 'Candidates', icon: Users },
  { id: 7, name: 'Schedule', icon: Calendar },
  { id: 8, name: 'Preview', icon: Eye },
  { id: 9, name: 'Publish', icon: Send }
];

export default function NewAssessmentWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('Software Developer Intern');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [timingMode, setTimingMode] = useState('TOTAL_ASSESSMENT_TIMER');
  const [durationMinutes, setDurationMinutes] = useState(100);
  const [totalMarks, setTotalMarks] = useState(100);
  const [passingPercentage, setPassingPercentage] = useState(60);
  const [proctoringMode, setProctoringMode] = useState('BASIC');
  const [sections, setSections] = useState<any[]>([
    { title: 'Aptitude & Logical Reasoning', durationMinutes: 20, questionIds: [] },
    { title: 'Technical MCQs', durationMinutes: 25, questionIds: [] },
    { title: 'Coding Easy', durationMinutes: 20, questionIds: [] },
    { title: 'Coding Medium', durationMinutes: 35, questionIds: [] }
  ]);

  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);

  useEffect(() => {
    async function fetchQuestions() {
      const res = await fetchApi('/questions?limit=100');
      if (res.success && res.data) {
        setAvailableQuestions(res.data);
      }
    }
    fetchQuestions();
  }, []);

  const handleAddSection = () => {
    setSections([...sections, { title: `New Section ${sections.length + 1}`, durationMinutes: 20, questionIds: [] }]);
  };

  const handleRemoveSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const assignQuestion = (sectionIdx: number, questionId: string) => {
    if (!questionId) return;
    const updated = [...sections];
    if (!updated[sectionIdx].questionIds) updated[sectionIdx].questionIds = [];
    if (!updated[sectionIdx].questionIds.includes(questionId)) {
      updated[sectionIdx].questionIds.push(questionId);
      setSections(updated);
    }
  };

  const removeAssignedQuestion = (sectionIdx: number, questionId: string) => {
    const updated = [...sections];
    updated[sectionIdx].questionIds = updated[sectionIdx].questionIds.filter((id: string) => id !== questionId);
    setSections(updated);
  };

  const handleCsvQuestionsUpload = (e: React.ChangeEvent<HTMLInputElement>, sectionIdx: number) => {
    if (e.target.files && e.target.files[0]) {
      Papa.parse(e.target.files[0], {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/, ""), // Remove BOM and whitespace
        complete: async (results) => {
          // Send to API to import them, then assign them
          const res = await fetchApi('/questions/import', {
            method: 'POST',
            body: JSON.stringify({ questions: results.data })
          });
          if (res.success) {
            alert(`Imported ${res.importedCount} questions successfully! (Reloading bank)`);
            const bankRes = await fetchApi('/questions?limit=100');
            if (bankRes.success && bankRes.data) {
              setAvailableQuestions(bankRes.data);
            }
          } else {
            alert(`Import Failed: ${res.message}\n${res.errors ? res.errors.join('\n') : ''}`);
          }
        },
        error: (err) => {
          alert(`CSV Parse Error: ${err.message}`);
        }
      });
      // Clear file input
      e.target.value = '';
    }
  };

  const computedTotalMarks = sections.reduce((acc, sec) => acc + sec.questionIds.reduce((qAcc: number, qId: string) => qAcc + (availableQuestions.find(q => q.id === qId)?.score || 0), 0), 0);

  const handleSaveAndPublish = async () => {
    setLoading(true);
    const res = await fetchApi('/assessments', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        role,
        difficulty,
        timingMode,
        durationMinutes: Number(durationMinutes),
        totalMarks: computedTotalMarks,
        passingPercentage: Number(passingPercentage),
        integrityMonitoring: proctoringMode !== 'OFF',
        proctoringMode,
        sections
      })
    });

    if (res.success && res.data?.id) {
      const pubRes = await fetchApi(`/assessments/${res.data.id}/publish`, { method: 'POST' });
      if (pubRes.success) {
        router.push('/assessments');
      } else {
        setLoading(false);
        alert('Assessment created but failed to publish: ' + pubRes.message);
      }
    } else {
      setLoading(false);
      alert(res.message || 'Failed to create assessment');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <Navbar title="Assessment Builder Wizard" />

      <main className="p-8 space-y-6 max-w-5xl mx-auto w-full">
        {/* Step Indicator */}
        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between overflow-x-auto pb-2 gap-2">
            {STEPS.map((step) => {
              const isCompleted = step.id < currentStep;
              const isCurrent = step.id === currentStep;
              const Icon = step.icon;

              return (
                <div
                  key={step.id}
                  onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isCompleted
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  <span>{step.id}. {step.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Content Card */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 space-y-6">
          {/* STEP 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Step 1: Assessment Overview</h3>
                <p className="text-xs text-gray-500">Define the core assessment identity and target job role.</p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Assessment Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. RACSEMI Software Developer Intern Assessment"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Target Role</label>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g. Software Developer Intern"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Difficulty Level</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Description & Purpose</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Assessment screening candidates for coding fluency, CS fundamentals and analytical skills."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Sections */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Step 2: Section Configuration</h3>
                  <p className="text-xs text-gray-500">Organize the assessment into logical timed sections.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center gap-1 hover:bg-blue-100"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Section
                </button>
              </div>

              <div className="space-y-3">
                {sections.map((sec, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">Section {idx + 1}</span>
                      {sections.length > 1 && (
                        <button onClick={() => handleRemoveSection(idx)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-600 mb-1">Section Title</label>
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) => {
                            const updated = [...sections];
                            updated[idx].title = e.target.value;
                            setSections(updated);
                          }}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-1">Duration (Mins)</label>
                        <input
                          type="number"
                          value={sec.durationMinutes}
                          onChange={(e) => {
                            const updated = [...sections];
                            updated[idx].durationMinutes = Number(e.target.value);
                            setSections(updated);
                          }}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-900 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Questions */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Step 3: Question Assignment</h3>
                <p className="text-xs text-gray-500">Manually select questions from the bank or upload via CSV to specific sections.</p>
              </div>

              <div className="space-y-4">
                {sections.map((sec, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-900">{sec.title}</h4>
                      <span className="text-xs text-gray-500">{sec.questionIds?.length || 0} Questions Assigned</span>
                    </div>

                    <div className="space-y-3">
                      {/* Assigned Questions Preview */}
                      {sec.questionIds && sec.questionIds.length > 0 && (
                        <div className="space-y-2">
                          {sec.questionIds.map((qid: string) => {
                            const q = availableQuestions.find(aq => aq.id === qid);
                            return (
                              <div key={qid} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg text-xs">
                                <span className="truncate max-w-sm font-medium text-gray-700">{q?.title || qid}</span>
                                <button onClick={() => removeAssignedQuestion(idx, qid)} className="text-red-500 hover:text-red-700">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs">
                        <select 
                          className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-500"
                          onChange={(e) => {
                            assignQuestion(idx, e.target.value);
                            e.target.value = '';
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>+ Assign from Question Bank</option>
                          {availableQuestions.filter(q => !sec.questionIds?.includes(q.id)).map(q => (
                            <option key={q.id} value={q.id}>{q.title} ({q.difficulty})</option>
                          ))}
                        </select>
                        <span className="text-gray-400 font-medium">OR</span>
                        <div className="relative">
                          <input 
                            type="file" 
                            accept=".csv"
                            onChange={(e) => handleCsvQuestionsUpload(e, idx)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <button type="button" className="px-3 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-1.5 text-gray-700 font-medium hover:bg-gray-50">
                            <Upload className="w-4 h-4" /> CSV Upload
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Evaluation */}
          {currentStep === 4 && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Step 4: Scoring & Evaluation Rules</h3>
                <p className="text-gray-500">Configure passing thresholds and scoring policies.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Total Assessment Marks (Calculated)</label>
                  <input
                    type="number"
                    disabled
                    value={computedTotalMarks}
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Passing Percentage (%)</label>
                  <input
                    type="number"
                    value={passingPercentage}
                    onChange={(e) => setPassingPercentage(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Integrity */}
          {currentStep === 5 && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Step 5: Integrity & Proctoring Modes</h3>
                <p className="text-gray-500">Configure anti-cheat telemetry and consent disclosures.</p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="block font-semibold text-gray-900 mb-3">Proctoring</label>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-xl hover:bg-gray-100 transition-colors">
                      <input
                        type="radio"
                        name="proctoring"
                        checked={proctoringMode === 'ADVANCED'}
                        onChange={() => setProctoringMode('ADVANCED')}
                        className="w-4 h-4 text-blue-600 border-gray-300"
                      />
                      <div>
                        <span className="text-gray-900 font-bold block">Strict</span>
                        <span className="text-xs text-gray-500">All monitoring enabled (Tab switch, Fullscreen, Webcam, Screen share)</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-xl hover:bg-gray-100 transition-colors">
                      <input
                        type="radio"
                        name="proctoring"
                        checked={proctoringMode === 'BASIC'}
                        onChange={() => setProctoringMode('BASIC')}
                        className="w-4 h-4 text-blue-600 border-gray-300"
                      />
                      <div>
                        <span className="text-gray-900 font-bold block">Basic</span>
                        <span className="text-xs text-gray-500">Tab switching and window blur monitoring only</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-xl hover:bg-gray-100 transition-colors">
                      <input
                        type="radio"
                        name="proctoring"
                        checked={proctoringMode === 'OFF'}
                        onChange={() => setProctoringMode('OFF')}
                        className="w-4 h-4 text-blue-600 border-gray-300"
                      />
                      <div>
                        <span className="text-gray-900 font-bold block">Off</span>
                        <span className="text-xs text-gray-500">No monitoring</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Candidate Pool */}
          {currentStep === 6 && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Step 6: Candidate Cohort</h3>
                <p className="text-gray-500">Candidates will receive cryptographically secure invitation links.</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800">
                <p className="font-semibold">Ready to invite campus candidates via CSV import and batch email dispatch.</p>
              </div>
            </div>
          )}

          {/* STEP 7: Schedule */}
          {currentStep === 7 && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Step 7: Timing Mode & Duration</h3>
                <p className="text-gray-500">Server-authoritative timer configuration.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Timing Mode</label>
                  <select
                    value={timingMode}
                    onChange={(e) => setTimingMode(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="TOTAL_ASSESSMENT_TIMER">Total Assessment Timer (100 Mins)</option>
                    <option value="SECTION_TIMER">Strict Section Timers</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Total Duration (Minutes)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: Preview */}
          {currentStep === 8 && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Step 8: Assessment Summary</h3>
                <p className="text-gray-500">Review all assessment specifications before publishing.</p>
              </div>

              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-500">Title:</span>
                  <span className="font-bold text-gray-900">{title || 'RACSEMI Software Developer Intern Assessment'}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-500">Duration:</span>
                  <span className="font-bold text-gray-900">{durationMinutes} Minutes</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-500">Total Marks:</span>
                  <span className="font-bold text-gray-900">{computedTotalMarks} Marks</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="text-gray-500">Proctoring:</span>
                  <span className="font-bold text-blue-600">{proctoringMode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sections:</span>
                  <span className="font-bold text-gray-900">{sections.length} Configured Sections</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 9: Publish */}
          {currentStep === 9 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Send className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Ready to Launch Assessment</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Once published, the assessment will be active and invitations can be dispatched to candidates.
              </p>
              <button
                type="button"
                onClick={handleSaveAndPublish}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-sm text-sm transition-all"
              >
                {loading ? 'Publishing Assessment...' : 'Publish & Activate Now'}
              </button>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            {currentStep < 9 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
