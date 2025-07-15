import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
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
  Badge,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  CloudQueue as VpcIcon,
  Router as RouterIcon,
  Security as SecurityIcon,
  Storage as SubnetIcon,
  Public as InternetIcon,
  VpnLock as NatIcon,
  Link as EndpointIcon,
  Shield as AclIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://192.168.31.94:5000';

interface VPCResource {
  id: string;
  name: string;
  cidrBlock: string;
  state: string;
  isDefault: boolean;
  tags: Array<{ Key: string; Value: string }>;
  resources: {
    subnets: Array<{
      id: string;
      name: string;
      cidrBlock: string;
      availabilityZone: string;
      state: string;
      availableIpAddressCount: number;
      tags: Array<{ Key: string; Value: string }>;
    }>;
    routeTables: Array<{
      id: string;
      name: string;
      associations: Array<{
        id: string;
        main: boolean;
        subnetId: string;
      }>;
      routes: Array<{
        destinationCidr: string;
        gatewayId: string;
        natGatewayId: string;
        state: string;
      }>;
      tags: Array<{ Key: string; Value: string }>;
    }>;
    securityGroups: Array<{
      id: string;
      name: string;
      description: string;
      ingressRules: Array<{
        protocol: string;
        fromPort: number;
        toPort: number;
        ipRanges: string[];
      }>;
      egressRules: Array<{
        protocol: string;
        fromPort: number;
        toPort: number;
        ipRanges: string[];
      }>;
      tags: Array<{ Key: string; Value: string }>;
    }>;
    networkAcls: Array<{
      id: string;
      name: string;
      isDefault: boolean;
      entries: Array<{
        ruleNumber: number;
        protocol: string;
        egress: boolean;
        cidrBlock: string;
        action: string;
        portRange: { From: number; To: number };
      }>;
      associations: Array<{
        id: string;
        subnetId: string;
      }>;
      tags: Array<{ Key: string; Value: string }>;
    }>;
    internetGateways: Array<{
      id: string;
      name: string;
      attachments: Array<{
        state: string;
        vpcId: string;
      }>;
      tags: Array<{ Key: string; Value: string }>;
    }>;
    natGateways: Array<{
      id: string;
      name: string;
      state: string;
      subnetId: string;
      publicIp: string;
      privateIp: string;
      tags: Array<{ Key: string; Value: string }>;
    }>;
    vpcEndpoints: Array<{
      id: string;
      name: string;
      type: string;
      state: string;
      serviceName: string;
      tags: Array<{ Key: string; Value: string }>;
    }>;
  };
}

const VPCResources: React.FC = () => {
  const [vpcs, setVpcs] = useState<VPCResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedVpc, setExpandedVpc] = useState<string | false>(false);
  const { tokens } = useAuth();

  const fetchVPCResources = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/vpc-resources`, {
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch VPC resources');
      }

      const data = await response.json();
      setVpcs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch VPC resources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVPCResources();
  }, []);

  const handleAccordionChange = (vpcId: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedVpc(isExpanded ? vpcId : false);
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'available':
      case 'attached':
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
      case 'detached':
        return 'error';
      default:
        return 'default';
    }
  };

  const ResourceSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    count: number;
    children: React.ReactNode;
  }> = ({ title, icon, count, children }) => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          {icon}
          <Typography variant="h6">{title}</Typography>
          <Badge badgeContent={count} color="primary" />
        </Box>
        {children}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          VPC Resources
        </Typography>
        <Tooltip title="Refresh VPC Resources">
          <IconButton onClick={fetchVPCResources} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
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
        <Grid container spacing={3}>
          {vpcs.length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">
                No VPCs found in your AWS account.
              </Alert>
            </Grid>
          ) : (
            vpcs.map((vpc) => (
              <Grid item xs={12} key={vpc.id}>
                <Accordion
                  expanded={expandedVpc === vpc.id}
                  onChange={handleAccordionChange(vpc.id)}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={2} width="100%">
                      <VpcIcon color="primary" />
                      <Box>
                        <Typography variant="h6">
                          {vpc.name}
                          {vpc.isDefault && (
                            <Chip
                              label="Default"
                              size="small"
                              color="primary"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {vpc.id} • {vpc.cidrBlock} • 
                          <Chip
                            label={vpc.state}
                            size="small"
                            color={getStateColor(vpc.state)}
                            sx={{ ml: 1 }}
                          />
                        </Typography>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {/* Subnets */}
                      <Grid item xs={12} md={6}>
                        <ResourceSection
                          title="Subnets"
                          icon={<SubnetIcon color="primary" />}
                          count={vpc.resources.subnets.length}
                        >
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Name</TableCell>
                                  <TableCell>CIDR</TableCell>
                                  <TableCell>AZ</TableCell>
                                  <TableCell>Available IPs</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {vpc.resources.subnets.map((subnet) => (
                                  <TableRow key={subnet.id}>
                                    <TableCell>{subnet.name}</TableCell>
                                    <TableCell>{subnet.cidrBlock}</TableCell>
                                    <TableCell>{subnet.availabilityZone}</TableCell>
                                    <TableCell>{subnet.availableIpAddressCount}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </ResourceSection>
                      </Grid>

                      {/* Route Tables */}
                      <Grid item xs={12} md={6}>
                        <ResourceSection
                          title="Route Tables"
                          icon={<RouterIcon color="primary" />}
                          count={vpc.resources.routeTables.length}
                        >
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Name</TableCell>
                                  <TableCell>Routes</TableCell>
                                  <TableCell>Associations</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {vpc.resources.routeTables.map((rt) => (
                                  <TableRow key={rt.id}>
                                    <TableCell>{rt.name}</TableCell>
                                    <TableCell>{rt.routes?.length || 0}</TableCell>
                                    <TableCell>{rt.associations?.length || 0}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </ResourceSection>
                      </Grid>

                      {/* Security Groups */}
                      <Grid item xs={12} md={6}>
                        <ResourceSection
                          title="Security Groups"
                          icon={<SecurityIcon color="primary" />}
                          count={vpc.resources.securityGroups.length}
                        >
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Name</TableCell>
                                  <TableCell>Description</TableCell>
                                  <TableCell>Rules</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {vpc.resources.securityGroups.map((sg) => (
                                  <TableRow key={sg.id}>
                                    <TableCell>{sg.name}</TableCell>
                                    <TableCell>{sg.description}</TableCell>
                                    <TableCell>
                                      {(sg.ingressRules?.length || 0) + (sg.egressRules?.length || 0)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </ResourceSection>
                      </Grid>

                      {/* Internet Gateways */}
                      <Grid item xs={12} md={6}>
                        <ResourceSection
                          title="Internet Gateways"
                          icon={<InternetIcon color="primary" />}
                          count={vpc.resources.internetGateways.length}
                        >
                          {vpc.resources.internetGateways.length > 0 ? (
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>State</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {vpc.resources.internetGateways.map((igw) => (
                                    <TableRow key={igw.id}>
                                      <TableCell>{igw.name}</TableCell>
                                      <TableCell>
                                        <Chip
                                          label={igw.attachments?.[0]?.state || 'Unknown'}
                                          size="small"
                                          color={getStateColor(igw.attachments?.[0]?.state || '')}
                                        />
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No Internet Gateways
                            </Typography>
                          )}
                        </ResourceSection>
                      </Grid>

                      {/* NAT Gateways */}
                      <Grid item xs={12} md={6}>
                        <ResourceSection
                          title="NAT Gateways"
                          icon={<NatIcon color="primary" />}
                          count={vpc.resources.natGateways.length}
                        >
                          {vpc.resources.natGateways.length > 0 ? (
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>State</TableCell>
                                    <TableCell>Public IP</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {vpc.resources.natGateways.map((nat) => (
                                    <TableRow key={nat.id}>
                                      <TableCell>{nat.name}</TableCell>
                                      <TableCell>
                                        <Chip
                                          label={nat.state}
                                          size="small"
                                          color={getStateColor(nat.state)}
                                        />
                                      </TableCell>
                                      <TableCell>{nat.publicIp || 'N/A'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No NAT Gateways
                            </Typography>
                          )}
                        </ResourceSection>
                      </Grid>

                      {/* VPC Endpoints */}
                      <Grid item xs={12} md={6}>
                        <ResourceSection
                          title="VPC Endpoints"
                          icon={<EndpointIcon color="primary" />}
                          count={vpc.resources.vpcEndpoints.length}
                        >
                          {vpc.resources.vpcEndpoints.length > 0 ? (
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Service</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {vpc.resources.vpcEndpoints.map((endpoint) => (
                                    <TableRow key={endpoint.id}>
                                      <TableCell>{endpoint.name}</TableCell>
                                      <TableCell>{endpoint.type}</TableCell>
                                      <TableCell>{endpoint.serviceName}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No VPC Endpoints
                            </Typography>
                          )}
                        </ResourceSection>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            ))
          )}
        </Grid>
      )}
    </Box>
  );
};

export default VPCResources;
