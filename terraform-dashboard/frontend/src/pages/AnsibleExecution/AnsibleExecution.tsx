import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  TabPanel,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Computer as ComputerIcon,
  Storage as StorageIcon,
  Functions as FunctionsIcon,
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

interface PlaybookInfo {
  path: string;
  operations: string[];
}

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionId: string;
  timestamp: string;
  duration: number;
}

interface ExecutionHistory {
  id: string;
  success: boolean;
  output: string;
  error?: string;
  executionId: string;
  timestamp: string;
  duration: number;
}

const AnsibleExecution: React.FC = () => {
  const { tokens } = useAuth();
  const [playbooks, setPlaybooks] = useState<Record<string, PlaybookInfo>>({});
  const [selectedPlaybook, setSelectedPlaybook] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [environment, setEnvironment] = useState('development');
  const [region, setRegion] = useState('us-east-1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [executions, setExecutions] = useState<ExecutionHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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

  // Load playbooks on component mount
  useEffect(() => {
    loadPlaybooks();
    checkHealth();
    loadExecutionHistory();
  }, []);

  const loadPlaybooks = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ansible-execution/playbooks`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setPlaybooks(data.playbooks);
      }
    } catch (error) {
      console.error('Error loading playbooks:', error);
    }
  };

  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ansible-execution/health`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data);
      }
    } catch (error) {
      console.error('Error checking health:', error);
    }
  };

  const loadExecutionHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ansible-execution/executions`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setExecutions(data.executions || []);
      }
    } catch (error) {
      console.error('Error loading execution history:', error);
    }
  };

  const executePlaybook = async () => {
    if (!selectedPlaybook || !selectedAction) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ansible-execution/execute`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          playbook: selectedPlaybook,
          action: selectedAction,
          parameters,
          environment,
          region,
        }),
      });

      const data = await response.json();
      setResult(data);
      
      // Refresh execution history
      loadExecutionHistory();
    } catch (error) {
      console.error('Error executing playbook:', error);
      setResult({
        success: false,
        output: '',
        error: `Failed to execute playbook: ${error}`,
        executionId: '',
        timestamp: new Date().toISOString(),
        duration: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const getPlaybookIcon = (playbook: string) => {
    switch (playbook) {
      case 'ec2-management':
        return <ComputerIcon />;
      case 'rds-management':
        return <StorageIcon />;
      case 'lambda-management':
        return <FunctionsIcon />;
      case 'eks-management':
        return <AccountTreeIcon />;
      default:
        return <PlayIcon />;
    }
  };

  const getPlaybookDescription = (playbook: string) => {
    switch (playbook) {
      case 'ec2-management':
        return 'Manage EC2 instances: create, start, stop, restart, terminate, modify, backup';
      case 'rds-management':
        return 'Manage RDS databases: create, start, stop, restart, delete, backup, modify';
      case 'lambda-management':
        return 'Manage Lambda functions: create, update, delete, invoke, configure';
      case 'eks-management':
        return 'Manage EKS clusters: create, delete, update, scale, configure';
      default:
        return 'AWS service management playbook';
    }
  };

  const renderParameterFields = () => {
    if (!selectedPlaybook || !selectedAction) return null;

    const commonFields = (
      <>
        <TextField
          label="Name/ID"
          value={parameters.name || parameters.id || ''}
          onChange={(e) => setParameters({ ...parameters, name: e.target.value, id: e.target.value })}
          fullWidth
          margin="normal"
          helperText="Resource name or ID"
        />
      </>
    );

    switch (selectedPlaybook) {
      case 'ec2-management':
        return (
          <>
            {commonFields}
            {selectedAction === 'create' && (
              <>
                <TextField
                  label="Instance Type"
                  value={parameters.type || 't3.micro'}
                  onChange={(e) => setParameters({ ...parameters, type: e.target.value })}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  label="Key Pair"
                  value={parameters.key_pair || ''}
                  onChange={(e) => setParameters({ ...parameters, key_pair: e.target.value })}
                  fullWidth
                  margin="normal"
                />
              </>
            )}
          </>
        );

      case 'rds-management':
        return (
          <>
            {commonFields}
            {selectedAction === 'create' && (
              <>
                <TextField
                  label="Engine"
                  value={parameters.engine || 'mysql'}
                  onChange={(e) => setParameters({ ...parameters, engine: e.target.value })}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  label="Username"
                  value={parameters.username || 'admin'}
                  onChange={(e) => setParameters({ ...parameters, username: e.target.value })}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  label="Password"
                  type="password"
                  value={parameters.password || ''}
                  onChange={(e) => setParameters({ ...parameters, password: e.target.value })}
                  fullWidth
                  margin="normal"
                />
              </>
            )}
          </>
        );

      case 'lambda-management':
        return (
          <>
            {commonFields}
            {selectedAction === 'create' && (
              <>
                <TextField
                  label="Runtime"
                  value={parameters.lambda_runtime || 'python3.9'}
                  onChange={(e) => setParameters({ ...parameters, lambda_runtime: e.target.value })}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  label="Memory (MB)"
                  type="number"
                  value={parameters.memory || '128'}
                  onChange={(e) => setParameters({ ...parameters, memory: e.target.value })}
                  fullWidth
                  margin="normal"
                />
              </>
            )}
          </>
        );

      case 'eks-management':
        return (
          <>
            {commonFields}
            {selectedAction === 'create' && (
              <>
                <TextField
                  label="Cluster Version"
                  value={parameters.version || '1.28'}
                  onChange={(e) => setParameters({ ...parameters, version: e.target.value })}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  label="Desired Nodes"
                  type="number"
                  value={parameters.desired_nodes || '2'}
                  onChange={(e) => setParameters({ ...parameters, desired_nodes: e.target.value })}
                  fullWidth
                  margin="normal"
                />
              </>
            )}
          </>
        );

      default:
        return commonFields;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        🎭 Ansible Playbook Execution
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Execute Ansible playbooks for AWS service management
      </Typography>

      {/* Health Status */}
      {healthStatus && (
        <Alert 
          severity={healthStatus.healthy ? 'success' : 'warning'} 
          sx={{ mb: 3 }}
        >
          Ansible Status: {healthStatus.healthy ? 'Ready' : 'Issues Detected'}
          {!healthStatus.healthy && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {!healthStatus.checks.ansible_available && 'Ansible not available. '}
              {!healthStatus.checks.playbooks_directory && 'Playbooks directory not found. '}
            </Typography>
          )}
        </Alert>
      )}

      <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab label="Execute Playbooks" />
        <Tab label="Execution History" />
      </Tabs>

      {/* Execute Playbooks Tab */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          {/* Playbook Selection */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Select Playbook & Action
              </Typography>

              <FormControl fullWidth margin="normal">
                <InputLabel>Playbook</InputLabel>
                <Select
                  value={selectedPlaybook}
                  onChange={(e) => {
                    setSelectedPlaybook(e.target.value);
                    setSelectedAction('');
                    setParameters({});
                  }}
                >
                  {Object.entries(playbooks).map(([name, info]) => (
                    <MenuItem key={name} value={name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getPlaybookIcon(name)}
                        {name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedPlaybook && (
                <FormControl fullWidth margin="normal">
                  <InputLabel>Action</InputLabel>
                  <Select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                  >
                    {playbooks[selectedPlaybook]?.operations.map((operation) => (
                      <MenuItem key={operation} value={operation}>
                        {operation}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <FormControl fullWidth margin="normal">
                <InputLabel>Environment</InputLabel>
                <Select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                >
                  <MenuItem value="development">Development</MenuItem>
                  <MenuItem value="staging">Staging</MenuItem>
                  <MenuItem value="production">Production</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth margin="normal">
                <InputLabel>Region</InputLabel>
                <Select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
                  <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
                  <MenuItem value="eu-west-1">Europe (Ireland)</MenuItem>
                  <MenuItem value="ap-southeast-1">Asia Pacific (Singapore)</MenuItem>
                </Select>
              </FormControl>

              {renderParameterFields()}

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  onClick={executePlaybook}
                  disabled={!selectedPlaybook || !selectedAction || loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
                  fullWidth
                >
                  {loading ? 'Executing...' : 'Execute Playbook'}
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Results */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Execution Results
              </Typography>

              {result && (
                <Box>
                  <Alert 
                    severity={result.success ? 'success' : 'error'} 
                    sx={{ mb: 2 }}
                  >
                    {result.success ? 'Execution completed successfully' : 'Execution failed'}
                  </Alert>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Execution ID: {result.executionId}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Duration: {result.duration}ms
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Timestamp: {new Date(result.timestamp).toLocaleString()}
                  </Typography>

                  <Accordion sx={{ mt: 2 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Output Details</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box
                        component="pre"
                        sx={{
                          backgroundColor: '#f5f5f5',
                          p: 2,
                          borderRadius: 1,
                          overflow: 'auto',
                          maxHeight: 400,
                          fontSize: '0.875rem',
                          fontFamily: 'monospace',
                        }}
                      >
                        {result.output || result.error}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}

              {!result && !loading && (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  Select a playbook and action to execute
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Execution History Tab */}
      {tabValue === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Execution History
            </Typography>
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadExecutionHistory}
            >
              Refresh
            </Button>
          </Box>

          {executions.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No executions found
            </Typography>
          ) : (
            <List>
              {executions.map((execution) => (
                <ListItem key={execution.id} divider>
                  <ListItemIcon>
                    {execution.success ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <ErrorIcon color="error" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={`${execution.executionId}`}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          {new Date(execution.timestamp).toLocaleString()}
                        </Typography>
                        <Typography variant="body2">
                          Duration: {execution.duration}ms
                        </Typography>
                      </Box>
                    }
                  />
                  <Chip
                    label={execution.success ? 'Success' : 'Failed'}
                    color={execution.success ? 'success' : 'error'}
                    size="small"
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default AnsibleExecution;
