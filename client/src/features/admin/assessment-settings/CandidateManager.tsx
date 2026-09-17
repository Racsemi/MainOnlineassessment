import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCcw, UserPlus, CheckCircle2, ShieldAlert } from 'lucide-react';
import api from '../../../lib/axios';

interface CandidateManagerProps {
  assessmentId: string;
}

const CandidateManager: React.FC<CandidateManagerProps> = ({ assessmentId }) => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Invite State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const fetchCandidates = async () => {
    try {
      const res = await api.get(`/candidates/${assessmentId}`);
      setCandidates(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assessmentId) fetchCandidates();
  }, [assessmentId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;
    setInviting(true);
    try {
      await api.post('/candidates/invite', { assessmentId, email: inviteEmail, name: inviteName });
      setInviteSuccess(true);
      setInviteEmail('');
      setInviteName('');
      setTimeout(() => setInviteSuccess(false), 3000);
      fetchCandidates();
    } catch (err) {
      alert('Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleResetTest = async (candidateId: string, name: string) => {
    if (!window.confirm(`WARNING: You are about to permanently delete all answers and results for ${name} in this assessment.\n\nAre you sure you want to reset their test so they can take it again?`)) {
      return;
    }
    
    try {
      await api.delete(`/candidates/${assessmentId}/reset/${candidateId}`);
      alert(`Test has been reset for ${name}. They can now use their original link to restart the assessment.`);
      fetchCandidates();
    } catch (err) {
      alert('Failed to reset test.');
    }
  };

  if (!assessmentId) {
    return <div className="text-gray-500 py-10">Save this assessment first before managing candidates.</div>;
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-dark mb-4 flex items-center">
          <UserPlus size={20} className="mr-2 text-primary" /> Invite Candidate
        </h3>
        <form onSubmit={handleInvite} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Candidate Name</label>
            <input 
              type="text" 
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="John Doe"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email Address</label>
            <input 
              type="email" 
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="john@example.com"
            />
          </div>
          <button 
            type="submit" 
            disabled={inviting || !inviteEmail || !inviteName}
            className="bg-primary hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center transition-colors disabled:opacity-50"
          >
            {inviting ? <Loader2 size={18} className="animate-spin" /> : (inviteSuccess ? <CheckCircle2 size={18} className="text-green-300" /> : 'Send Invite')}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-dark">Enrolled Candidates ({candidates.length})</h3>
          <button onClick={fetchCandidates} className="text-gray-500 hover:text-primary transition-colors p-1" title="Refresh">
            <RefreshCcw size={18} />
          </button>
        </div>
        
        {loading ? (
          <div className="p-10 text-center"><Loader2 size={24} className="animate-spin mx-auto text-primary" /></div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold">Candidate</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Score</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">No candidates have been invited yet.</td>
                </tr>
              ) : (
                candidates.map((c: any) => {
                  const result = c.results?.find((r: any) => r.assessmentId === assessmentId);
                  const isCompleted = !!result;
                  
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-dark">{c.name}</div>
                        <div className="text-sm text-gray-500">{c.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-md border ${
                          isCompleted ? 'bg-success/10 text-success border-success/20' : 
                          'bg-blue-50 text-blue-600 border-blue-200'
                        }`}>
                          {isCompleted ? 'COMPLETED' : 'INVITED'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isCompleted ? (
                          <div className="font-bold text-dark">{result.percentage}%</div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleResetTest(c.id, c.name)}
                          className="inline-flex items-center space-x-1 text-xs font-bold px-3 py-1.5 bg-red-50 text-danger hover:bg-red-100 border border-red-200 rounded transition-colors"
                        >
                          <RefreshCcw size={14} />
                          <span>Reset Test</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CandidateManager;
