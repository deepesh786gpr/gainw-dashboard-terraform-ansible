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
} from '@mui/material';
import {
  AttachMoney as CostIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

interface ResourceCost {
  id: string;
  name: string;
  type: string;
  region: string;
  hourlyCost: number;
  monthlyCost: number;
  status: string;
}

interface CostRecommendation {
  id: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  recommendation: string;
  potentialSavings: number;
  severity: 'high' | 'medium' | 'low';
}

const CostAnalysis: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<ResourceCost[]>([]);
  const [recommendations, setRecommendations] = useState<CostRecommendation[]>([]);
  const [totalMonthlyCost, setTotalMonthlyCost] = useState(0);
  const [potentialSavings, setPotentialSavings] = useState(0);

  useEffect(() => {
    fetchCostData();
  }, []);

  const fetchCostData = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/cost-analysis');
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      setResources(data.resources);
      setRecommendations(data.recommendations);
      setTotalMonthlyCost(data.totalMonthlyCost);
      setPotentialSavings(data.potentialSavings);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching cost data:', error);
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
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
      case 'running':
      case 'in-use':
        return 'success';
      case 'stopped':
        return 'error';
      case 'available':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Cost Analysis
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Cost Analysis
        </Typography>
        <Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchCostData} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Cost Report">
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
                    Estimated Monthly Cost
                  </Typography>
                  <Typography variant="h4" component="div" color="primary.main">
                    ${totalMonthlyCost.toFixed(2)}
                  </Typography>
                </Box>
                <Box color="primary.main">
                  <CostIcon fontSize="large" />
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
                    Potential Monthly Savings
                  </Typography>
                  <Typography variant="h4" component="div" color="secondary.main">
                    ${potentialSavings.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {((potentialSavings / totalMonthlyCost) * 100).toFixed(1)}% of total cost
                  </Typography>
                </Box>
                <Box color="secondary.main">
                  <TrendingDownIcon fontSize="large" />
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
                    Optimization Recommendations
                  </Typography>
                  <Typography variant="h4" component="div" color="info.main">
                    {recommendations.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {recommendations.filter(r => r.severity === 'high').length} high priority
                  </Typography>
                </Box>
                <Box color="info.main">
                  {recommendations.length > 0 ? <WarningIcon fontSize="large" /> : <CheckCircleIcon fontSize="large" />}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="cost analysis tabs">
          <Tab label="Resources" />
          <Tab label="Recommendations" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Resource Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Region</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Hourly Cost</TableCell>
                <TableCell align="right">Monthly Cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resources.map((resource) => (
                <TableRow key={resource.id}>
                  <TableCell>{resource.name}</TableCell>
                  <TableCell>{resource.type}</TableCell>
                  <TableCell>{resource.region}</TableCell>
                  <TableCell>
                    <Chip 
                      label={resource.status} 
                      color={getStatusColor(resource.status) as any} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell align="right">${resource.hourlyCost.toFixed(4)}</TableCell>
                  <TableCell align="right">${resource.monthlyCost.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} />
                <TableCell align="right">
                  <Typography variant="subtitle1" fontWeight="bold">Total</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="subtitle1" fontWeight="bold">
                    ${totalMonthlyCost.toFixed(2)}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tabValue === 1 && (
        <>
          {recommendations.length === 0 ? (
            <Alert severity="success">No cost optimization recommendations at this time.</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Resource</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Recommendation</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell align="right">Potential Savings</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recommendations.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>{rec.resourceName}</TableCell>
                      <TableCell>{rec.resourceType}</TableCell>
                      <TableCell>{rec.recommendation}</TableCell>
                      <TableCell>
                        <Chip 
                          label={rec.severity} 
                          color={getSeverityColor(rec.severity) as any} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell align="right">${rec.potentialSavings.toFixed(2)}/month</TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined">
                          Apply
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={4} />
                    <TableCell align="right">
                      <Typography variant="subtitle1" fontWeight="bold">
                        Total Potential Savings
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle1" fontWeight="bold" color="secondary.main">
                        ${potentialSavings.toFixed(2)}/month
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  );
};

export default CostAnalysis;