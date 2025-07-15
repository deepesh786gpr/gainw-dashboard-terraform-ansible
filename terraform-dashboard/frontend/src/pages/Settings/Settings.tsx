import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Save as SaveIcon,
  CloudQueue as AWSIcon,
  Build as TerraformIcon,
  Notifications as NotificationIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const Settings: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [settings, setSettings] = useState({
    aws: {
      region: 'us-east-1',
      profile: 'default',
      accessKeyId: '',
      secretAccessKey: '',
    },
    terraform: {
      binaryPath: '/usr/local/bin/terraform',
      terragruntPath: '/usr/local/bin/terragrunt',
      workingDirectory: './terraform-workspace',
      autoApprove: false,
      parallelism: 10,
    },
    notifications: {
      emailEnabled: true,
      slackEnabled: false,
      emailAddress: '',
      slackWebhook: '',
      notifyOnSuccess: true,
      notifyOnFailure: true,
    },
    security: {
      requireApproval: true,
      sessionTimeout: 60,
      enableAuditLog: true,
      restrictDestructiveOperations: true,
    },
    general: {
      theme: 'light',
      autoRefresh: true,
      refreshInterval: 30,
      defaultEnvironment: 'dev',
    },
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSettingChange = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value,
      },
    }));
  };

  const handleSaveSettings = async () => {
    try {
      console.log('Saving settings:', settings);
      // Simulate API call
      setTimeout(() => {
        alert('Settings saved successfully!');
      }, 500);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Settings</Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveSettings}
        >
          Save Settings
        </Button>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab icon={<AWSIcon />} label="AWS Configuration" />
            <Tab icon={<TerraformIcon />} label="Terraform" />
            <Tab icon={<NotificationIcon />} label="Notifications" />
            <Tab icon={<SecurityIcon />} label="Security" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Typography variant="h6" gutterBottom>
            AWS Configuration
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            Configure your AWS credentials and default settings. These will be used for all Terraform operations.
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>AWS Region</InputLabel>
                <Select
                  value={settings.aws.region}
                  label="AWS Region"
                  onChange={(e) => handleSettingChange('aws', 'region', e.target.value)}
                >
                  <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
                  <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
                  <MenuItem value="eu-west-1">Europe (Ireland)</MenuItem>
                  <MenuItem value="ap-southeast-1">Asia Pacific (Singapore)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="AWS Profile"
                value={settings.aws.profile}
                onChange={(e) => handleSettingChange('aws', 'profile', e.target.value)}
                helperText="AWS CLI profile to use"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Access Key ID"
                value={settings.aws.accessKeyId}
                onChange={(e) => handleSettingChange('aws', 'accessKeyId', e.target.value)}
                type="password"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Secret Access Key"
                value={settings.aws.secretAccessKey}
                onChange={(e) => handleSettingChange('aws', 'secretAccessKey', e.target.value)}
                type="password"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="AWS Access Key ID"
                value={settings.aws.accessKey}
                onChange={(e) => handleSettingChange('aws', 'accessKey', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="AWS Secret Access Key"
                type="password"
                value={settings.aws.secretKey}
                onChange={(e) => handleSettingChange('aws', 'secretKey', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.aws.useInstanceProfile}
                    onChange={(e) => handleSettingChange('aws', 'useInstanceProfile', e.target.checked)}
                  />
                }
                label="Use EC2 Instance Profile"
              />
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom mt={4}>
            Terraform Settings
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Terraform Binary Path"
                value={settings.terraform.binaryPath}
                onChange={(e) => handleSettingChange('terraform', 'binaryPath', e.target.value)}
                placeholder="/usr/local/bin/terraform"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Terragrunt Binary Path"
                value={settings.terraform.terragruntPath}
                onChange={(e) => handleSettingChange('terraform', 'terragruntPath', e.target.value)}
                placeholder="/usr/local/bin/terragrunt"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Default Working Directory"
                value={settings.terraform.workingDir}
                onChange={(e) => handleSettingChange('terraform', 'workingDir', e.target.value)}
                placeholder="/path/to/terraform/files"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="State File Location"
                value={settings.terraform.stateFileLocation}
                onChange={(e) => handleSettingChange('terraform', 'stateFileLocation', e.target.value)}
                placeholder="s3://my-terraform-states"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.terraform.autoApprove}
                    onChange={(e) => handleSettingChange('terraform', 'autoApprove', e.target.checked)}
                  />
                }
                label="Auto-approve Terraform Apply"
              />
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom mt={4}>
            Security Settings
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.security.enforceStrongPasswords}
                    onChange={(e) => handleSettingChange('security', 'enforceStrongPasswords', e.target.checked)}
                  />
                }
                label="Enforce Strong Passwords"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Session Timeout (minutes)"
                type="number"
                value={settings.security.sessionTimeout}
                onChange={(e) => handleSettingChange('security', 'sessionTimeout', parseInt(e.target.value))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.security.enableMFA}
                    onChange={(e) => handleSettingChange('security', 'enableMFA', e.target.checked)}
                  />
                }
                label="Enable Multi-Factor Authentication"
              />
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom mt={4}>
            Notification Settings
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Notification Method</InputLabel>
                <Select
                  value={settings.notifications.method}
                  label="Notification Method"
                  onChange={(e) => handleSettingChange('notifications', 'method', e.target.value)}
                >
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="slack">Slack</MenuItem>
                  <MenuItem value="webhook">Webhook</MenuItem>
                  <MenuItem value="none">None</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              {settings.notifications.method === 'email' && (
                <TextField
                  fullWidth
                  margin="normal"
                  label="Email Address"
                  value={settings.notifications.emailAddress}
                  onChange={(e) => handleSettingChange('notifications', 'emailAddress', e.target.value)}
                />
              )}
              {settings.notifications.method === 'slack' && (
                <TextField
                  fullWidth
                  margin="normal"
                  label="Slack Webhook URL"
                  value={settings.notifications.slackWebhook}
                  onChange={(e) => handleSettingChange('notifications', 'slackWebhook', e.target.value)}
                />
              )}
              {settings.notifications.method === 'webhook' && (
                <TextField
                  fullWidth
                  margin="normal"
                  label="Webhook URL"
                  value={settings.notifications.webhookUrl}
                  onChange={(e) => handleSettingChange('notifications', 'webhookUrl', e.target.value)}
                />
              )}
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom mt={4}>
            Advanced Settings
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.advanced.enableDebugMode}
                    onChange={(e) => handleSettingChange('advanced', 'enableDebugMode', e.target.checked)}
                  />
                }
                label="Enable Debug Mode"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.advanced.collectAnonymousUsage}
                    onChange={(e) => handleSettingChange('advanced', 'collectAnonymousUsage', e.target.checked)}
                  />
                }
                label="Collect Anonymous Usage Data"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.advanced.enableExperimentalFeatures}
                    onChange={(e) => handleSettingChange('advanced', 'enableExperimentalFeatures', e.target.checked)}
                  />
                }
                label="Enable Experimental Features"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="API Endpoint"
                value={settings.advanced.apiEndpoint}
                onChange={(e) => handleSettingChange('advanced', 'apiEndpoint', e.target.value)}
                placeholder="http://localhost:5000/api"
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Terraform Configuration
          </Typography>
          <Alert severity="warning" sx={{ mb: 3 }}>
            Ensure Terraform and Terragrunt are installed and accessible at the specified paths.
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Terraform Binary Path"
                value={settings.terraform.binaryPath}
                onChange={(e) => handleSettingChange('terraform', 'binaryPath', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Terragrunt Binary Path"
                value={settings.terraform.terragruntPath}
                onChange={(e) => handleSettingChange('terraform', 'terragruntPath', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Working Directory"
                value={settings.terraform.workingDirectory}
                onChange={(e) => handleSettingChange('terraform', 'workingDirectory', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Parallelism"
                type="number"
                value={settings.terraform.parallelism}
                onChange={(e) => handleSettingChange('terraform', 'parallelism', parseInt(e.target.value))}
                helperText="Number of concurrent operations"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.terraform.autoApprove}
                    onChange={(e) => handleSettingChange('terraform', 'autoApprove', e.target.checked)}
                  />
                }
                label="Auto-approve Terraform operations (not recommended for production)"
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Notification Settings
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            Configure notifications for deployment status updates.
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.emailEnabled}
                    onChange={(e) => handleSettingChange('notifications', 'emailEnabled', e.target.checked)}
                  />
                }
                label="Enable Email Notifications"
              />
            </Grid>
            {settings.notifications.emailEnabled && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  margin="normal"
                  label="Email Address"
                  type="email"
                  value={settings.notifications.emailAddress}
                  onChange={(e) => handleSettingChange('notifications', 'emailAddress', e.target.value)}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.slackEnabled}
                    onChange={(e) => handleSettingChange('notifications', 'slackEnabled', e.target.checked)}
                  />
                }
                label="Enable Slack Notifications"
              />
            </Grid>
            {settings.notifications.slackEnabled && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  margin="normal"
                  label="Slack Webhook URL"
                  value={settings.notifications.slackWebhook}
                  onChange={(e) => handleSettingChange('notifications', 'slackWebhook', e.target.value)}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Notification Triggers
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.notifyOnSuccess}
                    onChange={(e) => handleSettingChange('notifications', 'notifyOnSuccess', e.target.checked)}
                  />
                }
                label="Notify on successful deployments"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.notifyOnFailure}
                    onChange={(e) => handleSettingChange('notifications', 'notifyOnFailure', e.target.checked)}
                  />
                }
                label="Notify on failed deployments"
              />
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Security Settings
          </Typography>
          <Alert severity="warning" sx={{ mb: 3 }}>
            These settings control access and security policies for the dashboard.
          </Alert>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.security.requireApproval}
                    onChange={(e) => handleSettingChange('security', 'requireApproval', e.target.checked)}
                  />
                }
                label="Require manual approval for deployments"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.security.restrictDestructiveOperations}
                    onChange={(e) => handleSettingChange('security', 'restrictDestructiveOperations', e.target.checked)}
                  />
                }
                label="Restrict destructive operations (destroy, force operations)"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.security.enableAuditLog}
                    onChange={(e) => handleSettingChange('security', 'enableAuditLog', e.target.checked)}
                  />
                }
                label="Enable audit logging"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Session Timeout (minutes)"
                type="number"
                value={settings.security.sessionTimeout}
                onChange={(e) => handleSettingChange('security', 'sessionTimeout', parseInt(e.target.value))}
              />
            </Grid>
          </Grid>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default Settings;
