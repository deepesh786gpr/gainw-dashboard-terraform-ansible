import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: string;
  requiredPermissions?: string[];
  requireAllPermissions?: boolean; // If true, user needs ALL permissions, otherwise ANY
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  requiredPermissions = [],
  requireAllPermissions = false,
}) => {
  const { isAuthenticated, isLoading, user, hasPermission, hasRole, hasAnyPermission, hasAllPermissions } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2,
          p: 3,
        }}
      >
        <Typography variant="h4" color="error">
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          You don't have the required role ({requiredRole}) to access this page.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your role: {user?.role.name}
        </Typography>
      </Box>
    );
  }

  // Check single permission requirement
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2,
          p: 3,
        }}
      >
        <Typography variant="h4" color="error">
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          You don't have the required permission ({requiredPermission}) to access this page.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your permissions: {user?.role.permissions.join(', ')}
        </Typography>
      </Box>
    );
  }

  // Check multiple permissions requirement
  if (requiredPermissions.length > 0) {
    const hasRequiredPermissions = requireAllPermissions
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);

    if (!hasRequiredPermissions) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            gap: 2,
            p: 3,
          }}
        >
          <Typography variant="h4" color="error">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            You don't have the required permissions to access this page.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Required: {requiredPermissions.join(requireAllPermissions ? ' AND ' : ' OR ')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your permissions: {user?.role.permissions.join(', ')}
          </Typography>
        </Box>
      );
    }
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
