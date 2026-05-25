import { Navigate, BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage/LandingPage';
import { Signup } from './components/features/auth/Signup/Signup';
import { Login } from './components/features/auth/Login/Login';
import { AppLayout } from './components/layout/AppLayout';
import { ChatScreen } from './components/features/chat/ChatScreen/ChatScreen';
import { DocumentManagement } from './components/screens/documents/DocumentManagement';
import { ProfilePage } from './components/screens/profile/ProfilePage';
import { SettingsPanel } from './components/screens/settings/SettingsPanel';
import { AnalyticsDashboard } from './components/screens/analytics/AnalyticsDashboard';
import { PricingPage } from './components/screens/pricing/PricingPage';
import { ForgotPassword } from './components/features/auth/ForgotPassword/ForgotPassword';
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
      {/* Public landing page (self-contained, no Layout wrapper) */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Public pages that use the app shell (Header) */}
      <Route path="/" element={<AppLayout />}>
        <Route path="pricing" element={<PricingPage />} />
      </Route>

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
