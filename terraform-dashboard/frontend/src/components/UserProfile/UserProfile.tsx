import React, { useState } from 'react';
import {
  Box,
  Avatar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Chip,
  Badge,
} from '@mui/material';
import {
  Person,
  Logout,
  Settings,
  AdminPanelSettings,
  Security,
  AccountCircle,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const UserProfile: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleClose();
    await logout();
    navigate('/login');
  };

  const handleProfile = () => {
    handleClose();
    navigate('/profile');
  };

  const handleSettings = () => {
    handleClose();
    navigate('/settings');
  };

  const handleAdminPanel = () => {
    handleClose();
    navigate('/admin');
  };

  if (!user) {
    return null;
  }

  const getInitials = (firstName?: string, lastName?: string, username?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (username) {
      return username.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getRoleColor = (roleId: string) => {
    switch (roleId) {
      case 'admin':
        return 'error';
      case 'developer':
        return 'warning';
      case 'viewer':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <IconButton
        onClick={handleClick}
        size="small"
        sx={{ ml: 2 }}
        aria-controls={open ? 'user-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            <Chip
              label={user.role.name}
              size="small"
              color={getRoleColor(user.role.id) as any}
              sx={{ fontSize: '0.6rem', height: 16 }}
            />
          }
        >
          <Avatar
            src={user.avatarUrl}
            sx={{
              width: 40,
              height: 40,
              bgcolor: 'primary.main',
              fontSize: '0.9rem',
            }}
          >
            {getInitials(user.firstName, user.lastName, user.username)}
          </Avatar>
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        id="user-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        PaperProps={{
          elevation: 8,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            minWidth: 280,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* User Info Header */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Avatar
              src={user.avatarUrl}
              sx={{ width: 48, height: 48, mr: 2 }}
            >
              {getInitials(user.firstName, user.lastName, user.username)}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                {user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.username}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={user.role.name}
              size="small"
              color={getRoleColor(user.role.id) as any}
              icon={<Security />}
            />
            {user.emailVerified && (
              <Chip
                label="Verified"
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Box>
        </Box>

        <Divider />

        {/* Menu Items */}
        <MenuItem onClick={handleProfile}>
          <ListItemIcon>
            <AccountCircle fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            Profile & Account
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={handleSettings}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            Settings
          </ListItemText>
        </MenuItem>

        {/* Admin Panel - Only show if user has admin permissions */}
        {hasPermission('users:read') && (
          <MenuItem onClick={handleAdminPanel}>
            <ListItemIcon>
              <AdminPanelSettings fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              Admin Panel
            </ListItemText>
          </MenuItem>
        )}

        <Divider />

        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Logout fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>
            Sign Out
          </ListItemText>
        </MenuItem>

        {/* Footer Info */}
        <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50' }}>
          <Typography variant="caption" color="text.secondary">
            Last login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
          </Typography>
          <br />
          <Typography variant="caption" color="text.secondary">
            Login count: {user.loginCount}
          </Typography>
        </Box>
      </Menu>
    </Box>
  );
};

export default UserProfile;
