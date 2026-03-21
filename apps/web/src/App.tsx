import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { PlanPage } from './pages/PlanPage';
import { SignupPage } from './pages/SignupPage';

export function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/plan"
          element={
            <ProtectedRoute>
              <PlanPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/:routeRequestId"
          element={
            <ProtectedRoute>
              <LegacyResultsRedirect />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

function LegacyResultsRedirect() {
  const { routeRequestId } = useParams<{ routeRequestId: string }>();
  const encodedId = routeRequestId ? encodeURIComponent(routeRequestId) : '';
  const search = encodedId ? `?routeRequestId=${encodedId}` : '';

  return <Navigate to={`/plan${search}`} replace />;
}
