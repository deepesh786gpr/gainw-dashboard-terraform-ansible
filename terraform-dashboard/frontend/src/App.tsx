import React, { useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppSelector, useAppDispatch } from './store';
import { updateResponsive } from './store/slices/uiSlice';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Deployments from './pages/Deployments/Deployments';
import Templates from './pages/Templates/Templates';
import GitHubImport from './pages/GitHubImport/GitHubImport';
import TestIntegration from './pages/GitHubImport/TestIntegration';
import GitHubTokens from './pages/GitHubTokens';
import Instances from './pages/Instances/Instances';
import VPCResources from './pages/VPCResources/VPCResources';
import AnsibleScripts from './pages/AnsibleScripts/AnsibleScripts';
import AnsibleExecution from './pages/AnsibleExecution/AnsibleExecution';
import Clusters from './pages/Clusters/Clusters';
import Settings from './pages/Settings/Settings';
import CostAnalysis from './pages/CostAnalysis/CostAnalysis';
import SecurityCenter from './pages/SecurityCenter/SecurityCenter';
import NotificationSystem from './components/NotificationSystem/NotificationSystem';
import { createAppTheme } from './theme/theme';

// Theme and responsive logic moved to separate component
const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { theme: themeMode } = useAppSelector((state) => state.ui);

  // Create theme based on current mode
  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);

  // Handle responsive breakpoints
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      let breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'lg';
      let isMobile = false;
      let isTablet = false;
      let isDesktop = true;

      if (width < 600) {
        breakpoint = 'xs';
        isMobile = true;
        isDesktop = false;
      } else if (width < 900) {
        breakpoint = 'sm';
        isTablet = true;
        isDesktop = false;
      } else if (width < 1200) {
        breakpoint = 'md';
      } else if (width < 1536) {
        breakpoint = 'lg';
      } else {
        breakpoint = 'xl';
      }

      dispatch(updateResponsive({
        isMobile,
        isTablet,
        isDesktop,
        breakpoint,
      }));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Router>
          <ErrorBoundary>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />

              {/* Protected routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <Navigate to="/dashboard" replace />
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary><Dashboard /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/deployments" element={
                <ProtectedRoute requiredPermissions={['deployments:read']}>
                  <Layout>
                    <ErrorBoundary><Deployments /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/templates" element={
                <ProtectedRoute requiredPermissions={['templates:read']}>
                  <Layout>
                    <ErrorBoundary><Templates /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/ansible-scripts" element={
                <ProtectedRoute requiredPermissions={['templates:read']}>
                  <Layout>
                    <ErrorBoundary><AnsibleScripts /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/ansible-execution" element={
                <ProtectedRoute requiredPermissions={['templates:read']}>
                  <Layout>
                    <ErrorBoundary><AnsibleExecution /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/github-import" element={
                <ProtectedRoute requiredPermissions={['github:read', 'templates:write']} requireAllPermissions>
                  <Layout>
                    <ErrorBoundary><GitHubImport /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/test-integration" element={
                <ProtectedRoute requiredPermissions={['github:read', 'templates:write']} requireAllPermissions>
                  <Layout>
                    <ErrorBoundary><TestIntegration /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/github-tokens" element={
                <ProtectedRoute requiredPermissions={['github:read']}>
                  <Layout>
                    <ErrorBoundary><GitHubTokens /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/instances" element={
                <ProtectedRoute requiredPermissions={['instances:read']}>
                  <Layout>
                    <ErrorBoundary><Instances /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/vpc-resources" element={
                <ProtectedRoute requiredPermissions={['instances:read']}>
                  <Layout>
                    <ErrorBoundary><VPCResources /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/clusters" element={
                <ProtectedRoute requiredPermissions={['instances:read']}>
                  <Layout>
                    <ErrorBoundary><Clusters /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/cost-analysis" element={
                <ProtectedRoute requiredPermissions={['aws:read']}>
                  <Layout>
                    <ErrorBoundary><CostAnalysis /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/security-center" element={
                <ProtectedRoute requiredPermissions={['aws:read']}>
                  <Layout>
                    <ErrorBoundary><SecurityCenter /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/settings" element={
                <ProtectedRoute requiredPermissions={['settings:read']}>
                  <Layout>
                    <ErrorBoundary><Settings /></ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              } />
            </Routes>
          </ErrorBoundary>
          <NotificationSystem />
        </Router>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Provider>
  );
}

export default App;
