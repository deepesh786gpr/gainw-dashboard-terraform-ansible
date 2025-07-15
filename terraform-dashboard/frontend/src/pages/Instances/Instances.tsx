import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Computer as InstanceIcon,
  Storage as VolumeIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

interface Instance {
  id: string;
  name: string;
  type: string;
  state: 'running' | 'stopped' | 'pending' | 'stopping' | 'starting';
  publicIp: string;
  privateIp: string;
  availabilityZone: string;
  launchTime: string;
  environment: string;
  volumes: Volume[];
  scheduledActions: ScheduledAction[];
}

interface Volume {
  id: string;
  size: number;
  type: string;
  encrypted: boolean;
}

interface ScheduledAction {
  id: string;
  action: 'start' | 'stop';
  scheduledTime: Date;
  recurring: boolean;
  enabled: boolean;
}

const Instances: React.FC = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [modifyDialog, setModifyDialog] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [instanceDetails, setInstanceDetails] = useState<any>(null);
  const [scheduleForm, setScheduleForm] = useState({
    action: 'stop' as 'start' | 'stop',
    scheduledTime: new Date(),
    recurring: false,
  });
  const [modifyForm, setModifyForm] = useState({
    instanceType: '',
    securityGroups: [] as string[],
    userData: '',
    iamRole: '',
    monitoring: false,
    terminationProtection: false,
    tags: {} as Record<string, string>,
  });

  const handleRefresh = async () => {
    console.log('🔄 Refresh button clicked');
    setRefreshing(true);
    try {
      await fetchInstances();
      setLastRefresh(new Date());
      console.log('✅ Refresh completed successfully');
    } catch (error) {
      console.error('❌ Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const fetchInstances = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/instances`);

      if (!response.ok) {
        throw new Error('Failed to fetch instances');
      }

      const result = await response.json();

      // Handle both old format (array) and new format (object with data property)
      const instancesData = Array.isArray(result) ? result : (result.data || result);

      // Fetch scheduled actions for each instance
      const instancesWithSchedules = await Promise.all(
        instancesData.map(async (instance: any) => {
          try {
            const scheduleResponse = await fetch(`${API_BASE_URL}/api/instances/${instance.id}/schedule`);
            const scheduledActions = scheduleResponse.ok ? await scheduleResponse.json() : [];

            return {
              ...instance,
              scheduledActions: Array.isArray(scheduledActions) ? scheduledActions : (scheduledActions.data || []),
              volumes: instance.volumes || [],
            };
          } catch (error) {
            console.error(`Error fetching schedule for instance ${instance.id}:`, error);
            return {
              ...instance,
              scheduledActions: [],
              volumes: instance.volumes || [],
            };
          }
        })
      );

      setInstances(instancesWithSchedules);
      console.log(`Loaded ${instancesWithSchedules.length} real EC2 instances`);
      console.log('Instance details:', instancesWithSchedules);

      // Log running instances specifically
      const runningInstances = instancesWithSchedules.filter(i => i.state === 'running');
      console.log(`Running instances: ${runningInstances.length}`, runningInstances);

      if (instancesWithSchedules.length === 0) {
        console.log('No EC2 instances found. This could mean:');
        console.log('1. No EC2 instances exist in your AWS account');
        console.log('2. AWS credentials are not configured');
        console.log('3. The configured AWS region has no instances');
      }
    } catch (error) {
      console.error('Error fetching instances:', error);
      console.log('Unable to fetch real AWS data. Please check:');
      console.log('1. AWS credentials are configured');
      console.log('2. AWS region is set correctly');
      console.log('3. IAM permissions for EC2 access');

      // Set empty array instead of mock data
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInstanceAction = async (instanceId: string, action: 'start' | 'stop' | 'restart') => {
    try {
      console.log(`Attempting to ${action} instance ${instanceId}`);
      setLoading(true);

      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const url = `${API_BASE_URL}/api/instances/${instanceId}/${action}`;
      console.log(`Making request to: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error response: ${errorText}`);
        throw new Error(`Failed to ${action} instance: ${response.status}`);
      }

      const result = await response.json();
      console.log(`Success result:`, result);

      // Show success message
      alert(result.message || `Successfully initiated ${action} for instance ${instanceId}`);

      // Refresh instances to show updated state
      setTimeout(() => {
        fetchInstances();
      }, 1000);

    } catch (error) {
      console.error(`Error ${action}ing instance:`, error);
      alert(`Failed to ${action} instance. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleAction = async () => {
    if (!selectedInstance) return;

    try {
      setLoading(true);

      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/instances/${selectedInstance.id}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: scheduleForm.action,
          scheduledTime: scheduleForm.scheduledTime.toISOString(),
          recurring: scheduleForm.recurring,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to schedule action');
      }

      const result = await response.json();

      // Show success message
      alert(`Successfully scheduled ${scheduleForm.action} for ${selectedInstance.name} at ${scheduleForm.scheduledTime.toLocaleString()}`);

      // Refresh instances to show updated scheduled actions
      fetchInstances();

    } catch (error) {
      console.error('Error scheduling action:', error);
      alert('Failed to schedule action. Please try again.');
    } finally {
      setLoading(false);
      setScheduleDialog(false);
      setSelectedInstance(null);
    }
  };

  const handleModifyInstance = async (instance: Instance) => {
    try {
      setLoading(true);
      setSelectedInstance(instance);

      // Fetch detailed instance information
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/instances/${instance.id}/details`);
      if (!response.ok) {
        throw new Error('Failed to fetch instance details');
      }

      const details = await response.json();
      setInstanceDetails(details);

      // Populate modify form with current values
      setModifyForm({
        instanceType: details.type || '',
        securityGroups: details.securityGroups?.map((sg: any) => sg.id) || [],
        userData: details.userData || '',
        iamRole: details.iamRole || '',
        monitoring: details.monitoring || false,
        terminationProtection: details.terminationProtection || false,
        tags: details.tags || {},
      });

      setModifyDialog(true);
    } catch (error) {
      console.error('Error fetching instance details:', error);
      alert('Failed to fetch instance details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveModifications = async () => {
    if (!selectedInstance) return;

    try {
      setLoading(true);

      const modifications: any = {};

      // Only include changed fields
      if (modifyForm.instanceType !== instanceDetails?.type) {
        modifications.instanceType = modifyForm.instanceType;
      }
      if (JSON.stringify(modifyForm.securityGroups) !== JSON.stringify(instanceDetails?.securityGroups?.map((sg: any) => sg.id))) {
        modifications.securityGroups = modifyForm.securityGroups;
      }
      if (modifyForm.userData !== instanceDetails?.userData) {
        modifications.userData = modifyForm.userData;
      }
      if (modifyForm.iamRole !== instanceDetails?.iamRole) {
        modifications.iamRole = modifyForm.iamRole;
      }
      if (modifyForm.monitoring !== instanceDetails?.monitoring) {
        modifications.monitoring = modifyForm.monitoring;
      }
      if (modifyForm.terminationProtection !== instanceDetails?.terminationProtection) {
        modifications.terminationProtection = modifyForm.terminationProtection;
      }
      if (JSON.stringify(modifyForm.tags) !== JSON.stringify(instanceDetails?.tags)) {
        modifications.tags = modifyForm.tags;
      }

      if (Object.keys(modifications).length === 0) {
        alert('No changes detected.');
        return;
      }

      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/instances/${selectedInstance.id}/modify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(modifications),
      });

      if (!response.ok) {
        throw new Error('Failed to modify instance');
      }

      const result = await response.json();
      alert(result.message || 'Instance modifications applied successfully');

      setModifyDialog(false);
      fetchInstances(); // Refresh instances
    } catch (error) {
      console.error('Error modifying instance:', error);
      alert('Failed to modify instance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'default';
      case 'pending':
      case 'starting':
        return 'info';
      case 'stopping':
        return 'warning';
      case 'terminated':
      case 'terminating':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      width: 150,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" gap={1}>
          <InstanceIcon fontSize="small" />
          {params.value}
        </Box>
      ),
    },
    {
      field: 'id',
      headerName: 'Instance ID',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 100,
    },
    {
      field: 'state',
      headerName: 'State',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getStateColor(params.value) as any}
          size="small"
        />
      ),
    },
    {
      field: 'publicIp',
      headerName: 'Public IP',
      width: 130,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {params.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'privateIp',
      headerName: 'Private IP',
      width: 130,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'environment',
      headerName: 'Environment',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} variant="outlined" size="small" />
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 200,
      getActions: (params) => {
        const instance = params.row as Instance;
        const actions = [
          <GridActionsCellItem
            icon={<ViewIcon />}
            label="View Details"
            onClick={() => console.log('View details', instance.id)}
          />,
          <GridActionsCellItem
            icon={<EditIcon />}
            label="Modify"
            onClick={() => handleModifyInstance(instance)}
          />,
          <GridActionsCellItem
            icon={<ScheduleIcon />}
            label="Schedule"
            onClick={() => {
              setSelectedInstance(instance);
              setScheduleDialog(true);
            }}
          />,
        ];

        if (instance.state === 'running') {
          actions.unshift(
            <GridActionsCellItem
              icon={<StopIcon />}
              label="Stop"
              onClick={() => handleInstanceAction(instance.id, 'stop')}
            />
          );
        } else if (instance.state === 'stopped') {
          actions.unshift(
            <GridActionsCellItem
              icon={<StartIcon />}
              label="Start"
              onClick={() => handleInstanceAction(instance.id, 'start')}
            />
          );
        }

        return actions;
      },
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">EC2 Instances</Typography>
        <Tooltip title={`Refresh Instances${lastRefresh ? ` (Last: ${lastRefresh.toLocaleTimeString()})` : ''}`}>
          <IconButton
            onClick={handleRefresh}
            color="primary"
            disabled={loading || refreshing}
            sx={{
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }}
          >
            {refreshing ? <RefreshIcon /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Status Message */}
      {lastRefresh && (
        <Box mb={2}>
          <Typography variant="body2" color="textSecondary">
            Last refreshed: {lastRefresh.toLocaleString()}
            {refreshing && ' - Refreshing...'}
          </Typography>
        </Box>
      )}

      <Grid container spacing={3} mb={3}>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Instances
                  </Typography>
                  <Typography variant="h4" component="div">
                    {instances.length}
                  </Typography>
                </Box>
                <InstanceIcon color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Running Instances
                  </Typography>
                  <Typography variant="h4" component="div" color="success.main">
                    {instances.filter(i => i.state === 'running').length}
                  </Typography>
                </Box>
                <Box color="success.main"><StartIcon fontSize="large" /></Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Stopped Instances
                  </Typography>
                  <Typography variant="h4" component="div" color="error.main">
                    {instances.filter(i => i.state === 'stopped').length}
                  </Typography>
                </Box>
                <Box color="error.main"><StopIcon fontSize="large" /></Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Scheduled Actions
                  </Typography>
                  <Typography variant="h4" component="div" color="warning.main">
                    {instances.reduce((acc, i) => acc + i.scheduledActions.length, 0)}
                  </Typography>
                </Box>
                <ScheduleIcon color="warning" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <DataGrid
            rows={instances}
            columns={columns}
            loading={loading}
            autoHeight
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={scheduleDialog} onClose={() => setScheduleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Schedule Instance Action</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Schedule an action for instance: {selectedInstance?.name}
          </Alert>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Action</InputLabel>
            <Select
              value={scheduleForm.action}
              label="Action"
              onChange={(e) => setScheduleForm({ ...scheduleForm, action: e.target.value as 'start' | 'stop' })}
            >
              <MenuItem value="start">Start Instance</MenuItem>
              <MenuItem value="stop">Stop Instance</MenuItem>
            </Select>
          </FormControl>

          <DateTimePicker
            label="Scheduled Time"
            value={scheduleForm.scheduledTime}
            onChange={(newValue) => setScheduleForm({ ...scheduleForm, scheduledTime: newValue || new Date() })}
            sx={{ width: '100%', mt: 2 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={scheduleForm.recurring}
                onChange={(e) => setScheduleForm({ ...scheduleForm, recurring: e.target.checked })}
              />
            }
            label="Recurring (daily)"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialog(false)}>Cancel</Button>
          <Button onClick={handleScheduleAction} variant="contained">
            Schedule
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={modifyDialog} onClose={() => setModifyDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Modify Instance Configuration</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Modify configuration for instance: {selectedInstance?.name} ({selectedInstance?.id})
          </Alert>

          <Grid container spacing={2}>
            <Grid xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Instance Name"
                value={selectedInstance?.name || ''}
                onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Instance Type</InputLabel>
                <Select
                  value={selectedInstance?.instanceType || ''}
                  label="Instance Type"
                  onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, instanceType: e.target.value } : null)}
                >
                  <MenuItem value="t2.micro">t2.micro</MenuItem>
                  <MenuItem value="t2.small">t2.small</MenuItem>
                  <MenuItem value="t2.medium">t2.medium</MenuItem>
                  <MenuItem value="t3.micro">t3.micro</MenuItem>
                  <MenuItem value="t3.small">t3.small</MenuItem>
                  <MenuItem value="t3.medium">t3.medium</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Region</InputLabel>
                <Select
                  value={selectedInstance?.region || ''}
                  label="Region"
                  onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, region: e.target.value } : null)}
                >
                  <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
                  <MenuItem value="us-east-2">US East (Ohio)</MenuItem>
                  <MenuItem value="us-west-1">US West (N. California)</MenuItem>
                  <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
                  <MenuItem value="eu-west-1">EU (Ireland)</MenuItem>
                  <MenuItem value="eu-central-1">EU (Frankfurt)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>VPC</InputLabel>
                <Select
                  value={selectedInstance?.vpc || ''}
                  label="VPC"
                  onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, vpc: e.target.value } : null)}
                >
                  <MenuItem value="vpc-default">Default VPC</MenuItem>
                  <MenuItem value="vpc-prod">Production VPC</MenuItem>
                  <MenuItem value="vpc-dev">Development VPC</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Subnet</InputLabel>
                <Select
                  value={selectedInstance?.subnet || ''}
                  label="Subnet"
                  onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, subnet: e.target.value } : null)}
                >
                  <MenuItem value="subnet-public1">Public Subnet 1</MenuItem>
                  <MenuItem value="subnet-public2">Public Subnet 2</MenuItem>
                  <MenuItem value="subnet-private1">Private Subnet 1</MenuItem>
                  <MenuItem value="subnet-private2">Private Subnet 2</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedInstance?.publicIp || false}
                    onChange={(e) => setSelectedInstance(prev => prev ? { ...prev, publicIp: e.target.checked } : null)}
                  />
                }
                label="Assign Public IP"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModifyDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveModifications} variant="contained">
            Apply Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Instances;
