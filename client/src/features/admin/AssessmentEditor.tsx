import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Plus, Trash2, Loader2, Upload, Settings, ListTree, CalendarClock, Play, Square, Link as LinkIcon, Check, X, BarChart3, Edit } from 'lucide-react';
import api from '../../lib/axios';
import InlineQuestionEditor from './InlineQuestionEditor';
import ResultsView from './ResultsView';

const AssessmentEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'SECTIONS' | 'SCHEDULE' | 'ANALYTICS'>('SETTINGS');

  // General States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('DRAFT');
  
  // Sections
  const [sections, setSections] = useState<{ name: string; duration: number; questionIds: string[] }[]>([
    { name: 'General Section', duration: 30, questionIds: [] }
  ]);
  
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [showQuestionModal, setShowQuestionModal] = useState<number | null>(null);
  const [showInlineEditor, setShowInlineEditor] = useState<{ sectionIdx?: number; data?: any } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCsvSection, setActiveCsvSection] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/questions').then(res => setAllQuestions(res.data)).catch(console.error);

    if (!isNew) {
      const fetchAssessment = async () => {
        setLoading(true);
        try {
          const res = await api.get(`/assessments/${id}`);
          setTitle(res.data.title);
          setDescription(res.data.description || '');
          
          if (res.data.startDate) setStartDate(new Date(new Date(res.data.startDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
          if (res.data.endDate) setEndDate(new Date(new Date(res.data.endDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
          setStatus(res.data.status);
          
          if (res.data.sections && res.data.sections.length > 0) {
            setSections(res.data.sections.map((s: any) => ({
              name: s.name,
              duration: s.duration,
              questionIds: s.questions ? s.questions.map((q: any) => q.id).concat(s.codingQuestions?.map((cq: any) => cq.id) || []) : []
            })));
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchAssessment();
    }
  }, [id, isNew]);
  
  const handleSave = async (overrideStatus?: string) => {
    setSaving(true);
    try {
      const formattedSections = sections.map(sec => {
        const normalIds = sec.questionIds.filter(id => {
          const q = allQuestions.find(q => q.id === id);
          return !q || q.type !== 'CODING';
        });
        const codingIds = sec.questionIds.filter(id => {
          const q = allQuestions.find(q => q.id === id);
          return q && q.type === 'CODING';
        });
        return {
          ...sec,
          questionIds: normalIds,
          codingQuestionIds: codingIds
        };
      });

      const payload = {
        title,
        description,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        status: overrideStatus || status,
        sections: formattedSections
      };

      if (isNew) {
        await api.post('/assessments', payload);
      } else {
        await api.put(`/assessments/${id}`, payload);
      }
      navigate('/admin/assessments');
    } catch (err) {
      console.error(err);
      alert("Failed to save assessment.");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (isNew) return;
    const link = `${window.location.origin}/register/${id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addSection = () => setSections([...sections, { name: `Section ${sections.length + 1}`, duration: 30, questionIds: [] }]);
  const removeSection = (index: number) => setSections(sections.filter((_, i) => i !== index));
  const updateSection = (index: number, field: string, value: any) => {
    const newSecs = [...sections];
    newSecs[index] = { ...newSecs[index], [field]: value };
    setSections(newSecs);
  };
  const toggleQuestionSelection = (qId: string) => {
    if (showQuestionModal === null) return;
    const newSecs = [...sections];
    const sec = newSecs[showQuestionModal];
    if (sec.questionIds.includes(qId)) sec.questionIds = sec.questionIds.filter(id => id !== qId);
    else sec.questionIds.push(qId);
    setSections(newSecs);
  };
  const handleInlineSave = (questionId: string) => {
    if (showInlineEditor?.sectionIdx !== undefined) {
      const newSecs = [...sections];
      if (!newSecs[showInlineEditor.sectionIdx].questionIds.includes(questionId)) {
        newSecs[showInlineEditor.sectionIdx].questionIds.push(questionId);
      }
      setSections(newSecs);
    }
    api.get('/questions').then(res => setAllQuestions(res.data)).catch(console.error);
    setShowInlineEditor(null);
  };
  const handleRemoveQuestionFromSection = (sectionIndex: number, questionId: string) => {
    const newSecs = [...sections];
    newSecs[sectionIndex].questionIds = newSecs[sectionIndex].questionIds.filter(id => id !== questionId);
    setSections(newSecs);
  };
  const handleEditQuestionInSection = (questionId: string) => {
    const qObj = allQuestions.find(q => q.id === questionId);
    if (qObj) {
      setShowInlineEditor({ data: qObj });
    }
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || activeCsvSection === null) return;
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    try {
      setLoading(true);
      const res = await api.post('/questions/csv/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data.questions) {
        const newSecs = [...sections];
        const newIds = res.data.questions.map((q: any) => q.id);
        newSecs[activeCsvSection].questionIds.push(...newIds);
        setSections(newSecs);
        alert(`Successfully imported ${newIds.length} questions!`);
        api.get('/questions').then(res => setAllQuestions(res.data)).catch(console.error);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to import CSV');
    } finally {
      setLoading(false);
      setActiveCsvSection(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const totalDuration = sections.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-full min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-dark">{isNew ? 'Create Assessment' : 'Assessment Builder'}</h1>
          <p className="text-gray-500 mt-1">Configure sections, questions, and deployment</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {!isNew && (
            <button 
              onClick={copyLink}
              className="flex items-center space-x-2 px-4 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-bold transition-colors border border-blue-200"
            >
              {copied ? <Check size={18} className="text-green-600" /> : <LinkIcon size={18} />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          )}

          <div className="text-sm font-bold px-4 py-2 bg-gray-100 rounded-lg text-gray-700 mr-2 ml-2">
            Status: <span className={status === 'PUBLISHED' ? 'text-success' : 'text-warning'}>{status}</span>
          </div>
          
          <button 
            onClick={() => navigate('/admin/assessments')}
            className="px-5 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200 bg-white shadow-sm"
          >
            Cancel
          </button>
          <button 
            onClick={() => handleSave()}
            disabled={saving || !title}
            className="bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-colors disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            <span>Save Draft</span>
          </button>
        </div>
      </div>

      <div className="flex space-x-1 mb-6 bg-gray-200/50 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('SETTINGS')} className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg font-bold transition-colors ${activeTab === 'SETTINGS' ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'}`}>
          <Settings size={18} /><span>General Details</span>
        </button>
        <button onClick={() => setActiveTab('SECTIONS')} className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg font-bold transition-colors ${activeTab === 'SECTIONS' ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'}`}>
          <ListTree size={18} /><span>Test Sections</span>
        </button>
        <button onClick={() => setActiveTab('SCHEDULE')} className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg font-bold transition-colors ${activeTab === 'SCHEDULE' ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'}`}>
          <CalendarClock size={18} /><span>Schedule & Deploy</span>
        </button>
        {!isNew && (
          <button onClick={() => setActiveTab('ANALYTICS')} className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg font-bold transition-colors ${activeTab === 'ANALYTICS' ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'}`}>
            <BarChart3 size={18} /><span>Analytics & Results</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : (
      <div className="flex-1">
        
        {/* SETTINGS TAB */}
        {activeTab === 'SETTINGS' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-4xl space-y-6">
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
            <div className="p-4 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 text-sm">
              <strong>Note:</strong> Advanced settings like Registration Forms, Strict Rules, and Feature Toggles are now managed globally in the <strong>Settings</strong> page from the main navigation sidebar.
            </div>
          </div>
        )}

        {/* SECTIONS TAB */}
        {activeTab === 'SECTIONS' && (
          <div className="max-w-5xl space-y-6 mx-auto">
            <div className="flex justify-between items-end bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-dark">Total Duration: <span className="text-primary">{totalDuration} minutes</span></h2>
                <p className="text-sm text-gray-500">The total test timer is the sum of all section durations.</p>
              </div>
              <button onClick={addSection} className="bg-white border border-gray-300 text-dark hover:bg-gray-50 px-4 py-2 rounded-lg font-medium text-sm flex items-center shadow-sm">
                <Plus size={16} className="mr-1" /> Add Section
              </button>
            </div>
            
            <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileUpload} />

            {sections.map((sec, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                  <div className="flex space-x-4 flex-1 mr-4">
                    <input type="text" value={sec.name} onChange={e => updateSection(i, 'name', e.target.value)} className="font-bold text-dark bg-white border border-gray-300 px-3 py-1.5 rounded-md focus:border-primary focus:outline-none flex-1 max-w-sm" />
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-600">Duration (min):</label>
                      <input type="number" value={sec.duration} onChange={e => updateSection(i, 'duration', e.target.value)} className="w-20 font-bold text-dark bg-white border border-gray-300 px-3 py-1.5 rounded-md focus:border-primary focus:outline-none text-center" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-bold text-gray-400 bg-white px-3 py-1 border border-gray-200 rounded-full">{sec.questionIds.length} Questions</span>
                    <button onClick={() => removeSection(i)} className="text-gray-400 hover:text-danger p-1.5 hover:bg-red-50 rounded transition-colors" title="Delete Section"><Trash2 size={18} /></button>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex flex-wrap gap-3 mb-6">
                    <button onClick={() => setShowQuestionModal(i)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Select from Bank</button>
                    <button onClick={() => setShowInlineEditor({ sectionIdx: i })} className="px-4 py-2 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 rounded-lg text-sm font-bold transition-colors flex items-center"><Plus size={16} className="mr-1" /> Create Question</button>
                    <button onClick={() => { setActiveCsvSection(i); fileInputRef.current?.click(); }} className="px-4 py-2 bg-gray-800 text-white hover:bg-black rounded-lg text-sm font-medium transition-colors flex items-center"><Upload size={16} className="mr-1" /> Import CSV</button>
                  </div>
                  
                  {sec.questionIds.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sec.questionIds.map((qId, idx) => {
                        const qObj = allQuestions.find(q => q.id === qId);
                        return (
                          <div key={idx} className="border border-gray-200 rounded-lg p-3 flex justify-between items-start bg-gray-50/50">
                            <div className="flex-1 truncate pr-2">
                              <span className="font-bold text-gray-400 mr-2 text-xs">Q{idx+1}</span>
                              <span className="text-sm font-medium text-dark truncate">{qObj ? qObj.title || qObj.text : qId}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs px-2 py-1 bg-white border border-gray-200 rounded text-gray-500 font-bold whitespace-nowrap">{qObj ? (qObj.marks + ' M') : ''}</span>
                              <button
                                onClick={() => handleEditQuestionInSection(qId)}
                                className="p-1 text-gray-400 hover:text-primary hover:bg-blue-50 rounded"
                                title="Edit Question"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleRemoveQuestionFromSection(i, qId)}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                title="Remove from Section"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">No questions added to this section yet.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'SCHEDULE' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-dark mb-6">Deployment Controls</h2>
            <div className="grid grid-cols-2 gap-8 mb-10">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Available From (Date & Time)</label>
                <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Expiration Date & Time</label>
                <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="border-t border-gray-200 pt-8 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-dark mb-1">Assessment Status</h3>
                <p className="text-gray-500 text-sm">Control whether candidates can access this assessment right now.</p>
              </div>
              <div className="flex space-x-4">
                <button onClick={() => handleSave('DRAFT')} className={`px-6 py-3 rounded-xl font-bold flex items-center space-x-2 transition-all ${status !== 'PUBLISHED' ? 'bg-gray-200 text-gray-800 shadow-inner' : 'bg-white border-2 border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                  <Square size={20} className={status !== 'PUBLISHED' ? 'text-gray-800' : ''} />
                  <span>Stop Assessment</span>
                </button>
                <button onClick={() => handleSave('PUBLISHED')} disabled={sections.length === 0 || sections[0].questionIds.length === 0} className={`px-8 py-3 rounded-xl font-bold flex items-center space-x-2 transition-all ${status === 'PUBLISHED' ? 'bg-success text-white shadow-md' : 'bg-white border-2 border-success/30 text-success hover:bg-success/10'}`}>
                  <Play size={20} fill={status === 'PUBLISHED' ? "white" : "none"} />
                  <span>Start Assessment</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'ANALYTICS' && !isNew && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[800px] overflow-hidden">
            <ResultsView />
          </div>
        )}

      </div>
      )}

      {/* MODALS */}
      {showQuestionModal !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-dark">Select Questions from Bank</h2>
              <button onClick={() => setShowQuestionModal(null)} className="text-gray-500 hover:text-dark"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {allQuestions.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No questions in bank.</div>
              ) : (
                allQuestions.map(q => {
                  const isSelected = sections[showQuestionModal].questionIds.includes(q.id);
                  return (
                    <div key={q.id} onClick={() => toggleQuestionSelection(q.id)} className={`p-4 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-dark font-medium line-clamp-2">{q.title || q.text}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <span className="text-xs font-bold px-2 py-1 bg-white border border-gray-200 rounded text-gray-500">{q.type || 'CODING'}</span>
                            <span className="text-xs font-bold px-2 py-1 bg-white border border-gray-200 rounded text-gray-500">{q.marks} Marks</span>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center mt-1 ml-4 ${isSelected ? 'bg-primary border-primary text-white' : 'border-gray-300'}`}>
                          {isSelected && <Check size={16} strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end bg-gray-50">
              <button onClick={() => setShowQuestionModal(null)} className="bg-primary hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-bold transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}

      {showInlineEditor !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <InlineQuestionEditor 
            initialData={showInlineEditor.data}
            sectionId={showInlineEditor.sectionIdx !== undefined ? id : undefined}
            onSave={handleInlineSave}
            onCancel={() => setShowInlineEditor(null)}
          />
        </div>
      )}
    </div>
  );
};

export default AssessmentEditor;
