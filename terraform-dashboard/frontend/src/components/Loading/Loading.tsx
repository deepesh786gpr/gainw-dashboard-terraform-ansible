import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Skeleton,
  Card,
  CardContent,
  Grid,
} from '@mui/material';

interface LoadingProps {
  type?: 'spinner' | 'skeleton' | 'card' | 'table';
  message?: string;
  size?: 'small' | 'medium' | 'large';
  rows?: number;
  fullScreen?: boolean;
}

const Loading: React.FC<LoadingProps> = ({
  type = 'spinner',
  message = 'Loading...',
  size = 'medium',
  rows = 5,
  fullScreen = false,
}) => {
  const getSpinnerSize = () => {
    switch (size) {
      case 'small': return 24;
      case 'large': return 60;
      default: return 40;
    }
  };

  const containerProps = fullScreen
    ? {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        zIndex: 9999,
      }
    : {};

  if (type === 'spinner') {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        p={3}
        minHeight={fullScreen ? '100vh' : '200px'}
        {...containerProps}
      >
        <CircularProgress size={getSpinnerSize()} />
        {message && (
          <Typography variant="body2" color="textSecondary" mt={2}>
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  if (type === 'skeleton') {
    return (
      <Box p={2}>
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            height={40}
            sx={{ mb: 1, borderRadius: 1 }}
          />
        ))}
      </Box>
    );
  }

  if (type === 'card') {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: rows }).map((_, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="60%" height={24} />
                <Skeleton variant="text" width="100%" height={20} sx={{ mt: 1 }} />
                <Skeleton variant="text" width="80%" height={20} />
                <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (type === 'table') {
    return (
      <Box>
        {/* Table header */}
        <Box display="flex" gap={2} mb={2}>
          <Skeleton variant="text" width="20%" height={32} />
          <Skeleton variant="text" width="30%" height={32} />
          <Skeleton variant="text" width="25%" height={32} />
          <Skeleton variant="text" width="25%" height={32} />
        </Box>
        
        {/* Table rows */}
        {Array.from({ length: rows }).map((_, index) => (
          <Box key={index} display="flex" gap={2} mb={1}>
            <Skeleton variant="text" width="20%" height={24} />
            <Skeleton variant="text" width="30%" height={24} />
            <Skeleton variant="text" width="25%" height={24} />
            <Skeleton variant="text" width="25%" height={24} />
          </Box>
        ))}
      </Box>
    );
  }

  return null;
};

// Specialized loading components
export const PageLoading: React.FC<{ message?: string }> = ({ message }) => (
  <Loading type="spinner" size="large" message={message} />
);

export const CardLoading: React.FC<{ rows?: number }> = ({ rows }) => (
  <Loading type="card" rows={rows} />
);

export const TableLoading: React.FC<{ rows?: number }> = ({ rows }) => (
  <Loading type="table" rows={rows} />
);

export const SkeletonLoading: React.FC<{ rows?: number }> = ({ rows }) => (
  <Loading type="skeleton" rows={rows} />
);

export const FullScreenLoading: React.FC<{ message?: string }> = ({ message }) => (
  <Loading type="spinner" size="large" message={message} fullScreen />
);

export default Loading;
