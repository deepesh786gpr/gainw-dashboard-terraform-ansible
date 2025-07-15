import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  BugReport as BugIcon,
} from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Send error to monitoring service (if available)
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In a real app, you would send this to your error monitoring service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: this.state.errorId,
    };

    // Log to console for now
    console.error('Error logged:', errorData);

    // You could send to services like Sentry, LogRocket, etc.
    // Example: Sentry.captureException(error, { extra: errorData });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="400px"
          p={3}
        >
          <Card sx={{ maxWidth: 600, width: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ErrorIcon color="error" sx={{ mr: 2, fontSize: 32 }} />
                <Typography variant="h5" color="error">
                  Something went wrong
                </Typography>
              </Box>

              <Alert severity="error" sx={{ mb: 3 }}>
                An unexpected error occurred in the application. This has been logged for investigation.
              </Alert>

              <Typography variant="body1" color="textSecondary" mb={3}>
                Error ID: <code>{this.state.errorId}</code>
              </Typography>

              <Box display="flex" gap={2} mb={3}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleRetry}
                  color="primary"
                >
                  Try Again
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReload}
                >
                  Reload Page
                </Button>
              </Box>

              {/* Error Details (for development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center">
                      <BugIcon sx={{ mr: 1 }} />
                      <Typography>Error Details (Development)</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Error Message:
                      </Typography>
                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{
                          backgroundColor: 'grey.100',
                          p: 1,
                          borderRadius: 1,
                          fontSize: '0.8rem',
                          mb: 2,
                          overflow: 'auto',
                        }}
                      >
                        {this.state.error.message}
                      </Typography>

                      <Typography variant="subtitle2" gutterBottom>
                        Stack Trace:
                      </Typography>
                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{
                          backgroundColor: 'grey.100',
                          p: 1,
                          borderRadius: 1,
                          fontSize: '0.7rem',
                          mb: 2,
                          overflow: 'auto',
                          maxHeight: 200,
                        }}
                      >
                        {this.state.error.stack}
                      </Typography>

                      {this.state.errorInfo && (
                        <>
                          <Typography variant="subtitle2" gutterBottom>
                            Component Stack:
                          </Typography>
                          <Typography
                            variant="body2"
                            component="pre"
                            sx={{
                              backgroundColor: 'grey.100',
                              p: 1,
                              borderRadius: 1,
                              fontSize: '0.7rem',
                              overflow: 'auto',
                              maxHeight: 200,
                            }}
                          >
                            {this.state.errorInfo.componentStack}
                          </Typography>
                        </>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              <Typography variant="body2" color="textSecondary" mt={2}>
                If this problem persists, please contact support with the Error ID above.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
