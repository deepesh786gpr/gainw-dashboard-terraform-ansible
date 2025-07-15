import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Settings as SettingsIcon,
  CloudQueue as ClusterIcon,
  Computer as NodeIcon,
  Apps as PodIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkIcon,
} from '@mui/icons-material';

interface Cluster {
  id: string;
  name: string;
  status: string;
  version: string;
  platformVersion: string;
  endpoint: string;
  createdAt: string;
  region: string;
  environment: string;
  nodeGroups: NodeGroup[];
  tags: Record<string, string>;
}

interface NodeGroup {
  name: string;
  status: string;
  instanceTypes: string[];
  desiredSize: number;
  minSize: number;
  maxSize: number;
  amiType: string;
  capacityType: string;
}

interface ClusterDetails extends Cluster {
  vpc: {
    id: string;
    cidr: string;
    subnets: {
      private: Array<{ id: string; cidr: string; az: string }>;
      public: Array<{ id: string; cidr: string; az: string }>;
    };
  };
  security: {
    clusterSecurityGroup: string;
    nodeSecurityGroup: string;
    endpointAccess: {
      private: boolean;
      public: boolean;
      publicCidrs: string[];
    };
  };
  iam: {
    clusterRole: string;
    nodeGroupRole: string;
  };
  logging: {
    enabled: string[];
    logGroup: string;
  };
  addons: Array<{
    name: string;
    version: string;
    status: string;
  }>;
  metrics: {
    cpuUtilization: number;
    memoryUtilization: number;
    networkIn: number;
    networkOut: number;
    podCount: number;
    nodeCount: number;
  };
}

interface Node {
  id: string;
  name: string;
  instanceType: string;
  status: string;
  version: string;
  createdAt: string;
  nodeGroup: string;
  availabilityZone: string;
  privateIp: string;
  resources: {
    cpu: number;
    memory: number;
    pods: number;
  };
}

interface Pod {
  id: string;
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  age: string;
  node: string;
  ready: string;
  cpu: number;
  memory: number;
}

const Clusters: React.FC = () => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<ClusterDetails | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    fetchClusters();
  }, []);

  const fetchClusters = async () => {
    try {
      setLoading(true);
      console.log('Fetching real EKS clusters...');
      const response = await fetch('http://localhost:5000/api/clusters');
      if (response.ok) {
        const data = await response.json();
        setClusters(data);
        console.log(`Found ${data.length} real EKS clusters`);

        if (data.length === 0) {
          console.log('No EKS clusters found. This could mean:');
          console.log('1. No EKS clusters exist in your AWS account');
          console.log('2. AWS credentials are not configured');
          console.log('3. The configured AWS region has no clusters');
        }
      } else {
        console.error('Failed to fetch clusters:', response.status);
        setClusters([]);
      }
    } catch (error) {
      console.error('Error fetching clusters:', error);
      console.log('Unable to fetch real AWS EKS data. Please check:');
      console.log('1. AWS credentials are configured');
      console.log('2. AWS region is set correctly');
      console.log('3. IAM permissions for EKS access');
      setClusters([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchClusterDetails = async (clusterId: string) => {
    try {
      setLoading(true);
      
      // Fetch cluster details
      const detailsResponse = await fetch(`http://localhost:5000/api/clusters/${clusterId}/details`);
      const details = await detailsResponse.json();
      setSelectedCluster(details);

      // Fetch nodes
      const nodesResponse = await fetch(`http://localhost:5000/api/clusters/${clusterId}/nodes`);
      const nodesData = await nodesResponse.json();
      setNodes(nodesData);

      // Fetch pods
      const podsResponse = await fetch(`http://localhost:5000/api/clusters/${clusterId}/pods`);
      const podsData = await podsResponse.json();
      setPods(podsData);

      setDetailsDialog(true);
    } catch (error) {
      console.error('Error fetching cluster details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'running':
      case 'ready':
        return 'success';
      case 'creating':
      case 'pending':
        return 'warning';
      case 'deleting':
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatMetric = (value: number, unit: string = '%') => {
    return `${value.toFixed(1)}${unit}`;
  };

  const TabPanel = ({ children, value, index }: any) => (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          EKS Clusters
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchClusters}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        {clusters.map((cluster) => (
          <Grid item xs={12} md={6} lg={4} key={cluster.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box>
                    <Typography variant="h6" component="h2">
                      {cluster.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {cluster.id}
                    </Typography>
                  </Box>
                  <Chip
                    label={cluster.status}
                    color={getStatusColor(cluster.status) as any}
                    size="small"
                  />
                </Box>

                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    Version: {cluster.version}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Region: {cluster.region}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Environment: {cluster.environment}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Node Groups: {cluster.nodeGroups.length}
                  </Typography>
                </Box>

                <Box display="flex" gap={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ViewIcon />}
                    onClick={() => fetchClusterDetails(cluster.id)}
                  >
                    View Details
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {clusters.length === 0 && !loading && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No EKS clusters found. Deploy an EKS cluster using the Templates page.
        </Alert>
      )}

      {/* Cluster Details Dialog */}
      <Dialog open={detailsDialog} onClose={() => setDetailsDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <ClusterIcon />
            Cluster Details: {selectedCluster?.name}
            <Chip
              label={selectedCluster?.status}
              color={getStatusColor(selectedCluster?.status || '') as any}
              size="small"
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedCluster && (
            <>
              <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                <Tab label="Overview" />
                <Tab label="Nodes" />
                <Tab label="Pods" />
                <Tab label="Networking" />
                <Tab label="Security" />
              </Tabs>

              <TabPanel value={activeTab} index={0}>
                <Grid container spacing={3}>
                  {/* Cluster Info */}
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          <ClusterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Cluster Information
                        </Typography>
                        <Box sx={{ '& > *': { mb: 1 } }}>
                          <Typography variant="body2">
                            <strong>Name:</strong> {selectedCluster.name}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Version:</strong> {selectedCluster.version}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Platform Version:</strong> {selectedCluster.platformVersion}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Endpoint:</strong> {selectedCluster.endpoint}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Created:</strong> {new Date(selectedCluster.createdAt).toLocaleString()}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Metrics */}
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          📊 Cluster Metrics
                        </Typography>
                        <Box sx={{ '& > *': { mb: 2 } }}>
                          <Box>
                            <Typography variant="body2">CPU Utilization</Typography>
                            <LinearProgress
                              variant="determinate"
                              value={selectedCluster.metrics.cpuUtilization}
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                            <Typography variant="caption">
                              {formatMetric(selectedCluster.metrics.cpuUtilization)}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2">Memory Utilization</Typography>
                            <LinearProgress
                              variant="determinate"
                              value={selectedCluster.metrics.memoryUtilization}
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                            <Typography variant="caption">
                              {formatMetric(selectedCluster.metrics.memoryUtilization)}
                            </Typography>
                          </Box>
                          <Typography variant="body2">
                            <strong>Pods:</strong> {selectedCluster.metrics.podCount}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Nodes:</strong> {selectedCluster.metrics.nodeCount}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Node Groups */}
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          <NodeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Node Groups
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Instance Types</TableCell>
                                <TableCell>Desired</TableCell>
                                <TableCell>Min</TableCell>
                                <TableCell>Max</TableCell>
                                <TableCell>AMI Type</TableCell>
                                <TableCell>Capacity Type</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {selectedCluster.nodeGroups.map((nodeGroup) => (
                                <TableRow key={nodeGroup.name}>
                                  <TableCell>{nodeGroup.name}</TableCell>
                                  <TableCell>
                                    <Chip
                                      label={nodeGroup.status}
                                      color={getStatusColor(nodeGroup.status) as any}
                                      size="small"
                                    />
                                  </TableCell>
                                  <TableCell>{nodeGroup.instanceTypes.join(', ')}</TableCell>
                                  <TableCell>{nodeGroup.desiredSize}</TableCell>
                                  <TableCell>{nodeGroup.minSize}</TableCell>
                                  <TableCell>{nodeGroup.maxSize}</TableCell>
                                  <TableCell>{nodeGroup.amiType}</TableCell>
                                  <TableCell>{nodeGroup.capacityType}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Add-ons */}
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          🔌 Add-ons
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Version</TableCell>
                                <TableCell>Status</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {selectedCluster.addons.map((addon) => (
                                <TableRow key={addon.name}>
                                  <TableCell>{addon.name}</TableCell>
                                  <TableCell>{addon.version}</TableCell>
                                  <TableCell>
                                    <Chip
                                      label={addon.status}
                                      color={getStatusColor(addon.status) as any}
                                      size="small"
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={activeTab} index={1}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      <NodeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Cluster Nodes ({nodes.length})
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Instance Type</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Node Group</TableCell>
                            <TableCell>AZ</TableCell>
                            <TableCell>Private IP</TableCell>
                            <TableCell>CPU %</TableCell>
                            <TableCell>Memory %</TableCell>
                            <TableCell>Pods</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {nodes.map((node) => (
                            <TableRow key={node.id}>
                              <TableCell>{node.name}</TableCell>
                              <TableCell>{node.instanceType}</TableCell>
                              <TableCell>
                                <Chip
                                  label={node.status}
                                  color={getStatusColor(node.status) as any}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>{node.nodeGroup}</TableCell>
                              <TableCell>{node.availabilityZone}</TableCell>
                              <TableCell>{node.privateIp}</TableCell>
                              <TableCell>{formatMetric(node.resources.cpu)}</TableCell>
                              <TableCell>{formatMetric(node.resources.memory)}</TableCell>
                              <TableCell>{node.resources.pods}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </TabPanel>

              <TabPanel value={activeTab} index={2}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      <PodIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Cluster Pods ({pods.length})
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Namespace</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Ready</TableCell>
                            <TableCell>Restarts</TableCell>
                            <TableCell>Age</TableCell>
                            <TableCell>Node</TableCell>
                            <TableCell>CPU %</TableCell>
                            <TableCell>Memory %</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {pods.map((pod) => (
                            <TableRow key={pod.id}>
                              <TableCell>{pod.name}</TableCell>
                              <TableCell>{pod.namespace}</TableCell>
                              <TableCell>
                                <Chip
                                  label={pod.status}
                                  color={getStatusColor(pod.status) as any}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>{pod.ready}</TableCell>
                              <TableCell>{pod.restarts}</TableCell>
                              <TableCell>{pod.age}</TableCell>
                              <TableCell>{pod.node}</TableCell>
                              <TableCell>{formatMetric(pod.cpu)}</TableCell>
                              <TableCell>{formatMetric(pod.memory)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </TabPanel>

              <TabPanel value={activeTab} index={3}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          <NetworkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                          VPC Configuration
                        </Typography>
                        <Box sx={{ '& > *': { mb: 1 } }}>
                          <Typography variant="body2">
                            <strong>VPC ID:</strong> {selectedCluster.vpc.id}
                          </Typography>
                          <Typography variant="body2">
                            <strong>CIDR Block:</strong> {selectedCluster.vpc.cidr}
                          </Typography>
                        </Box>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom>
                          Private Subnets
                        </Typography>
                        {selectedCluster.vpc.subnets.private.map((subnet) => (
                          <Typography key={subnet.id} variant="body2">
                            {subnet.id} ({subnet.cidr}) - {subnet.az}
                          </Typography>
                        ))}
                        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                          Public Subnets
                        </Typography>
                        {selectedCluster.vpc.subnets.public.map((subnet) => (
                          <Typography key={subnet.id} variant="body2">
                            {subnet.id} ({subnet.cidr}) - {subnet.az}
                          </Typography>
                        ))}
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          🌐 Endpoint Access
                        </Typography>
                        <Box sx={{ '& > *': { mb: 1 } }}>
                          <Typography variant="body2">
                            <strong>Private Access:</strong>{' '}
                            <Chip
                              label={selectedCluster.security.endpointAccess.private ? 'Enabled' : 'Disabled'}
                              color={selectedCluster.security.endpointAccess.private ? 'success' : 'default'}
                              size="small"
                            />
                          </Typography>
                          <Typography variant="body2">
                            <strong>Public Access:</strong>{' '}
                            <Chip
                              label={selectedCluster.security.endpointAccess.public ? 'Enabled' : 'Disabled'}
                              color={selectedCluster.security.endpointAccess.public ? 'success' : 'default'}
                              size="small"
                            />
                          </Typography>
                          <Typography variant="body2">
                            <strong>Public CIDRs:</strong> {selectedCluster.security.endpointAccess.publicCidrs.join(', ')}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={activeTab} index={4}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Security Groups
                        </Typography>
                        <Box sx={{ '& > *': { mb: 1 } }}>
                          <Typography variant="body2">
                            <strong>Cluster Security Group:</strong> {selectedCluster.security.clusterSecurityGroup}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Node Security Group:</strong> {selectedCluster.security.nodeSecurityGroup}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          🔑 IAM Roles
                        </Typography>
                        <Box sx={{ '& > *': { mb: 1 } }}>
                          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                            <strong>Cluster Role:</strong> {selectedCluster.iam.clusterRole}
                          </Typography>
                          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                            <strong>Node Group Role:</strong> {selectedCluster.iam.nodeGroupRole}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          📝 Logging Configuration
                        </Typography>
                        <Box sx={{ '& > *': { mb: 1 } }}>
                          <Typography variant="body2">
                            <strong>Log Group:</strong> {selectedCluster.logging.logGroup}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Enabled Log Types:</strong> {selectedCluster.logging.enabled.join(', ')}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </TabPanel>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Clusters;
