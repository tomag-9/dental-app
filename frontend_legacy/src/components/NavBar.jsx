import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle'; // Profile icon
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';

const NavBar = ({ handleLogout, sidebarOpen, setSidebarOpen }) => {
  const [userNickname, setUserNickname] = useState('');

  useEffect(() => {
    // Get user from localStorage
    const updateUserNickname = () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const displayName = user.nickname || user.email || 'User';
      setUserNickname(displayName);
      console.log('NavBar: Updated user display name:', displayName, 'from user:', user);
    };
    
    updateUserNickname();
    
    // Listen for storage changes
    window.addEventListener('storage', updateUserNickname);
    
    return () => {
      window.removeEventListener('storage', updateUserNickname);
    };
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: 'primary.main',
        minHeight: 30,
      }}
    >
      <Toolbar sx={{ minHeight: 48, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={toggleSidebar}
              sx={{ mr: 1, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <IconButton component={Link} to="/" color="inherit">
              <HealthAndSafetyIcon />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {userNickname && (
              <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {userNickname}
              </Typography>
            )}
            <IconButton component={Link} to="/settings/edit-profile" color="inherit">
              <AccountCircleIcon />
            </IconButton>
            <IconButton color="inherit" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default NavBar;