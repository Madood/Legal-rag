import { Navigate, BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './components/screens/Home/Home';
import { Signup } from './components/Auth/signup/signup';
import { Login } from './components/Auth/login/login';
import { AppLayout } from './components/layout/AppLayout';
import { Layout } from './components/layout/Layout';
import { ChatScreen } from './components/screens/chat/chatScreen/ChatScreen';
import { DocumentManagement } from './components/screens/documents/DocumentManagement';
import { ProfilePage } from './components/screens/profile/ProfilePage';
import { SettingsPanel } from './components/screens/settings/SettingsPanel';
import { AnalyticsDashboard } from './components/screens/analytics/AnalyticsDashboard';
import { PricingPage } from './components/screens/pricing/PricingPage';
import { LanguageProvider } from './i18n';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null; // or a spinner
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
      </Route>
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/pricing" element={<PricingPage />} />

      {/* Protected routes with AppLayout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="chat" element={<ChatScreen />} />
        <Route path="documents" element={<DocumentManagement />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPanel />} />
      </Route>

      <Route path="*" element={<div>404 - Page Not Found</div>} />
    </Routes>
  );
}

function App() {
  return (
    <LanguageProvider>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </LanguageProvider>
  );
}

export default App;
