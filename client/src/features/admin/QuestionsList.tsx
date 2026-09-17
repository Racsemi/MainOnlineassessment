import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Filter, Trash2, Edit, Upload, X, CheckCircle, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../lib/axios';

const QuestionsList = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // CSV Modal State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/questions');
      setQuestions(res.data);
    } catch (err) {
      console.error("Failed to fetch questions");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, type: string) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    try {
      await api.delete(`/questions/${id}?type=${type}`);
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      alert("Failed to delete question.");
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setValidationResult(null);
    }
  };

  const handleValidateCsv = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/questions/csv/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setValidationResult(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to validate CSV file. Check formatting.");
    } finally {
      setUploading(false);
    }
  };

  const handleImportCsv = async () => {
    if (!validationResult?.validRows) return;
    setUploading(true);
    try {
      await api.post('/questions/csv/import', {
        sectionId: null, // General question bank
        questions: validationResult.validRows
      });
      setShowCsvModal(false);
      setFile(null);
      setValidationResult(null);
      fetchQuestions(); // Refresh list
    } catch (err) {
      console.error(err);
      alert("Failed to import CSV.");
    } finally {
      setUploading(false);
    }
  };

  const filteredQuestions = questions.filter((q: any) => filterType === 'ALL' || q.type === filterType);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <Link to="/admin" className="text-gray-500 hover:text-dark flex items-center space-x-2 text-sm font-medium mb-3 transition-colors">
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-3xl font-bold text-dark">Question Bank</h1>
          <p className="text-gray-500 mt-1">Manage reusable questions for assessments</p>
        </div>
        
        <div className="flex space-x-3">
          <button 
            onClick={() => setShowCsvModal(true)}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <Upload size={20} />
            <span>Upload CSV</span>
          </button>
          <Link 
            to="/admin/questions/new" 
            className="bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <Plus size={20} />
            <span>Add Question</span>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search questions..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          
          <div className="relative">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white appearance-none"
            >
              <option value="ALL">All Types</option>
              <option value="SINGLE_CHOICE">Single Choice</option>
              <option value="MULTIPLE_CHOICE">Multiple Choice</option>
              <option value="SINGLE_LINE">Single Line</option>
              <option value="PARAGRAPH">Paragraph</option>
              <option value="NUMERIC">Numeric</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="CODING">Coding</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>
        
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-sm">
              <th className="px-6 py-4 font-medium w-1/2">Question</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Category</th>
              <th className="px-6 py-4 font-medium">Marks</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredQuestions.map((q: any) => (
              <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-dark truncate max-w-md">{q.text}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                    {q.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{q.category}</td>
                <td className="px-6 py-4 text-gray-600">{q.marks}</td>
                <td className="px-6 py-4 text-right space-x-2 flex justify-end">
                  <Link to={`/admin/questions/${q.id}`} className="block text-gray-400 hover:text-primary transition-colors p-2 rounded-lg hover:bg-gray-100">
                    <Edit size={18} />
                  </Link>
                  <button onClick={() => handleDelete(q.id, q.type)} className="text-gray-400 hover:text-danger transition-colors p-2 rounded-lg hover:bg-gray-100">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {loading && (
          <div className="p-12 text-center text-gray-500">
            Loading questions...
          </div>
        )}

        {!loading && filteredQuestions.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            No questions found. Add one or upload a CSV.
          </div>
        )}
      </div>

      {/* CSV Upload Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h2 className="text-xl font-bold text-dark">Upload Questions via CSV</h2>
              <button onClick={() => { setShowCsvModal(false); setFile(null); setValidationResult(null); }} className="text-gray-500 hover:text-dark">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {!validationResult ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-800 mb-2">CSV Format Requirements</h3>
                    <p className="text-sm text-blue-700 mb-3">Your CSV file must include exactly these headers in the first row. Download a sample file to get started quickly:</p>
                    <div className="flex flex-wrap gap-3 mb-4">
                      <a 
                        href="/sample_single_choice.csv" 
                        download
                        className="flex items-center space-x-2 bg-white border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                      >
                        <span>⬇️ Single Choice CSV</span>
                      </a>
                      <a 
                        href="/sample_multiple_choice.csv" 
                        download
                        className="flex items-center space-x-2 bg-white border border-teal-300 text-teal-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-teal-100 transition-colors"
                      >
                        <span>⬇️ Multiple Choice CSV</span>
                      </a>
                      <a 
                        href="/sample_coding_questions.csv" 
                        download
                        className="flex items-center space-x-2 bg-white border border-purple-300 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-100 transition-colors"
                      >
                        <span>⬇️ Coding CSV</span>
                      </a>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left whitespace-nowrap bg-white rounded border border-blue-200">
                        <thead className="bg-blue-100 text-blue-800">
                          <tr>
                            <th className="px-3 py-2">type</th>
                            <th className="px-3 py-2">category</th>
                            <th className="px-3 py-2">difficulty</th>
                            <th className="px-3 py-2">marks</th>
                            <th className="px-3 py-2">question</th>
                            <th className="px-3 py-2">option_a</th>
                            <th className="px-3 py-2">option_b</th>
                            <th className="px-3 py-2">option_c</th>
                            <th className="px-3 py-2">option_d</th>
                            <th className="px-3 py-2">correct_answer</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-600">
                          <tr className="border-t border-blue-100">
                            <td className="px-3 py-2 font-mono text-xs">SINGLE_CHOICE</td>
                            <td className="px-3 py-2">Frontend</td>
                            <td className="px-3 py-2">Medium</td>
                            <td className="px-3 py-2">2</td>
                            <td className="px-3 py-2">What is React?</td>
                            <td className="px-3 py-2">A library</td>
                            <td className="px-3 py-2">A framework</td>
                            <td className="px-3 py-2">A language</td>
                            <td className="px-3 py-2">A database</td>
                            <td className="px-3 py-2 font-mono font-bold">A</td>
                          </tr>
                          <tr className="border-t border-blue-100">
                            <td className="px-3 py-2 font-mono text-xs">MULTIPLE_CHOICE</td>
                            <td className="px-3 py-2">Backend</td>
                            <td className="px-3 py-2">Hard</td>
                            <td className="px-3 py-2">3</td>
                            <td className="px-3 py-2">Select NoSQL DBs:</td>
                            <td className="px-3 py-2">PostgreSQL</td>
                            <td className="px-3 py-2">MongoDB</td>
                            <td className="px-3 py-2">MySQL</td>
                            <td className="px-3 py-2">Cassandra</td>
                            <td className="px-3 py-2 font-mono font-bold">B,D</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input 
                      type="file" 
                      accept=".csv"
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    <Upload size={32} className="text-gray-400 mb-3" />
                    <p className="text-dark font-medium mb-1">
                      {file ? file.name : 'Select a CSV file'}
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Maximum file size: 5MB'}
                    </p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:border-primary transition-colors bg-white"
                    >
                      Browse Files
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-4">
                      <CheckCircle className="text-green-500" size={32} />
                      <div>
                        <p className="text-sm text-green-800 font-semibold">Valid Questions</p>
                        <p className="text-2xl font-bold text-green-900">{validationResult.validCount}</p>
                      </div>
                    </div>
                    <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-4">
                      <AlertTriangle className="text-red-500" size={32} />
                      <div>
                        <p className="text-sm text-red-800 font-semibold">Errors Found</p>
                        <p className="text-2xl font-bold text-red-900">{validationResult.invalidCount}</p>
                      </div>
                    </div>
                  </div>

                  {validationResult.invalidCount > 0 && (
                    <div>
                      <h4 className="font-semibold text-dark mb-3">Validation Errors</h4>
                      <div className="bg-red-50 rounded-lg border border-red-100 max-h-64 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-red-100 text-red-800 sticky top-0">
                            <tr>
                              <th className="px-4 py-2">Row</th>
                              <th className="px-4 py-2">Field</th>
                              <th className="px-4 py-2">Error</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100">
                            {validationResult.invalidRows.map((err: any, i: number) => (
                              <tr key={i}>
                                <td className="px-4 py-2 font-medium text-red-900">Row {err.row}</td>
                                <td className="px-4 py-2 text-red-800">{err.field}</td>
                                <td className="px-4 py-2 text-red-700">{err.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50 rounded-b-xl">
              <button 
                onClick={() => { setShowCsvModal(false); setFile(null); setValidationResult(null); }}
                className="px-6 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              
              {!validationResult ? (
                <button 
                  onClick={handleValidateCsv}
                  disabled={!file || uploading}
                  className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : null}
                  <span>Validate File</span>
                </button>
              ) : (
                <button 
                  onClick={handleImportCsv}
                  disabled={validationResult.validCount === 0 || uploading}
                  className="bg-success text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : null}
                  <span>Import {validationResult.validCount} Valid Questions</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionsList;
