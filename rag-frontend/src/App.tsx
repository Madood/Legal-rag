import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './components/screens/Home/Home';
import { Signup } from './components/Auth/signup/signup';
import { Login } from './components/Auth/login/login';
import { AppLayout } from './components/layout/AppLayout';
import { Layout } from './components/layout/Layout';
import { ChatScreen } from './components/screens/chat/chatScreen/ChatScreen';
import { DocumentManagement } from './components/screens/documents/DocumentManagement';
import { ProfilePage } from './components/screens/profile/ProfilePage';
import { SettingsPanel } from './components/screens/settings/SettingsPanel';

// Import Analytics component (you'll need to create this)
// In your App.tsx
import { AnalyticsDashboard } from './components/screens/analytics/AnalyticsDashboard';


// Create a protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  
  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes without AppLayout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
        </Route>
        
        {/* Auth pages - no layout */}
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        
        {/* Protected routes with AppLayout */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          <Route path="chat" element={<ChatScreen />} />
          <Route path="documents" element={<DocumentManagement />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPanel />} />
        </Route>
        
        {/* 404 route */}
        <Route path="*" element={<div>404 - Page Not Found</div>} />
      </Routes>
    </Router>
  );
}

export default App;