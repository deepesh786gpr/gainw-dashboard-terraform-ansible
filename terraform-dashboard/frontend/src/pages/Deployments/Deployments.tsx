import React, { useState, useEffect } from 'react';
import { styled, keyframes } from '@mui/material/styles';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as DeployIcon,
  Visibility as PreviewIcon,
  Delete as DestroyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';

// Animation for refresh button
const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const RotatingIcon = styled(RefreshIcon)<{ rotating?: boolean }>`
  animation: ${props => props.rotating ? `${rotate} 1s linear infinite` : 'none'};
`;

interface Template {
  id: string;
  name: string;
  description: string;
  variables: Variable[];
}

interface Variable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'list';
  description: string;
  required: boolean;
  default?: any;
  options?: string[];
}

interface Deployment {
  id: string;
  name: string;
  template: string;
  status: 'planning' | 'applying' | 'success' | 'error' | 'destroying' | 'destroyed' | 'destroy_failed';
  environment: string;
  lastUpdated: string;
  variables: Record<string, any>;
}

const Deployments: React.FC = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pollingIntervals, setPollingIntervals] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<any>(null);

  const { control, handleSubmit, reset, watch } = useForm();
  const { tokens } = useAuth();

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchDeployments();
    fetchTemplates();

    // Cleanup polling intervals on unmount
    return () => {
      pollingIntervals.forEach((interval) => clearInterval(interval));
    };
  }, [pollingIntervals]);

  const fetchDeployments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/deployments`, {
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch deployments');
      }

      const deploymentsData = await response.json();
      setDeployments(Array.isArray(deploymentsData) ? deploymentsData : (deploymentsData.data || []));
    } catch (error) {
      console.error('Error fetching deployments:', error);
      // Fallback to mock data if API fails
      setDeployments([
        {
          id: '1',
          name: 'web-server-prod',
          template: 'EC2 Instance',
          status: 'success',
          environment: 'production',
          lastUpdated: '2 hours ago',
          variables: { instance_type: 't3.small', name: 'web-server-prod' },
        },
        {
          id: '2',
          name: 'database-dev',
          template: 'RDS Database',
          status: 'applying',
          environment: 'development',
          lastUpdated: '5 minutes ago',
          variables: { db_instance_class: 'db.t3.micro', name: 'database-dev' },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates`, {
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const templatesData = await response.json();
      setTemplates(Array.isArray(templatesData) ? templatesData : (templatesData.data || []));
    } catch (error) {
      console.error('Error fetching templates:', error);
      // Fallback to mock data if API fails
      setTemplates([
        {
          id: '1',
          name: 'EC2 Instance',
          description: 'Deploy a single EC2 instance with security group',
          variables: [
            {
              name: 'name',
              type: 'string',
              description: 'Name for the EC2 instance',
              required: true,
            },
            {
              name: 'instance_type',
              type: 'string',
              description: 'EC2 instance type',
              required: true,
              default: 't3.micro',
              options: ['t3.nano', 't3.micro', 't3.small', 't3.medium', 't3.large'],
            },
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (dev, staging, prod)',
              required: true,
              options: ['dev', 'staging', 'prod'],
            },
          ],
        },
      ]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchDeployments();
      console.log('✅ Deployments refreshed successfully');
    } catch (error) {
      console.error('❌ Failed to refresh deployments:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleNewDeployment = () => {
    setOpenDialog(true);
    setActiveStep(0);
    reset();
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setActiveStep(1);
  };

  const handleDeploy = async (data: any) => {
    setLoading(true);
    try {
      // Simulate deployment
      const deploymentData = {
        name: data.name,
        templateId: selectedTemplate?.id,
        environment: data.environment,
        variables: data,
      };

      const response = await fetch(`${API_BASE_URL}/api/deployments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify(deploymentData),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create deployment';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const errorText = await response.text();
            errorMessage = `Server error (${response.status}): ${errorText.substring(0, 200)}`;
          }
        } catch (parseError) {
          errorMessage = `Server error (${response.status}): Unable to parse error response`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Show success message with actual deployment name (in case it was auto-incremented)
      const actualName = result.name || data.name;
      const nameMessage = actualName !== data.name ?
        ` (renamed to "${actualName}" to avoid conflicts)` : '';
      alert(`Deployment "${actualName}" created successfully! Status: ${result.status}${nameMessage}`);

      // Refresh deployments list
      await fetchDeployments();

      // Close dialog and reset form
      setOpenDialog(false);
      setSelectedTemplate(null);
      reset();

      // Start polling for real-time updates
      startDeploymentPolling(result.id);

    } catch (error: any) {
      console.error('Deployment error:', error);
      alert(`Failed to create deployment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle deployment actions
  const handleViewDeployment = (deployment: any) => {
    setSelectedDeployment(deployment);
    setViewDialog(true);
  };

  const handleRedeployment = async (deployment: any) => {
    try {
      setLoading(true);

      let variables = {};
      try {
        variables = typeof deployment.variables === 'string'
          ? JSON.parse(deployment.variables || '{}')
          : deployment.variables || {};
      } catch (error) {
        console.error('Error parsing deployment variables:', error);
        variables = {};
      }

      const redeployData = {
        name: `${deployment.name}-redeploy-${Date.now()}`,
        templateId: deployment.template_id,
        environment: deployment.environment,
        variables: variables,
      };

      const response = await fetch(`${API_BASE_URL}/api/deployments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify(redeployData),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to redeploy';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const errorText = await response.text();
            errorMessage = `Server error (${response.status}): ${errorText.substring(0, 200)}`;
          }
        } catch (parseError) {
          errorMessage = `Server error (${response.status}): Unable to parse error response`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      alert(`Redeployment "${redeployData.name}" started successfully!`);

      // Refresh deployments list
      await fetchDeployments();

      // Start polling for the new deployment
      startDeploymentPolling(result.id);

    } catch (error: any) {
      console.error('Redeployment error:', error);
      alert(`Failed to redeploy: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDestroyDeployment = async (deployment: any) => {
    const confirmDestroy = window.confirm(
      `Are you sure you want to destroy "${deployment.name}"? This will destroy all AWS infrastructure created by this deployment. This action cannot be undone.`
    );

    if (!confirmDestroy) return;

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/deployments/${deployment.id}/destroy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate destroy');
      }

      const result = await response.json();
      alert(`Deployment "${deployment.name}" destruction initiated. Infrastructure will be destroyed.`);

      // Start polling for this deployment to track destroy progress
      startPolling(deployment.id);

      // Refresh deployments list
      await fetchDeployments();

    } catch (error: any) {
      console.error('Destroy error:', error);
      alert(`Failed to initiate destroy: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Start polling for deployment updates
  const startDeploymentPolling = (deploymentId: string) => {
    // Clear existing interval if any
    const existingInterval = pollingIntervals.get(deploymentId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/deployments/${deploymentId}`);
        if (response.ok) {
          const deployment = await response.json();

          // Update the deployment in the list
          setDeployments(prev =>
            prev.map(d => d.id === deploymentId ? deployment : d)
          );

          // Stop polling if deployment is complete
          if (deployment.status === 'success' || deployment.status === 'error' ||
              deployment.status === 'destroyed' || deployment.status === 'destroy_failed') {
            clearInterval(interval);
            setPollingIntervals(prev => {
              const newMap = new Map(prev);
              newMap.delete(deploymentId);
              return newMap;
            });
          }
        }
      } catch (error) {
        console.error('Error polling deployment status:', error);
      }
    }, 2000); // Poll every 2 seconds

    setPollingIntervals(prev => new Map(prev.set(deploymentId, interval)));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
      case 'destroy_failed':
        return 'error';
      case 'applying':
      case 'planning':
      case 'running':
        return 'warning';
      case 'destroying':
        return 'secondary';
      case 'destroyed':
        return 'info';
      case 'pending':
        return 'default';
      default:
        return 'default';
    }
  };

  const renderVariableField = (variable: Variable) => {
    switch (variable.type) {
      case 'boolean':
        return (
          <Controller
            name={variable.name}
            control={control}
            defaultValue={variable.default || false}
            render={({ field }) => (
              <FormControl fullWidth margin="normal">
                <InputLabel>{variable.name}</InputLabel>
                <Select {...field} label={variable.name}>
                  <MenuItem value="true">True</MenuItem>
                  <MenuItem value="false">False</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        );
      case 'number':
        return (
          <Controller
            name={variable.name}
            control={control}
            defaultValue={variable.default || ''}
            rules={{ required: variable.required }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                margin="normal"
                label={variable.name}
                type="number"
                helperText={variable.description}
                required={variable.required}
              />
            )}
          />
        );
      default:
        if (variable.options) {
          return (
            <Controller
              name={variable.name}
              control={control}
              defaultValue={variable.default || ''}
              rules={{ required: variable.required }}
              render={({ field }) => (
                <FormControl fullWidth margin="normal">
                  <InputLabel>{variable.name}</InputLabel>
                  <Select {...field} label={variable.name}>
                    {variable.options?.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
          );
        }
        return (
          <Controller
            name={variable.name}
            control={control}
            defaultValue={variable.default || ''}
            rules={{ required: variable.required }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                margin="normal"
                label={variable.name}
                helperText={variable.description}
                required={variable.required}
              />
            )}
          />
        );
    }
  };

  const steps = ['Select Template', 'Configure Variables', 'Review & Deploy'];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Deployments</Typography>
        <Box>
          <Tooltip title="Refresh Deployments">
            <IconButton
              onClick={handleRefresh}
              color="primary"
              disabled={refreshing}
            >
              <RotatingIcon rotating={refreshing} />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleNewDeployment}
            sx={{ ml: 1 }}
          >
            New Deployment
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {deployments.map((deployment) => (
          <Grid item xs={12} md={6} lg={4} key={deployment.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6">{deployment.name}</Typography>
                  <Chip
                    label={deployment.status}
                    color={getStatusColor(deployment.status) as any}
                    size="small"
                  />
                </Box>
                <Typography color="textSecondary" gutterBottom>
                  Template: {deployment.template}
                </Typography>
                <Typography color="textSecondary" gutterBottom>
                  Environment: {deployment.environment}
                </Typography>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  Last updated: {deployment.lastUpdated}
                </Typography>
                <Box display="flex" gap={1}>
                  <Button
                    size="small"
                    startIcon={<PreviewIcon />}
                    onClick={() => handleViewDeployment(deployment)}
                    disabled={loading}
                  >
                    View
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DeployIcon />}
                    onClick={() => handleRedeployment(deployment)}
                    disabled={loading}
                  >
                    Redeploy
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DestroyIcon />}
                    color="error"
                    onClick={() => handleDestroyDeployment(deployment)}
                    disabled={loading}
                  >
                    Destroy
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Deployment</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <Grid container spacing={2}>
              {templates.map((template) => (
                <Grid item xs={12} md={6} key={template.id}>
                  <Paper
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      border: '2px solid transparent',
                      '&:hover': {
                        borderColor: 'primary.main',
                      },
                    }}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <Typography variant="h6">{template.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {template.description}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

          {activeStep === 1 && selectedTemplate && (
            <Box component="form" onSubmit={handleSubmit(handleDeploy)}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Configure the deployment for {selectedTemplate.name}
              </Alert>

              {/* Deployment Configuration */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Deployment Configuration
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="name"
                      control={control}
                      rules={{ required: 'Deployment name is required' }}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          label="Deployment Name"
                          fullWidth
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          placeholder="e.g., web-server-prod"
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="environment"
                      control={control}
                      rules={{ required: 'Environment is required' }}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          select
                          label="Environment"
                          fullWidth
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                        >
                          <MenuItem value="development">Development</MenuItem>
                          <MenuItem value="staging">Staging</MenuItem>
                          <MenuItem value="production">Production</MenuItem>
                        </TextField>
                      )}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Template Variables */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Template Variables
                </Typography>
                {selectedTemplate.variables.map((variable) => (
                  <Box key={variable.name} sx={{ mb: 2 }}>
                    {renderVariableField(variable)}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {activeStep === 2 && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Review your configuration and deploy
              </Alert>

              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Deployment Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Name:</strong> {watch('name') || 'Not specified'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Environment:</strong> {watch('environment') || 'Not specified'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      <strong>Template:</strong> {selectedTemplate?.name}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Template Variables
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  <pre style={{ fontSize: '0.875rem', margin: 0 }}>
                    {JSON.stringify(watch(), null, 2)}
                  </pre>
                </Box>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          {activeStep === 2 && (
            <Button onClick={() => setActiveStep(1)}>
              Back
            </Button>
          )}
          {activeStep === 1 && (
            <Button
              onClick={handleSubmit((data) => {
                // Validate required fields before proceeding
                if (!data.name || !data.environment) {
                  alert('Please fill in all required fields');
                  return;
                }
                setActiveStep(2);
              })}
              variant="contained"
            >
              Next
            </Button>
          )}
          {activeStep === 2 && (
            <Button
              onClick={handleSubmit(handleDeploy)}
              variant="contained"
              disabled={loading}
              startIcon={<DeployIcon />}
            >
              {loading ? 'Deploying...' : 'Deploy'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* View Deployment Dialog */}
      <Dialog
        open={viewDialog}
        onClose={() => setViewDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Deployment Details: {selectedDeployment?.name}
        </DialogTitle>
        <DialogContent>
          {selectedDeployment && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Basic Information
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Name:</strong> {selectedDeployment.name}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Environment:</strong> {selectedDeployment.environment}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Status:</strong>
                      <Chip
                        label={selectedDeployment.status}
                        color={
                          selectedDeployment.status === 'success' ? 'success' :
                          selectedDeployment.status === 'error' ? 'error' :
                          selectedDeployment.status === 'applying' ? 'warning' : 'default'
                        }
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Template:</strong> {selectedDeployment.template_name || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Created:</strong> {selectedDeployment.created_at || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Updated:</strong> {selectedDeployment.updated_at || 'N/A'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Variables
                    </Typography>
                    <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                      <pre style={{ fontSize: '0.75rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(
                          (() => {
                            try {
                              return typeof selectedDeployment.variables === 'string'
                                ? JSON.parse(selectedDeployment.variables || '{}')
                                : selectedDeployment.variables || {};
                            } catch (error) {
                              console.error('Error parsing variables:', error);
                              return { error: 'Invalid variables format' };
                            }
                          })(),
                          null,
                          2
                        )}
                      </pre>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Deployment Logs
                    </Typography>
                    <Box
                      sx={{
                        maxHeight: 300,
                        overflow: 'auto',
                        backgroundColor: '#f5f5f5',
                        p: 1,
                        borderRadius: 1,
                        fontFamily: 'monospace'
                      }}
                    >
                      {selectedDeployment.logs ? (
                        (() => {
                          try {
                            const logs = Array.isArray(selectedDeployment.logs)
                              ? selectedDeployment.logs
                              : JSON.parse(selectedDeployment.logs || '[]');

                            return logs.map((log: string, index: number) => (
                              <Typography
                                key={index}
                                variant="body2"
                                sx={{ fontSize: '0.75rem', mb: 0.5 }}
                              >
                                {log}
                              </Typography>
                            ));
                          } catch (error) {
                            console.error('Error parsing logs:', error);
                            return (
                              <Typography variant="body2" color="error">
                                Error loading logs: {selectedDeployment.logs}
                              </Typography>
                            );
                          }
                        })()
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          No logs available
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<DeployIcon />}
            onClick={() => {
              setViewDialog(false);
              if (selectedDeployment) {
                handleRedeployment(selectedDeployment);
              }
            }}
            disabled={loading}
          >
            Redeploy
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Deployments;
