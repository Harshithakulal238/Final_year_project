import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import SignInPage from '../pages/SignInPage';
import RegisterPage from '../pages/RegisterPage';
import ProfileRegistrationPage from '../pages/ProfileRegistrationPage';
import DashboardPage from '../pages/DashboardPage';
import SchemeDetailPage from '../pages/SchemeDetailPage';
import ProfileUpdatePage from '../pages/ProfileUpdatePage';
import BookmarksPage from '../pages/BookmarksPage';
import ProtectedRoute from '../components/ProtectedRoute';

function AppRoutes({ showToast, setLoading }) {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SignInPage showToast={showToast} />} />
      <Route path="/register" element={<RegisterPage showToast={showToast} />} />
      <Route path="/profile" element={<ProfileRegistrationPage showToast={showToast} setLoading={setLoading} />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage showToast={showToast} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scheme/:id"
        element={
          <ProtectedRoute>
            <SchemeDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/edit"
        element={
          <ProtectedRoute>
            <ProfileUpdatePage showToast={showToast} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookmarks"
        element={
          <ProtectedRoute>
            <BookmarksPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
