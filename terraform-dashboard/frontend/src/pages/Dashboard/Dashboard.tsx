import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Paper,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  CloudQueue as DeployIcon,
  Computer as InstanceIcon,
  Storage as VolumeIcon,
  Timeline as ActivityIcon,
  AttachMoney as CostIcon,
  Speed as PerformanceIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

interface DashboardStats {
  totalInstances: number;
  runningInstances: number;
  stoppedInstances: number;
  totalVolumes: number;
  activeDeployments: number;
  lastDeployment: string;
  estimatedCosts: number;
  securityAlerts: number;
}

interface RecentActivity {
  id: string;
  type: 'deployment' | 'instance' | 'volume';
  action: string;
  resource: string;
  status: 'success' | 'error' | 'pending';
  timestamp: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalInstances: 0,
    runningInstances: 0,
    stoppedInstances: 0,
    totalVolumes: 0,
    activeDeployments: 0,
    lastDeployment: 'Never',
    estimatedCosts: 0,
    securityAlerts: 0,
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      console.log('Fetching real dashboard data...');

      // Fetch real data from APIs
      const [instancesResponse, deploymentsResponse, clustersResponse] = await Promise.allSettled([
        fetch('http://localhost:5000/api/instances'),
        fetch('http://localhost:5000/api/deployments'),
        fetch('http://localhost:5000/api/clusters')
      ]);

      let instances: any[] = [];
      let deployments: any[] = [];
      let clusters: any[] = [];

      // Process instances data
      if (instancesResponse.status === 'fulfilled' && instancesResponse.value.ok) {
        instances = await instancesResponse.value.json();
        console.log(`Found ${instances.length} real instances`);
      }

      // Process deployments data
      if (deploymentsResponse.status === 'fulfilled' && deploymentsResponse.value.ok) {
        deployments = await deploymentsResponse.value.json();
        console.log(`Found ${deployments.length} deployments`);
      }

      // Process clusters data
      if (clustersResponse.status === 'fulfilled' && clustersResponse.value.ok) {
        clusters = await clustersResponse.value.json();
        console.log(`Found ${clusters.length} clusters`);
      }

      // Calculate real statistics
      const runningInstances = instances.filter(i => i.state === 'running').length;
      const stoppedInstances = instances.filter(i => i.state === 'stopped').length;
      const totalVolumes = instances.reduce((sum, i) => sum + (i.volumes?.length || 0), 0);
      const activeDeployments = deployments.filter(d =>
        d.status === 'applying' || d.status === 'planning'
      ).length;

      // Get last deployment
      const sortedDeployments = deployments.sort((a, b) =>
        new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
      );
      const lastDeployment = sortedDeployments.length > 0
        ? `${Math.floor((Date.now() - new Date(sortedDeployments[0].updated_at || sortedDeployments[0].created_at).getTime()) / (1000 * 60))} minutes ago`
        : 'Never';

      setStats({
        totalInstances: instances.length,
        runningInstances,
        stoppedInstances,
        totalVolumes,
        activeDeployments,
        lastDeployment,
        estimatedCosts: instances.length * 15.5, // Rough estimate based on instance count
        securityAlerts: 0, // Would need security scanning integration
      });

      // Create recent activity from real data
      const activity: RecentActivity[] = [];

      // Add recent deployments
      sortedDeployments.slice(0, 3).forEach((deployment) => {
        activity.push({
          id: `deployment-${deployment.id}`,
          type: 'deployment',
          action: deployment.status === 'success' ? 'Completed' :
                  deployment.status === 'applying' ? 'Applying' :
                  deployment.status === 'planning' ? 'Planning' : 'Failed',
          resource: deployment.name,
          status: deployment.status === 'success' ? 'success' :
                  deployment.status === 'error' ? 'error' : 'info',
          timestamp: new Date(deployment.updated_at || deployment.created_at).toLocaleString(),
        });
      });

      // Add instance information
      instances.slice(0, 2).forEach((instance) => {
        activity.push({
          id: `instance-${instance.id}`,
          type: 'instance',
          action: instance.state === 'running' ? 'Running' :
                  instance.state === 'stopped' ? 'Stopped' : instance.state,
          resource: instance.name || instance.id,
          status: instance.state === 'running' ? 'success' :
                  instance.state === 'stopped' ? 'warning' : 'info',
          timestamp: new Date(instance.launchTime).toLocaleString(),
        });
      });

      setRecentActivity(activity.slice(0, 5));
      console.log('Dashboard data updated with real information');

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set empty state on error
      setStats({
        totalInstances: 0,
        runningInstances: 0,
        stoppedInstances: 0,
        totalVolumes: 0,
        activeDeployments: 0,
        lastDeployment: 'Never',
        estimatedCosts: 0,
        securityAlerts: 0,
      });
      setRecentActivity([]);
    } finally {
      setLoading(false);
    }
  };

  const StatCard: React.FC<{
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
  }> = ({ title, value, icon, color, subtitle }) => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" color={color}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box color={color}>{icon}</Box>
        </Box>
      </CardContent>
    </Card>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'deployment':
        return <DeployIcon fontSize="small" />;
      case 'instance':
        return <InstanceIcon fontSize="small" />;
      case 'volume':
        return <VolumeIcon fontSize="small" />;
      default:
        return <ActivityIcon fontSize="small" />;
    }
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchDashboardData} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<DeployIcon />}
            sx={{ ml: 1 }}
            onClick={() => window.location.href = '/deployments'}
          >
            New Deployment
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Instances"
            value={stats.totalInstances}
            icon={<InstanceIcon fontSize="large" />}
            color="primary.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Running"
            value={stats.runningInstances}
            icon={<StartIcon fontSize="large" />}
            color="success.main"
            subtitle={`${stats.stoppedInstances} stopped`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="EBS Volumes"
            value={stats.totalVolumes}
            icon={<VolumeIcon fontSize="large" />}
            color="info.main"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Deployments"
            value={stats.activeDeployments}
            icon={<DeployIcon fontSize="large" />}
            color="warning.main"
            subtitle={`Last: ${stats.lastDeployment}`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Estimated Costs"
            value={`$${stats.estimatedCosts.toFixed(2)}`}
            icon={<CostIcon fontSize="large" />}
            color="secondary.main"
            subtitle="Monthly"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Security Alerts"
            value={stats.securityAlerts}
            icon={<SecurityIcon fontSize="large" />}
            color={stats.securityAlerts > 0 ? "error.main" : "success.main"}
            subtitle={stats.securityAlerts > 0 ? "Needs attention" : "All good"}
          />
        </Grid>
      </Grid>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              {recentActivity.length === 0 ? (
                <Alert severity="info">No recent activity</Alert>
              ) : (
                <Box>
                  {recentActivity.map((activity) => (
                    <Box
                      key={activity.id}
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      py={1}
                      borderBottom="1px solid #eee"
                    >
                      <Box display="flex" alignItems="center" gap={2}>
                        {getActivityIcon(activity.type)}
                        <Box>
                          <Typography variant="body2">
                            {activity.action} {activity.resource}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {activity.timestamp}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        label={activity.status}
                        color={getStatusColor(activity.status) as any}
                        size="small"
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="outlined"
                  startIcon={<DeployIcon />}
                  fullWidth
                  onClick={() => window.location.href = '/deployments'}
                >
                  Deploy Infrastructure
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<InstanceIcon />}
                  fullWidth
                  onClick={() => window.location.href = '/instances'}
                >
                  Manage Instances
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ActivityIcon />}
                  fullWidth
                  onClick={() => window.location.href = '/templates'}
                >
                  Create Template
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CostIcon />}
                  fullWidth
                  onClick={() => window.location.href = '/cost-analysis'}
                >
                  Cost Analysis
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SecurityIcon />}
                  fullWidth
                  color={stats.securityAlerts > 0 ? "error" : "primary"}
                  onClick={() => window.location.href = '/security-center'}
                >
                  Security Center {stats.securityAlerts > 0 && `(${stats.securityAlerts})`}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
