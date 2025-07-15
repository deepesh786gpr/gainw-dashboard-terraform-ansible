import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Visibility,
  GitHub,
  CheckCircle,
  Error,
  Warning,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

interface GitHubToken {
  id: string;
  token_name: string;
  metadata: {
    github_user: {
      login: string;
      name: string;
      avatar_url: string;
    };
    scopes: string[];
    description: string;
    added_at: string;
  };
  expires_at?: string;
  last_used?: string;
  is_active: boolean;
  created_at: string;
}

const GitHubTokens: React.FC = () => {
  const [tokens, setTokens] = useState<GitHubToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingToken, setEditingToken] = useState<GitHubToken | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    token: '',
    description: '',
    skipValidation: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const { tokens: authTokens } = useAuth();
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/github/tokens`, {
        headers: {
          'Authorization': `Bearer ${authTokens?.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(Array.isArray(data) ? data : data.tokens || []);
      } else {
        setError('Failed to fetch GitHub tokens');
      }
    } catch (err) {
      setError('Error fetching GitHub tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (token?: GitHubToken) => {
    if (token) {
      setEditingToken(token);
      setFormData({
        name: token.token_name,
        token: '',
        description: token.metadata?.description || '',
        skipValidation: false,
      });
    } else {
      setEditingToken(null);
      setFormData({
        name: '',
        token: '',
        description: '',
        skipValidation: false,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingToken(null);
    setFormData({ name: '', token: '', description: '', skipValidation: false });
    setError('');
  };

  const handleSubmit = async () => {
    if (!formData.name || (!editingToken && !formData.token)) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const url = editingToken
        ? `${API_BASE_URL}/api/github/tokens/${editingToken.id}`
        : `${API_BASE_URL}/api/github/tokens`;

      const method = editingToken ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${authTokens?.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          token: formData.token || undefined,
          description: formData.description,
          skipValidation: formData.skipValidation,
        }),
      });

      if (response.ok) {
        await fetchTokens();
        handleCloseDialog();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save token');
      }
    } catch (err) {
      setError('Error saving token');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tokenId: string) => {
    if (!window.confirm('Are you sure you want to delete this GitHub token?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/github/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authTokens?.accessToken}`,
        },
      });

      if (response.ok) {
        await fetchTokens();
      } else {
        setError('Failed to delete token');
      }
    } catch (err) {
      setError('Error deleting token');
    }
  };

  const handleTest = async (tokenId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/github/tokens/${tokenId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authTokens?.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          alert('Token is valid and working!');
        } else {
          alert(`Token validation failed: ${data.error}`);
        }
      }
    } catch (err) {
      alert('Error testing token');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getScopeColor = (scope: string) => {
    if (scope.includes('repo')) return 'error';
    if (scope.includes('admin')) return 'warning';
    return 'info';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          GitHub Tokens
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Token
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>GitHub User</TableCell>
                  <TableCell>Scopes</TableCell>
                  <TableCell>Last Used</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tokens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Box py={4}>
                        <GitHub sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          No GitHub tokens configured
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Add a GitHub token to import repositories and templates
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  tokens.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <GitHub sx={{ mr: 1, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="subtitle2">
                              {token.token_name}
                            </Typography>
                            {token.metadata?.description && (
                              <Typography variant="caption" color="text.secondary">
                                {token.metadata.description}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <img
                            src={token.metadata?.github_user?.avatar_url}
                            alt="Avatar"
                            style={{ width: 24, height: 24, borderRadius: '50%', marginRight: 8 }}
                          />
                          <Box>
                            <Typography variant="body2">
                              {token.metadata?.github_user?.name || token.metadata?.github_user?.login}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              @{token.metadata?.github_user?.login}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {token.metadata?.scopes?.slice(0, 3).map((scope) => (
                            <Chip
                              key={scope}
                              label={scope}
                              size="small"
                              color={getScopeColor(scope) as any}
                              variant="outlined"
                            />
                          ))}
                          {token.metadata?.scopes?.length > 3 && (
                            <Chip
                              label={`+${token.metadata.scopes.length - 3}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {token.last_used ? formatDate(token.last_used) : 'Never'}
                      </TableCell>
                      <TableCell>
                        {formatDate(token.created_at)}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Test Token">
                          <IconButton
                            size="small"
                            onClick={() => handleTest(token.id)}
                            color="primary"
                          >
                            <CheckCircle />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Token">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(token)}
                            color="primary"
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Token">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(token.id)}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingToken ? 'Edit GitHub Token' : 'Add GitHub Token'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <TextField
            fullWidth
            label="Token Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
            helperText="A friendly name for this token"
          />
          
          {!editingToken && (
            <>
              <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>How to create a GitHub Personal Access Token:</strong>
                </Typography>
                <Typography variant="body2" component="div">
                  1. Go to GitHub Settings → Developer settings → Personal access tokens<br/>
                  2. Click "Generate new token (classic)"<br/>
                  3. Give it a name and select scopes (repo, user recommended)<br/>
                  4. Copy the token and paste it below
                </Typography>
              </Alert>

              <TextField
                fullWidth
                label="GitHub Personal Access Token"
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                margin="normal"
                required
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                helperText="Your GitHub Personal Access Token (starts with ghp_)"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.skipValidation}
                    onChange={(e) => setFormData({ ...formData, skipValidation: e.target.checked })}
                    color="primary"
                  />
                }
                label="Skip validation (for testing)"
                sx={{ mt: 1 }}
              />
              {formData.skipValidation && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Token validation will be skipped. Use this only for testing purposes.
                </Alert>
              )}
            </>
          )}

          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={2}
            helperText="Optional description for this token"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={20} /> : (editingToken ? 'Update' : 'Add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GitHubTokens;
