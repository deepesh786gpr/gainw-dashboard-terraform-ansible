import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  GitHub as GitHubIcon,
  Search as SearchIcon,
  Code as CodeIcon,
  CloudDownload as ImportIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Folder as FolderIcon,
  Description as FileIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  language: string;
  updated_at: string;
}

interface TerraformFile {
  name: string;
  path: string;
  variableCount: number;
  resourceCount: number;
}

interface RepoAnalysis {
  hasTerraform: boolean;
  hasAnsible?: boolean;
  fileCount: number;
  files: TerraformFile[];
  terraformFiles?: string[];
  ansibleFiles?: string[];
  totalVariables: number;
  totalResources: number;
  suggestedName: string;
  mainFiles: string[];
  message?: string;
  fileType?: 'terraform' | 'ansible';
}

const GitHubImport: React.FC = () => {
  const { tokens } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [githubToken, setGithubToken] = useState('');
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('terraform');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [repoAnalysis, setRepoAnalysis] = useState<RepoAnalysis | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [mainFile, setMainFile] = useState('main.tf');
  const [templateType, setTemplateType] = useState<'terraform' | 'ansible'>('terraform');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [repoSource, setRepoSource] = useState<'search' | 'user' | 'org'>('user');
  const [orgName, setOrgName] = useState('');

  const steps = [
    'Connect GitHub',
    'Select Repository',
    'Analyze Code',
    'Create Template'
  ];

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    return headers;
  };

  // Validate GitHub token
  const validateToken = async () => {
    if (!githubToken.trim()) {
      setError('Please enter a GitHub token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/github/validate-token`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ token: githubToken }),
      });

      const result = await response.json();

      if (result.valid) {
        setTokenValid(true);
        setUserInfo(result.user);
        setActiveStep(1);
      } else {
        setError('Invalid GitHub token. Please check your token and try again.');
      }
    } catch (error) {
      setError('Failed to validate GitHub token. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Search public repositories
  const searchRepositories = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/github/search?q=${encodeURIComponent(searchQuery)}&limit=20&token=${githubToken}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to search repositories');
      }

      const repos = await response.json();
      console.log('Search response:', repos);

      if (repos.repositories && Array.isArray(repos.repositories)) {
        setRepositories(repos.repositories);
      } else if (repos.items && Array.isArray(repos.items)) {
        setRepositories(repos.items);
      } else {
        console.error('Invalid search response format:', repos);
        setRepositories([]);
        setError('Invalid response format from GitHub API.');
      }
    } catch (error) {
      console.error('Search error:', error);
      setRepositories([]);
      setError('Failed to search repositories. Please check your token and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user's own repositories (including private ones)
  const fetchUserRepositories = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/github/user/repos?token=${githubToken}&type=all&sort=updated&per_page=50`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user repositories');
      }

      const repos = await response.json();
      console.log('User repos response:', repos);

      // Handle both direct array response and wrapped response
      if (repos.repositories && Array.isArray(repos.repositories)) {
        setRepositories(repos.repositories);
      } else if (Array.isArray(repos)) {
        setRepositories(repos);
      } else {
        console.error('Invalid user repos response format:', repos);
        setRepositories([]);
        setError('Invalid response format from GitHub API.');
      }
    } catch (error) {
      console.error('User repos error:', error);
      setRepositories([]);
      setError('Failed to fetch your repositories. Please check your token and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch organization repositories
  const fetchOrgRepositories = async () => {
    if (!orgName.trim()) {
      setError('Please enter an organization name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/github/orgs/${encodeURIComponent(orgName)}/repos?token=${githubToken}&type=all&sort=updated&per_page=50`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch repositories for organization ${orgName}`);
      }

      const repos = await response.json();
      console.log('Org repos response:', repos);

      // Handle both direct array response and wrapped response
      if (repos.repositories && Array.isArray(repos.repositories)) {
        setRepositories(repos.repositories);
      } else if (Array.isArray(repos)) {
        setRepositories(repos);
      } else {
        console.error('Invalid org repos response format:', repos);
        setRepositories([]);
        setError('Invalid response format from GitHub API.');
      }
    } catch (error) {
      console.error('Org repos error:', error);
      setRepositories([]);
      setError(`Failed to fetch repositories for organization ${orgName}. Please check the organization name and your access.`);
    } finally {
      setLoading(false);
    }
  };

  // Generic function to load repositories based on source
  const loadRepositories = async () => {
    switch (repoSource) {
      case 'user':
        await fetchUserRepositories();
        break;
      case 'org':
        await fetchOrgRepositories();
        break;
      case 'search':
        await searchRepositories();
        break;
    }
  };

  // Analyze repository
  const analyzeRepository = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setLoading(true);
    setError('');

    try {
      const [owner, repoName] = repo.full_name.split('/');
      const response = await fetch(
        `${API_BASE_URL}/api/github/repos/${owner}/${repoName}/analyze`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ token: githubToken }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to analyze repository');
      }

      const analysis = await response.json();
      setRepoAnalysis(analysis);

      if (analysis.hasTerraform || analysis.hasAnsible) {
        setTemplateName(analysis.suggestedName);
        setTemplateDescription(`Template imported from ${repo.full_name}`);

        // Set template type and main file based on what was found
        if (analysis.fileType === 'ansible' || (!analysis.hasTerraform && analysis.hasAnsible)) {
          setTemplateType('ansible');
          setMainFile(analysis.mainFiles[0] || 'playbook.yml');
        } else {
          setTemplateType('terraform');
          setMainFile(analysis.mainFiles[0] || 'main.tf');
        }

        setActiveStep(2);
      } else {
        setError(analysis.message || 'No Terraform or Ansible files found in this repository');
      }
    } catch (error) {
      setError('Failed to analyze repository. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Create template from repository
  const createTemplate = async () => {
    if (!selectedRepo || !repoAnalysis) return;

    setLoading(true);
    setError('');

    try {
      const [owner, repoName] = selectedRepo.full_name.split('/');

      // Choose the correct endpoint based on template type
      const endpoint = templateType === 'ansible'
        ? `${API_BASE_URL}/api/github/repos/${owner}/${repoName}/create-ansible-template`
        : `${API_BASE_URL}/api/github/repos/${owner}/${repoName}/create-template`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          templateName,
          description: templateDescription,
          mainFile,
          token: githubToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create template');
      }

      const template = await response.json();
      setActiveStep(3);

      // Show success message with navigation options
      setTimeout(() => {
        const createdTemplateType = template.template?.type || templateType;
        const message = `Template "${templateName}" created successfully!\n\nWould you like to view it now?`;

        if (window.confirm(message)) {
          // Navigate to the appropriate page
          if (createdTemplateType === 'ansible') {
            window.location.href = '/ansible-scripts';
          } else {
            window.location.href = '/templates';
          }
        } else {
          // Reset the form for another import
          resetForm();
        }
      }, 1000);
    } catch (error) {
      setError('Failed to create template. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setActiveStep(0);
    setGithubToken('');
    setTokenValid(false);
    setUserInfo(null);
    setRepositories([]);
    setSelectedRepo(null);
    setRepoAnalysis(null);
    setTemplateName('');
    setTemplateDescription('');
    setMainFile('main.tf');
    setError('');
  };

  useEffect(() => {
    if (tokenValid && activeStep === 1) {
      loadRepositories();
    }
  }, [tokenValid, activeStep, repoSource]);

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        <GitHubIcon sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4">Import from GitHub</Typography>
      </Box>

      <Typography variant="body1" color="textSecondary" mb={4}>
        Import Terraform code from your GitHub repositories and automatically create templates.
        This feature makes it easy to convert existing Infrastructure as Code into reusable templates.
      </Typography>

      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Step 1: Connect GitHub */}
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Connect to GitHub
              </Typography>
              <Typography variant="body2" color="textSecondary" mb={3}>
                Enter your GitHub Personal Access Token to access your repositories.
                You can create one at: https://github.com/settings/tokens
              </Typography>
              
              <TextField
                fullWidth
                label="GitHub Personal Access Token"
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                sx={{ mb: 3 }}
              />
              
              <Button
                variant="contained"
                onClick={validateToken}
                disabled={loading || !githubToken.trim()}
                startIcon={loading ? <CircularProgress size={20} /> : <GitHubIcon />}
              >
                {loading ? 'Validating...' : 'Connect GitHub'}
              </Button>
            </Box>
          )}

          {/* Step 2: Select Repository */}
          {activeStep === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Select Repository
              </Typography>
              
              {userInfo && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  Connected as {userInfo.name || userInfo.login} ({userInfo.public_repos} public repos)
                </Alert>
              )}

              {/* Repository Source Selection */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Repository Source
                  </Typography>

                  <Tabs
                    value={repoSource}
                    onChange={(e, newValue) => setRepoSource(newValue)}
                    sx={{ mb: 2 }}
                  >
                    <Tab
                      value="user"
                      label="My Repositories"
                      icon={<PersonIcon />}
                    />
                    <Tab
                      value="org"
                      label="Organization"
                      icon={<BusinessIcon />}
                    />
                    <Tab
                      value="search"
                      label="Search Public"
                      icon={<SearchIcon />}
                    />
                  </Tabs>

                  {repoSource === 'search' && (
                    <Box display="flex" gap={2}>
                      <TextField
                        fullWidth
                        label="Search public repositories"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="terraform, aws, infrastructure..."
                      />
                      <Button
                        variant="outlined"
                        onClick={loadRepositories}
                        disabled={loading}
                        startIcon={<SearchIcon />}
                      >
                        Search
                      </Button>
                    </Box>
                  )}

                  {repoSource === 'org' && (
                    <Box display="flex" gap={2}>
                      <TextField
                        fullWidth
                        label="Organization name"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="your-organization"
                      />
                      <Button
                        variant="outlined"
                        onClick={loadRepositories}
                        disabled={loading}
                        startIcon={<BusinessIcon />}
                      >
                        Load
                      </Button>
                    </Box>
                  )}

                  {repoSource === 'user' && (
                    <Alert severity="info">
                      Showing your repositories (including private ones)
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {loading ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress />
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {repositories.map((repo) => (
                    <Grid item xs={12} md={6} key={repo.id}>
                      <Card variant="outlined" sx={{ cursor: 'pointer' }} onClick={() => analyzeRepository(repo)}>
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                            <Typography variant="h6" gutterBottom>
                              {repo.name}
                            </Typography>
                            {repo.private && (
                              <Chip
                                label="Private"
                                size="small"
                                color="warning"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Box>
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            {repo.description || 'No description'}
                          </Typography>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                            <Box display="flex" gap={1}>
                              <Chip label={repo.language || 'Unknown'} size="small" />
                              {repo.stargazers_count > 0 && (
                                <Chip
                                  label={`⭐ ${repo.stargazers_count}`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                            <Typography variant="caption" color="textSecondary">
                              Updated: {new Date(repo.updated_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {/* Step 3: Analyze Code */}
          {activeStep === 2 && repoAnalysis && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Repository Analysis
              </Typography>

              {selectedRepo && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  <strong>{selectedRepo.full_name}</strong> - Found{' '}
                  {repoAnalysis.hasTerraform && `${repoAnalysis.terraformFiles?.length || repoAnalysis.fileCount} Terraform files`}
                  {repoAnalysis.hasTerraform && repoAnalysis.hasAnsible && ' and '}
                  {repoAnalysis.hasAnsible && `${repoAnalysis.ansibleFiles?.length || 0} Ansible files`}
                </Alert>
              )}

              <Grid container spacing={3} mb={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        📊 Analysis Summary
                      </Typography>
                      <List dense>
                        {repoAnalysis.hasTerraform && (
                          <>
                            <ListItem>
                              <ListItemIcon><FileIcon /></ListItemIcon>
                              <ListItemText primary={`${repoAnalysis.terraformFiles?.length || repoAnalysis.fileCount} Terraform files`} />
                            </ListItem>
                            <ListItem>
                              <ListItemIcon><CodeIcon /></ListItemIcon>
                              <ListItemText primary={`${repoAnalysis.totalVariables} variables`} />
                            </ListItem>
                            <ListItem>
                              <ListItemIcon><CheckIcon /></ListItemIcon>
                              <ListItemText primary={`${repoAnalysis.totalResources} resources`} />
                            </ListItem>
                          </>
                        )}
                        {repoAnalysis.hasAnsible && (
                          <>
                            <ListItem>
                              <ListItemIcon><FileIcon /></ListItemIcon>
                              <ListItemText primary={`${repoAnalysis.ansibleFiles?.length || 0} Ansible files`} />
                            </ListItem>
                            <ListItem>
                              <ListItemIcon><CodeIcon /></ListItemIcon>
                              <ListItemText primary="Playbooks and configuration files" />
                            </ListItem>
                          </>
                        )}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        🔧 Template Configuration
                      </Typography>
                      <TextField
                        fullWidth
                        label="Template Name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        sx={{ mb: 2 }}
                      />
                      <TextField
                        fullWidth
                        label="Description"
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        multiline
                        rows={2}
                        sx={{ mb: 2 }}
                      />

                      {/* Template Type Selection */}
                      {repoAnalysis.hasAnsible && repoAnalysis.hasTerraform && (
                        <TextField
                          fullWidth
                          select
                          label="Template Type"
                          value={templateType}
                          onChange={(e) => {
                            const newType = e.target.value as 'terraform' | 'ansible';
                            setTemplateType(newType);
                            // Update main file based on type
                            if (newType === 'ansible') {
                              setMainFile(repoAnalysis.ansibleFiles?.[0] || 'playbook.yml');
                            } else {
                              setMainFile(repoAnalysis.terraformFiles?.[0] || 'main.tf');
                            }
                          }}
                          SelectProps={{ native: true }}
                          sx={{ mb: 2 }}
                        >
                          <option value="terraform">🏗️ Terraform Template</option>
                          <option value="ansible">⚙️ Ansible Playbook</option>
                        </TextField>
                      )}

                      {repoAnalysis.mainFiles.length > 0 && (
                        <TextField
                          fullWidth
                          select
                          label="Main File"
                          value={mainFile}
                          onChange={(e) => setMainFile(e.target.value)}
                          SelectProps={{ native: true }}
                        >
                          {repoAnalysis.mainFiles.map((file) => (
                            <option key={file} value={file}>
                              {file}
                            </option>
                          ))}
                        </TextField>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>📁 Terraform Files ({repoAnalysis.files.length})</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List>
                    {repoAnalysis.files.map((file, index) => (
                      <ListItem key={index}>
                        <ListItemIcon><FileIcon /></ListItemIcon>
                        <ListItemText
                          primary={file.name}
                          secondary={`${file.path} • ${file.variableCount} variables • ${file.resourceCount} resources`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>

              <Box display="flex" justifyContent="space-between" mt={3}>
                <Button onClick={() => setActiveStep(1)}>
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={createTemplate}
                  disabled={loading || !templateName.trim()}
                  startIcon={loading ? <CircularProgress size={20} /> : <ImportIcon />}
                >
                  {loading ? 'Creating Template...' : 'Create Template'}
                </Button>
              </Box>
            </Box>
          )}

          {/* Step 4: Success */}
          {activeStep === 3 && (
            <Box textAlign="center">
              <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Template Created Successfully!
              </Typography>
              <Typography variant="body1" color="textSecondary" mb={3}>
                Your Terraform code has been imported and converted into a reusable template.
                You can now use it to deploy infrastructure.
              </Typography>

              <Box display="flex" justifyContent="center" gap={2}>
                <Button variant="outlined" onClick={resetForm}>
                  Import Another
                </Button>
                <Button variant="contained" onClick={() => window.location.href = '/templates'}>
                  View Templates
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default GitHubImport;
