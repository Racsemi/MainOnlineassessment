import React, { useState } from 'react';
import { Award, Star, Check, X, ShieldAlert } from 'lucide-react';

interface ScorecardModalProps {
  isOpen: boolean;
  candidateName: string;
  candidateId: string;
  onClose: () => void;
  onSubmit: (evaluation: {
    candidateId: string;
    candidateName: string;
    ratings: {
      problemSolving: number;
      codeQuality: number;
      communication: number;
      systemDesign: number;
    };
    feedback: string;
    recommendation: 'STRONG_HIRE' | 'HIRE' | 'CONSIDER' | 'REJECT';
    submittedAt: number;
  }) => void;
}

export const InterviewScorecardModal: React.FC<ScorecardModalProps> = ({
  isOpen,
  candidateName,
  candidateId,
  onClose,
  onSubmit,
}) => {
  const [problemSolving, setProblemSolving] = useState(4);
  const [codeQuality, setCodeQuality] = useState(4);
  const [communication, setCommunication] = useState(4);
  const [systemDesign, setSystemDesign] = useState(3);
  const [feedback, setFeedback] = useState('');
  const [recommendation, setRecommendation] = useState<'STRONG_HIRE' | 'HIRE' | 'CONSIDER' | 'REJECT'>('HIRE');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      candidateId,
      candidateName,
      ratings: {
        problemSolving,
        codeQuality,
        communication,
        systemDesign,
      },
      feedback,
      recommendation,
      submittedAt: Date.now(),
    });
  };

  const renderStarRating = (value: number, setter: (v: number) => void, label: string) => (
    <div className="flex items-center justify-between py-2 border-b border-white/5">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setter(star)}
            className="p-1 hover:scale-110 transition-transform"
          >
            <Star
              size={18}
              className={`${
                star <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
              } transition-colors`}
            />
          </button>
        ))}
        <span className="text-xs font-mono font-bold text-slate-400 ml-2 w-4 text-right">
          {value}
        </span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Award size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Interview Evaluation Scorecard</h3>
              <p className="text-xs text-slate-400">Candidate: <span className="text-white font-semibold">{candidateName}</span></p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Rubrics */}
          <div className="bg-slate-950/70 border border-white/10 rounded-xl p-4 space-y-1">
            {renderStarRating(problemSolving, setProblemSolving, 'Problem Solving & Logic')}
            {renderStarRating(codeQuality, setCodeQuality, 'Code Quality & Cleanliness')}
            {renderStarRating(communication, setCommunication, 'Technical Communication')}
            {renderStarRating(systemDesign, setSystemDesign, 'Data Structures & Efficiency')}
          </div>

          {/* Recommendation */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Hiring Recommendation</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'STRONG_HIRE', label: 'Strong Hire', color: 'border-emerald-500 bg-emerald-500/20 text-emerald-300' },
                { id: 'HIRE', label: 'Hire', color: 'border-blue-500 bg-blue-500/20 text-blue-300' },
                { id: 'CONSIDER', label: 'Consider', color: 'border-amber-500 bg-amber-500/20 text-amber-300' },
                { id: 'REJECT', label: 'Reject', color: 'border-red-500 bg-red-500/20 text-red-300' },
              ].map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setRecommendation(rec.id as any)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                    recommendation === rec.id
                      ? `${rec.color} ring-2 ring-white/20`
                      : 'bg-slate-950/60 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {rec.label}
                </button>
              ))}
            </div>
          </div>

          {/* Private Notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">Interviewer Private Notes</label>
              <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                <ShieldAlert size={12} className="text-primary" />
                <span>Confidential (Admin only)</span>
              </span>
            </div>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Provide comments on problem approach, code elegance, edge-case testing, etc..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
            >
              <Check size={15} />
              <span>Submit & Conclude Interview</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default InterviewScorecardModal;
