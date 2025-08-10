import React from 'react';
import { Link } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Box,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';

const NavBar = ({ handleLogout, sidebarOpen, setSidebarOpen }) => {
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
          <IconButton color="inherit" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default NavBar;