import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  Paper,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
} from '@mui/material';
import {
  GitHub as GitHubIcon,
  Code as CodeIcon,
  CheckCircle as CheckIcon,
  Storage as StorageIcon,
  Build as AnsibleIcon,
  AccountTree as TerraformIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://192.168.31.94:5000';

interface AnalysisResult {
  hasTerraform: boolean;
  hasAnsible: boolean;
  terraformFiles: string[];
  ansibleFiles: string[];
  mainFiles: string[];
  suggestedName: string;
  message: string;
  fileType: 'terraform' | 'ansible';
}

interface TemplateResult {
  id: string;
  name: string;
  type: 'terraform' | 'ansible';
}

const TestIntegration: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoType, setRepoType] = useState<'terraform' | 'ansible' | 'mixed'>('terraform');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [templateResult, setTemplateResult] = useState<TemplateResult | null>(null);
  const [canCreateBoth, setCanCreateBoth] = useState(false);
  const [selectedType, setSelectedType] = useState<'terraform' | 'ansible'>('terraform');
  const [step, setStep] = useState(1);
  
  const navigate = useNavigate();

  const testIntegration = async () => {
    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setTemplateResult(null);
    setCanCreateBoth(false);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/github/test-integration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoType }),
      });

      if (!response.ok) {
        throw new Error('Failed to test integration');
      }

      const result = await response.json();
      
      if (result.success) {
        setAnalysisResult(result.analysis);
        
        if (result.canCreateBoth) {
          setCanCreateBoth(true);
          setStep(2);
        } else if (result.template) {
          setTemplateResult(result.template);
          setStep(3);
        }
      } else {
        setError(result.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test integration');
    } finally {
      setLoading(false);
    }
  };
  
  const createTemplate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/github/test-integration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoType: selectedType }),
      });

      if (!response.ok) {
        throw new Error('Failed to create template');
      }

      const result = await response.json();
      
      if (result.success && result.template) {
        setTemplateResult(result.template);
        setStep(3);
      } else {
        setError(result.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };
  
  const viewTemplate = () => {
    if (templateResult) {
      if (templateResult.type === 'terraform') {
        navigate('/templates');
      } else {
        navigate('/ansible-scripts');
      }
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GitHub Integration Test
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        This is a demonstration of the GitHub repository integration workflow. It simulates the process of analyzing a repository, detecting file types, and creating templates.
      </Alert>
      
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={step - 1}>
            <Tab label="1. Select Repository Type" />
            <Tab label="2. Analyze Repository" disabled={step < 2} />
            <Tab label="3. Create Template" disabled={step < 3} />
          </Tabs>
        </Box>
      </Paper>
      
      {step === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Select Repository Type
            </Typography>
            
            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <FormLabel component="legend">Repository Content Type</FormLabel>
              <RadioGroup
                value={repoType}
                onChange={(e) => setRepoType(e.target.value as 'terraform' | 'ansible' | 'mixed')}
              >
                <FormControlLabel 
                  value="terraform" 
                  control={<Radio />} 
                  label={
                    <Box display="flex" alignItems="center">
                      <TerraformIcon color="primary" sx={{ mr: 1 }} />
                      <Typography>Terraform Repository (.tf files)</Typography>
                    </Box>
                  } 
                />
                <FormControlLabel 
                  value="ansible" 
                  control={<Radio />} 
                  label={
                    <Box display="flex" alignItems="center">
                      <AnsibleIcon color="secondary" sx={{ mr: 1 }} />
                      <Typography>Ansible Repository (.yml files)</Typography>
                    </Box>
                  } 
                />
                <FormControlLabel 
                  value="mixed" 
                  control={<Radio />} 
                  label={
                    <Box display="flex" alignItems="center">
                      <GitHubIcon color="action" sx={{ mr: 1 }} />
                      <Typography>Mixed Repository (both Terraform and Ansible)</Typography>
                    </Box>
                  } 
                />
              </RadioGroup>
            </FormControl>
            
            <Button
              variant="contained"
              startIcon={<GitHubIcon />}
              onClick={testIntegration}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Analyze Repository'}
            </Button>
          </CardContent>
        </Card>
      )}
      
      {step === 2 && analysisResult && canCreateBoth && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Repository Analysis Results
            </Typography>
            
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body1">
                <strong>Repository contains both Terraform and Ansible files!</strong>
              </Typography>
              <Typography variant="body2">
                {analysisResult.message}
              </Typography>
            </Alert>
            
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <TerraformIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="subtitle1">Terraform Files</Typography>
                  </Box>
                  <List dense>
                    {analysisResult.terraformFiles.map((file) => (
                      <ListItem key={file}>
                        <ListItemIcon><CodeIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary={file} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <AnsibleIcon color="secondary" sx={{ mr: 1 }} />
                    <Typography variant="subtitle1">Ansible Files</Typography>
                  </Box>
                  <List dense>
                    {analysisResult.ansibleFiles.map((file) => (
                      <ListItem key={file}>
                        <ListItemIcon><CodeIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary={file} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
            </Grid>
            
            <Typography variant="subtitle1" gutterBottom>
              Select Template Type to Create:
            </Typography>
            
            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <RadioGroup
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as 'terraform' | 'ansible')}
              >
                <FormControlLabel 
                  value="terraform" 
                  control={<Radio />} 
                  label="Create Terraform Template" 
                />
                <FormControlLabel 
                  value="ansible" 
                  control={<Radio />} 
                  label="Create Ansible Template" 
                />
              </RadioGroup>
            </FormControl>
            
            <Button
              variant="contained"
              onClick={createTemplate}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Create Template'}
            </Button>
          </CardContent>
        </Card>
      )}
      
      {step === 3 && templateResult && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Template Created Successfully
            </Typography>
            
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body1">
                <strong>{templateResult.name}</strong> has been created successfully!
              </Typography>
              <Typography variant="body2">
                Template ID: {templateResult.id}
              </Typography>
            </Alert>
            
            <Box display="flex" alignItems="center" mb={3}>
              {templateResult.type === 'terraform' ? (
                <TerraformIcon color="primary" sx={{ mr: 1, fontSize: 40 }} />
              ) : (
                <AnsibleIcon color="secondary" sx={{ mr: 1, fontSize: 40 }} />
              )}
              
              <Box>
                <Typography variant="h6">
                  {templateResult.name}
                </Typography>
                <Chip 
                  label={templateResult.type === 'terraform' ? 'Terraform' : 'Ansible'} 
                  color={templateResult.type === 'terraform' ? 'primary' : 'secondary'}
                  size="small"
                />
              </Box>
            </Box>
            
            <Typography variant="body1" paragraph>
              Your {templateResult.type === 'terraform' ? 'Terraform' : 'Ansible'} template has been successfully created and is now available in the {templateResult.type === 'terraform' ? 'Templates' : 'Ansible Scripts'} section.
            </Typography>
            
            <Box display="flex" justifyContent="space-between">
              <Button
                variant="outlined"
                startIcon={<GitHubIcon />}
                onClick={() => setStep(1)}
              >
                Test Another Repository
              </Button>
              
              <Button
                variant="contained"
                endIcon={<ArrowIcon />}
                onClick={viewTemplate}
              >
                View {templateResult.type === 'terraform' ? 'Template' : 'Script'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default TestIntegration;
