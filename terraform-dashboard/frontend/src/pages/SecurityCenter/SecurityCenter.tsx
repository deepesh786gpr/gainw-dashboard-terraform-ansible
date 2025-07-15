import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Button,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Shield as ShieldIcon,
  LockOpen as LockOpenIcon,
  VpnKey as VpnKeyIcon,
  Storage as StorageIcon,
  Public as PublicIcon,
  Code as CodeIcon,
} from '@mui/icons-material';

interface SecurityIssue {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  category: 'access' | 'encryption' | 'network' | 'compliance' | 'configuration';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved';
  detectedAt: string;
  remediation: string;
}

interface SecuritySummary {
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  securityScore: number;
  lastScanTime: string;
}

const SecurityCenter: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<SecurityIssue[]>([]);
  const [summary, setSummary] = useState<SecuritySummary | null>(null);

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/security-center');
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      setIssues(data.issues);
      setSummary(data.summary);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching security data:', error);
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'error';
      case 'in_progress':
        return 'warning';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'access':
        return <VpnKeyIcon />;
      case 'encryption':
        return <LockOpenIcon />;
      case 'network':
        return <PublicIcon />;
      case 'compliance':
        return <ShieldIcon />;
      case 'configuration':
        return <CodeIcon />;
      default:
        return <SecurityIcon />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success.main';
    if (score >= 60) return 'warning.main';
    return 'error.main';
  };

  if (loading || !summary) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Security Center
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Security Center
        </Typography>
        <Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchSecurityData} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Security Report">
            <IconButton color="primary">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Security Score
                  </Typography>
                  <Typography variant="h4" component="div" sx={{ color: getScoreColor(summary.securityScore) }}>
                    {summary.securityScore}/100
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Last scan: {new Date(summary.lastScanTime).toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ color: getScoreColor(summary.securityScore) }}>
                  <SecurityIcon fontSize="large" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Open Issues
                  </Typography>
                  <Typography variant="h4" component="div" color="error.main">
                    {summary.totalIssues}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {summary.criticalIssues} critical, {summary.highIssues} high
                  </Typography>
                </Box>
                <Box color="error.main">
                  <WarningIcon fontSize="large" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Resource Coverage
                  </Typography>
                  <Typography variant="h4" component="div" color="info.main">
                    85%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    17 of 20 resources scanned
                  </Typography>
                </Box>
                <Box color="info.main">
                  <StorageIcon fontSize="large" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="security center tabs">
          <Tab label="All Issues" />
          <Tab label="Critical & High" />
          <Tab label="Resource Types" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Resource</TableCell>
                <TableCell>Issue</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Detected</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {issues.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      {getCategoryIcon(issue.category)}
                      <Box ml={1}>
                        <Typography variant="body2">{issue.resourceName}</Typography>
                        <Typography variant="caption" color="textSecondary">{issue.resourceType}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{issue.description}</TableCell>
                  <TableCell>
                    <Chip 
                      label={issue.category} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={issue.severity} 
                      color={getSeverityColor(issue.severity) as any} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={issue.status.replace('_', ' ')} 
                      color={getStatusColor(issue.status) as any} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>{new Date(issue.detectedAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined">
                      Remediate
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Resource</TableCell>
                <TableCell>Issue</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Remediation</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {issues
                .filter(issue => ['critical', 'high'].includes(issue.severity))
                .map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        {getCategoryIcon(issue.category)}
                        <Box ml={1}>
                          <Typography variant="body2">{issue.resourceName}</Typography>
                          <Typography variant="caption" color="textSecondary">{issue.resourceType}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{issue.description}</TableCell>
                    <TableCell>
                      <Chip 
                        label={issue.severity} 
                        color={getSeverityColor(issue.severity) as any} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>{issue.remediation}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" color="primary">
                        Fix Now
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Issues by Resource Type
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <PublicIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Security Groups" 
                      secondary="1 critical, 0 high, 1 medium issues" 
                    />
                    <ListItemSecondaryAction>
                      <Chip label="2" color="error" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider variant="inset" component="li" />
                  <ListItem>
                    <ListItemIcon>
                      <StorageIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="S3 Buckets" 
                      secondary="0 critical, 1 high, 0 medium issues" 
                    />
                    <ListItemSecondaryAction>
                      <Chip label="1" color="error" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider variant="inset" component="li" />
                  <ListItem>
                    <ListItemIcon>
                      <CodeIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="EC2 Instances" 
                      secondary="0 critical, 1 high, 0 medium issues" 
                    />
                    <ListItemSecondaryAction>
                      <Chip label="1" color="error" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider variant="inset" component="li" />
                  <ListItem>
                    <ListItemIcon>
                      <VpnKeyIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="IAM Policies" 
                      secondary="0 critical, 0 high, 1 medium issues" 
                    />
                    <ListItemSecondaryAction>
                      <Chip label="1" color="warning" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Issues by Category
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <PublicIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Network Security" 
                      secondary="1 critical, 0 high, 0 medium issues" 
                    />
                    <ListItemSecondaryAction>
                      <Chip label="1" color="error" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider variant="inset" component="li" />
                  <ListItem>
                    <ListItemIcon>
                      <LockOpenIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Encryption" 
                      secondary="0 critical, 1 high, 0 medium issues" 
                    />
                    <ListItemSecondaryAction>
                      <Chip label="1" color="error" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider variant="inset" component="li" />
                  <ListItem>
                    <ListItemIcon>
                      <ShieldIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Compliance" 
                      secondary="0 critical, 1 high, 0 medium, 1 low issues" 
                    />
                    <ListItemSecondaryAction>
                      <Chip label="2" color="error" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider variant="inset" component="li" />
                  <ListItem>
                    <ListItemIcon>
                      <VpnKeyIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Access Control" 
                      secondary="0 critical, 0 high, 1 medium issues" 
                    />
                    <ListItemSecondaryAction>
                      <Chip label="1" color="warning" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default SecurityCenter;