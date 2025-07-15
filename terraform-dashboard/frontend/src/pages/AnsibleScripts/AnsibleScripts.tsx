import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  CloudUpload as UploadIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://192.168.31.94:5000';

interface AnsibleScript {
  id: string;
  name: string;
  description: string;
  terraform_code: string; // This will contain the Ansible YAML content
  category: string;
  template_type: string;
  created_at: string;
  updated_at: string;
}

const AnsibleScripts: React.FC = () => {
  const [scripts, setScripts] = useState<AnsibleScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedScript, setSelectedScript] = useState<AnsibleScript | null>(null);
  const { tokens } = useAuth();

  const fetchAnsibleScripts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates`, {
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const allTemplates = await response.json();
      // Filter for Ansible templates
      const ansibleTemplates = allTemplates.filter((template: AnsibleScript) => 
        template.template_type === 'ansible' || template.category === 'ansible'
      );
      
      setScripts(ansibleTemplates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Ansible scripts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnsibleScripts();
  }, []);

  // Auto-refresh when tokens change (user logs in) or when page becomes visible
  useEffect(() => {
    if (tokens?.accessToken) {
      fetchAnsibleScripts();
    }
  }, [tokens?.accessToken]);

  // Auto-refresh when page becomes visible (user returns from another page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && tokens?.accessToken) {
        fetchAnsibleScripts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tokens?.accessToken]);

  const handleViewScript = (script: AnsibleScript) => {
    setSelectedScript(script);
    setViewDialogOpen(true);
  };

  const handleCloseViewDialog = () => {
    setViewDialogOpen(false);
    setSelectedScript(null);
  };

  const getScriptLanguage = (content: string) => {
    if (content.includes('---') && (content.includes('hosts:') || content.includes('tasks:'))) {
      return 'yaml';
    }
    return 'text';
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          ⚙️ Ansible Scripts
        </Typography>
        <Box>
          <Tooltip title="Import from GitHub">
            <IconButton 
              color="primary" 
              onClick={() => window.location.href = '/github-import'}
              sx={{ mr: 1 }}
            >
              <GitHubIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh Scripts">
            <IconButton onClick={fetchAnsibleScripts} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {scripts.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <UploadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Ansible Scripts Found
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Import Ansible playbooks and scripts from GitHub repositories to get started.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<GitHubIcon />}
                  onClick={() => window.location.href = '/github-import'}
                >
                  Import from GitHub
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {scripts.map((script) => (
                <Grid item xs={12} md={6} lg={4} key={script.id}>
                  <Card>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                        <Typography variant="h6" component="h2">
                          {script.name}
                        </Typography>
                        <Chip 
                          label="Ansible" 
                          color="secondary" 
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {script.description || 'No description available'}
                      </Typography>
                      
                      <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                        Created: {new Date(script.created_at).toLocaleDateString()}
                      </Typography>
                      
                      <Box display="flex" gap={1}>
                        <Tooltip title="View Script">
                          <IconButton 
                            size="small" 
                            onClick={() => handleViewScript(script)}
                            color="primary"
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Script">
                          <IconButton size="small" color="primary">
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Run Playbook">
                          <IconButton size="small" color="success">
                            <PlayIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Script">
                          <IconButton size="small" color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Script View Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={handleCloseViewDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6">
              {selectedScript?.name}
            </Typography>
            <Chip label="Ansible" color="secondary" size="small" />
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedScript && (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {selectedScript.description}
              </Typography>
              
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">📄 Ansible Content</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    fullWidth
                    multiline
                    rows={20}
                    value={selectedScript.terraform_code}
                    InputProps={{
                      readOnly: true,
                      style: { 
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        backgroundColor: '#f5f5f5'
                      }
                    }}
                    variant="outlined"
                  />
                </AccordionDetails>
              </Accordion>
              
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">
                  Created: {new Date(selectedScript.created_at).toLocaleString()}
                  {selectedScript.updated_at !== selectedScript.created_at && (
                    <> • Updated: {new Date(selectedScript.updated_at).toLocaleString()}</>
                  )}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseViewDialog}>Close</Button>
          <Button variant="contained" startIcon={<EditIcon />}>
            Edit Script
          </Button>
          <Button variant="contained" color="success" startIcon={<PlayIcon />}>
            Run Playbook
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnsibleScripts;
