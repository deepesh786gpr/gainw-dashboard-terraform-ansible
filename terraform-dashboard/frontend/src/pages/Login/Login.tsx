import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Container,
  Paper,
  Divider,
  Link,
} from '@mui/material';
import { Lock, Person, Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    console.log('Login form submitted');
    console.log('Username:', username);
    console.log('Remember me:', rememberMe);

    try {
      console.log('Calling login function...');
      await login(username, password, rememberMe);
      console.log('Login function completed successfully');
      // Navigation will be handled by the useEffect above
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
        }}
      >
        <Paper
          elevation={8}
          sx={{
            p: 4,
            width: '100%',
            maxWidth: 400,
            borderRadius: 2,
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Lock
                sx={{
                  fontSize: 40,
                  color: 'primary.main',
                  mr: 1,
                }}
              />
              <Typography variant="h4" component="h1" fontWeight="bold">
                Terraform
              </Typography>
            </Box>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Dashboard Login
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to manage your infrastructure
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Login Form */}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username or Email"
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <Person sx={{ color: 'text.secondary', mr: 1 }} />
                ),
              }}
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <Lock sx={{ color: 'text.secondary', mr: 1 }} />
                ),
                endAdornment: (
                  <Button
                    onClick={handleTogglePasswordVisibility}
                    sx={{ minWidth: 'auto', p: 1 }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </Button>
                ),
              }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  color="primary"
                />
              }
              label="Remember me for 7 days"
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading || !username || !password}
              sx={{
                py: 1.5,
                mb: 2,
                fontWeight: 'bold',
                textTransform: 'none',
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Default Credentials Info */}
          <Card variant="outlined" sx={{ bgcolor: 'grey.50' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" gutterBottom color="primary">
                Default Admin Credentials:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Username:</strong> admin
                <br />
                <strong>Password:</strong> admin123
              </Typography>
              <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                ⚠️ Please change the password after first login!
              </Typography>
            </CardContent>
          </Card>

          {/* Footer */}
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Need help?{' '}
              <Link href="#" color="primary">
                Contact Support
              </Link>
            </Typography>
          </Box>
        </Paper>

        {/* Version Info */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 2, textAlign: 'center' }}
        >
          Terraform Dashboard v1.0.0
          <br />
          Powered by React & Material-UI
        </Typography>
      </Box>
    </Container>
  );
};

export default Login;
