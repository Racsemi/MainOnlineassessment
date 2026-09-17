import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './features/admin/AdminLayout';
import AssessmentsList from './features/admin/AssessmentsList';
import AssessmentEditor from './features/admin/AssessmentEditor';
import QuestionsList from './features/admin/QuestionsList';
import QuestionEditor from './features/admin/QuestionEditor';
import CandidatesList from './features/admin/CandidatesList';
import ResultsView from './features/admin/ResultsView';
import PlatformSettings from './features/admin/PlatformSettings';
import CandidatePortal from './features/candidate/CandidatePortal';
import PublicRegistration from './features/candidate/PublicRegistration';
import Login from './features/auth/Login';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/assessments" replace />} />
          <Route path="assessments" element={<AssessmentsList />} />
          <Route path="assessments/new" element={<AssessmentEditor />} />
          <Route path="assessments/:id" element={<AssessmentEditor />} />
          <Route path="assessments/:id/results" element={<ResultsView />} />
          
          <Route path="questions" element={<QuestionsList />} />
          <Route path="questions/new" element={<QuestionEditor />} />
          <Route path="questions/:id" element={<QuestionEditor />} />

          <Route path="candidates" element={<CandidatesList />} />
          <Route path="settings" element={<PlatformSettings />} />
        </Route>
        
        {/* Candidate Routes */}
        <Route path="/register/:id" element={<PublicRegistration />} />
        <Route path="/test/:token" element={<CandidatePortal />} />
        
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
