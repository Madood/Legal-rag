// Auth state is managed via AuthContext (React Context + hooks).
// Re-export the hook and provider for convenience.
export { useAuth, AuthProvider } from '../context/AuthContext';
export type { AuthUser, TokenInfo } from '../context/AuthContext';
