import React from 'react';
import { Link } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  Toolbar,
  IconButton,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import EngineeringIcon from '@mui/icons-material/Engineering';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import WorkIcon from '@mui/icons-material/Work';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft';

const DrawerComponent = ({ sidebarOpen, setSidebarOpen, isDrawerExpanded, setIsDrawerExpanded }) => {
  const toggleDrawerExpand = () => {
    setIsDrawerExpanded(!isDrawerExpanded);
  };

  const menuItems = [
    { text: 'Pacienti', icon: <PeopleIcon />, path: '/patients' },
    { text: 'Lekári', icon: <MedicalServicesIcon />, path: '/doctors' },
    { text: 'Technici', icon: <EngineeringIcon />, path: '/technicians' },
    { text: 'Kliniky', icon: <LocalHospitalIcon />, path: '/clinics' },
    { text: 'Práce', icon: <WorkIcon />, path: '/jobs' },
    { text: 'Cenník', icon: <AttachMoneyIcon />, path: '/price-list' },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: isDrawerExpanded ? 240 : 60,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: isDrawerExpanded ? 240 : 60,
          boxSizing: 'border-box',
          bgcolor: 'primary.main',
          color: 'white',
          display: { xs: sidebarOpen ? 'block' : 'none', sm: 'block' },
          transition: 'width 0.3s ease',
          overflow: 'hidden',
        },
      }}
    >
      <Toolbar sx={{ minHeight: 48 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <List>
          {menuItems.map(({ text, icon, path }) => (
            <ListItem
              key={text}
              component={Link}
              to={path}
              onClick={() => setSidebarOpen(false)}
              sx={{ '&:hover': { bgcolor: 'primary.dark' } }}
            >
              <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>{icon}</ListItemIcon>
              {isDrawerExpanded && <ListItemText primary={text} sx={{ color: 'white' }} />}
            </ListItem>
          ))}
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            bgcolor: 'primary.main',
            p: 1,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <IconButton
            onClick={toggleDrawerExpand}
            sx={{ color: 'white', p: 0.5 }}
          >
            {isDrawerExpanded ? <ArrowLeftIcon /> : <ArrowRightIcon />}
          </IconButton>
        </Box>
      </Box>
    </Drawer>
  );
};

export default DrawerComponent;