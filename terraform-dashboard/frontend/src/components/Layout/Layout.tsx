import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  CloudQueue as DeployIcon,
  ViewModule as TemplateIcon,
  Computer as InstanceIcon,
  Settings as SettingsIcon,
  AccountTree as TerraformIcon,
  AttachMoney as CostIcon,
  Security as SecurityIcon,
  Hub as ClusterIcon,
  GitHub as GitHubIcon,
  Token as TokenIcon,
  Router as VpcIcon,
  Build as AnsibleIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserProfile from '../UserProfile';

const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
}

const allMenuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', permissions: [] },
  { text: 'Deployments', icon: <DeployIcon />, path: '/deployments', permissions: ['deployments:read'] },
  { text: 'Templates', icon: <TemplateIcon />, path: '/templates', permissions: ['templates:read'] },
  { text: 'Ansible Scripts', icon: <AnsibleIcon />, path: '/ansible-scripts', permissions: ['templates:read'] },
  { text: 'GitHub Import', icon: <GitHubIcon />, path: '/github-import', permissions: ['github:read', 'templates:write'] },
  { text: 'GitHub Tokens', icon: <TokenIcon />, path: '/github-tokens', permissions: ['github:read'] },
  { text: 'Instances', icon: <InstanceIcon />, path: '/instances', permissions: ['instances:read'] },
  { text: 'VPC Resources', icon: <VpcIcon />, path: '/vpc-resources', permissions: ['instances:read'] },
  { text: 'EKS Clusters', icon: <ClusterIcon />, path: '/clusters', permissions: ['instances:read'] },
  { text: 'Cost Analysis', icon: <CostIcon />, path: '/cost-analysis', permissions: ['aws:read'] },
  { text: 'Security Center', icon: <SecurityIcon />, path: '/security-center', permissions: ['aws:read'] },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings', permissions: ['settings:read'] },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { hasAnyPermission } = useAuth();

  // Filter menu items based on user permissions
  const menuItems = allMenuItems.filter(item => {
    if (item.permissions.length === 0) return true; // No permissions required
    return hasAnyPermission(item.permissions);
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Box display="flex" alignItems="center" gap={1}>
          <TerraformIcon color="primary" />
          <Typography variant="h6" noWrap component="div" color="primary">
            Terraform Dashboard
          </Typography>
        </Box>
      </Toolbar>
      <List sx={{ flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main + '20',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.main + '30',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? theme.palette.primary.main : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{
                  color: location.pathname === item.path ? theme.palette.primary.main : 'inherit',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {/* Tietoevry Branding */}
      <Box
        sx={{
          p: 2,
          borderTop: `2px solid ${theme.palette.primary.main}`,
          background: `linear-gradient(135deg, ${theme.palette.primary.main}15, ${theme.palette.primary.main}05)`,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          }
        }}
      >
        <Typography
          variant="body1"
          sx={{
            fontWeight: 700,
            textAlign: 'center',
            fontSize: '1rem',
            letterSpacing: '1px',
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textTransform: 'uppercase',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)',
            '&:hover': {
              transform: 'scale(1.05)',
              transition: 'transform 0.2s ease-in-out',
            }
          }}
        >
          ⚡ Powered by Tietoevry
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            textAlign: 'center',
            fontSize: '0.75rem',
            fontWeight: 500,
            mt: 0.5,
            opacity: 0.8
          }}
        >
          Technology Services
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'Dashboard'}
          </Typography>
          <UserProfile />
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="navigation menu"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
