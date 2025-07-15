import React, { useState, useEffect } from 'react';
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
  IconButton,
  Tooltip,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ViewModule as TemplateIcon,
  Code as CodeIcon,
  Settings as VariableIcon,
} from '@mui/icons-material';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';

interface Variable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'list';
  description: string;
  required: boolean;
  default?: any;
  options?: string[];
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  variables: Variable[] | any; // Can be array or object from API
  terraformCode: string;
  template_type?: string;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
}

const Templates: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const { tokens } = useAuth();

  // Helper function to safely get variables as array
  const getVariablesArray = (variables: any): Variable[] => {
    if (Array.isArray(variables)) {
      return variables;
    }
    if (typeof variables === 'object' && variables !== null) {
      // Convert object to array format
      return Object.entries(variables).map(([name, config]: [string, any]) => ({
        name,
        type: config.type || 'string',
        description: config.description || '',
        required: config.required || false,
        default: config.default
      }));
    }
    return [];
  };

  const { control, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      name: '',
      description: '',
      category: '',
      terraformCode: '',
      variables: [] as Variable[],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variables',
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Auto-refresh when tokens change (user logs in) or when page becomes visible
  useEffect(() => {
    if (tokens?.accessToken) {
      fetchTemplates();
    }
  }, [tokens?.accessToken]);

  // Auto-refresh when page becomes visible (user returns from another page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && tokens?.accessToken) {
        fetchTemplates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tokens?.accessToken]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/templates`, {
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const templatesData = await response.json();
      const allTemplates = Array.isArray(templatesData) ? templatesData : (templatesData.data || []);
      // Filter to show only Terraform templates (exclude Ansible)
      const terraformTemplates = allTemplates.filter((template: Template) =>
        !template.template_type || template.template_type === 'terraform'
      );
      setTemplates(terraformTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      // Fallback to mock data if API fails
      setTemplates([
        {
          id: '1',
          name: 'EC2 Instance',
          description: 'Deploy a single EC2 instance with security group',
          category: 'Compute',
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
              options: ['t3.nano', 't3.micro', 't3.small', 't3.medium'],
            },
          ],
          terraformCode: `resource "aws_instance" "main" {
  ami           = data.aws_ami.latest.id
  instance_type = var.instance_type

  tags = {
    Name = var.name
  }
}`,
          createdAt: '2024-01-15',
          updatedAt: '2024-01-15',
          usageCount: 5,
        },
        {
          id: '2',
          name: 'VPC with Subnets',
          description: 'Create a VPC with public and private subnets',
          category: 'Network',
          variables: [
            {
              name: 'vpc_name',
              type: 'string',
              description: 'Name for the VPC',
              required: true,
            },
            {
              name: 'cidr_block',
              type: 'string',
              description: 'CIDR block for the VPC',
              required: true,
              default: '10.0.0.0/16',
            },
          ],
          terraformCode: `resource "aws_vpc" "main" {
  cidr_block = var.cidr_block

  tags = {
    Name = var.vpc_name
  }
}`,
          createdAt: '2024-01-14',
          updatedAt: '2024-01-14',
          usageCount: 3,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    reset({
      name: '',
      description: '',
      category: '',
      terraformCode: '',
      variables: [],
    });
    setOpenDialog(true);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    reset({
      name: template.name,
      description: template.description,
      category: template.category,
      terraformCode: template.terraformCode,
      variables: template.variables,
    });
    setOpenDialog(true);
  };

  const handleSaveTemplate = async (data: any) => {
    setLoading(true);
    try {
      console.log('Saving template with data:', data);

      const templateData = {
        name: data.name,
        description: data.description,
        category: data.category || 'Custom',
        terraformCode: data.terraformCode,
        variables: data.variables || [],
      };

      console.log('Template data to send:', templateData);

      const url = editingTemplate
        ? `http://localhost:5000/api/templates/${editingTemplate.id}`
        : 'http://localhost:5000/api/templates';

      const method = editingTemplate ? 'PUT' : 'POST';

      console.log(`Making ${method} request to ${url}`);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || `Failed to save template: ${response.status}`);
      }

      const result = await response.json();

      // Show success message
      alert(`Template ${editingTemplate ? 'updated' : 'created'} successfully!`);

      // Refresh templates list
      await fetchTemplates();

      // Close dialog and reset form
      setOpenDialog(false);
      setEditingTemplate(null);
      reset({
        name: '',
        description: '',
        category: '',
        terraformCode: '',
        variables: [],
      });

    } catch (error: any) {
      console.error('Error saving template:', error);
      alert(`Failed to save template: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        console.log('Deleting template:', templateId);
        fetchTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
      }
    }
  };

  const addVariable = () => {
    append({
      name: '',
      type: 'string' as const,
      description: '',
      required: true,
      default: '',
      options: [],
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'compute':
        return 'primary';
      case 'network':
        return 'secondary';
      case 'storage':
        return 'success';
      case 'database':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Templates</Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchTemplates} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleNewTemplate}
            sx={{ ml: 1 }}
          >
            New Template
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {templates.map((template) => (
          <Grid item xs={12} md={6} lg={4} key={template.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <TemplateIcon color="primary" />
                    <Typography variant="h6">{template.name}</Typography>
                  </Box>
                  <Box>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEditTemplate(template)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDeleteTemplate(template.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Chip
                  label={template.category}
                  color={getCategoryColor(template.category) as any}
                  size="small"
                  sx={{ mb: 1 }}
                />

                <Typography variant="body2" color="textSecondary" mb={2}>
                  {template.description}
                </Typography>

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="caption" color="textSecondary">
                    {template.variables.length} variables
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Used {template.usageCount} times
                  </Typography>
                </Box>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2">Variables</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {getVariablesArray(template.variables).map((variable, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={variable.name}
                            secondary={`${variable.type || 'string'} - ${variable.description || ''}`}
                          />
                          {variable.required && (
                            <ListItemSecondaryAction>
                              <Chip label="Required" size="small" color="error" />
                            </ListItemSecondaryAction>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Template' : 'New Template'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Controller
                name="name"
                control={control}
                rules={{ required: 'Name is required' }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    margin="normal"
                    label="Template Name"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />

              <Controller
                name="description"
                control={control}
                rules={{ required: 'Description is required' }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    margin="normal"
                    label="Description"
                    multiline
                    rows={3}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />

              <Controller
                name="category"
                control={control}
                rules={{ required: 'Category is required' }}
                render={({ field, fieldState }) => (
                  <FormControl fullWidth margin="normal" error={!!fieldState.error}>
                    <InputLabel>Category</InputLabel>
                    <Select {...field} label="Category">
                      <MenuItem value="Compute">Compute</MenuItem>
                      <MenuItem value="Network">Network</MenuItem>
                      <MenuItem value="Storage">Storage</MenuItem>
                      <MenuItem value="Database">Database</MenuItem>
                      <MenuItem value="Security">Security</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />

              <Controller
                name="terraformCode"
                control={control}
                rules={{ required: 'Terraform code is required' }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    fullWidth
                    margin="normal"
                    label="Terraform Code"
                    multiline
                    rows={10}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    sx={{ fontFamily: 'monospace' }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Variables</Typography>
                <Button startIcon={<AddIcon />} onClick={addVariable}>
                  Add Variable
                </Button>
              </Box>

              {fields.map((field, index) => (
                <Card key={field.id} sx={{ mb: 2, p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle2">Variable {index + 1}</Typography>
                    <IconButton size="small" onClick={() => remove(index)}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>

                  <Controller
                    name={`variables.${index}.name`}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        margin="dense"
                        label="Variable Name"
                        size="small"
                      />
                    )}
                  />

                  <Controller
                    name={`variables.${index}.type`}
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth margin="dense" size="small">
                        <InputLabel>Type</InputLabel>
                        <Select {...field} label="Type">
                          <MenuItem value="string">String</MenuItem>
                          <MenuItem value="number">Number</MenuItem>
                          <MenuItem value="boolean">Boolean</MenuItem>
                          <MenuItem value="list">List</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />

                  <Controller
                    name={`variables.${index}.description`}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        margin="dense"
                        label="Description"
                        size="small"
                      />
                    )}
                  />

                  <Controller
                    name={`variables.${index}.default`}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        margin="dense"
                        label="Default Value"
                        size="small"
                      />
                    )}
                  />

                  <Controller
                    name={`variables.${index}.required`}
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value} />}
                        label="Required"
                      />
                    )}
                  />
                </Card>
              ))}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit(handleSaveTemplate)}
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Templates;
