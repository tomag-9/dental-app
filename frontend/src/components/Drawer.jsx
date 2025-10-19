import React, { useState, useRef } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Popper,
  Paper,
  ListItemButton,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SettingsIcon from '@mui/icons-material/Settings';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import InventoryIcon from '@mui/icons-material/Inventory';
import WorkIcon from '@mui/icons-material/Work';
import EngineeringIcon from '@mui/icons-material/Engineering';

const drawerCollapsedWidth = 60;
const drawerExpandedWidth = 200;
const topOffset = 55;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Kalendár', icon: <EventIcon />, path: '/calendar' },
  { text: 'Pacienti', icon: <PeopleIcon />, path: '/patients' },
  {
    text: 'Financie',
    icon: <AttachMoneyIcon />,
    path: '/finance/overview',
    subItems: [
      { text: 'Cenník', path: '/finance/price-list' },
      { text: 'Faktúry', path: '/finance/invoices' },
      { text: 'Analytika', path: '/finance/analytics' },
    ],
  },
  {
    text: 'Sklad',
    icon: <InventoryIcon />,
    path: '/storage',
    subItems: [
      { text: 'Prehľad', path: '/storage/overview' },
      { text: 'Položky', path: '/storage/items' },
    ],
  },
  {
    text: 'Lekári',
    icon: <LocalHospitalIcon />,
    path: '/doctors',
    subItems: [
      { text: 'Zoznam', path: '/medics/list' },
      { text: 'Rozvrh', path: '/medics/schedule' },
    ],
  },
  { text: 'Kliniky', icon: <LocalHospitalIcon />, path: '/clinics' },
  { text: 'Práce', icon: <WorkIcon />, path: '/jobs' },
  { text: 'Technici', icon: <EngineeringIcon />, path: '/technicians' },
  {
    text: 'Nastavenia',
    icon: <SettingsIcon />,
    path: '/settings',
    subItems: [
      { text: 'Používatelia', path: '/settings/users' },
      { text: 'Môj profil', path: '/settings/edit-profile' },
      { text: 'Spoločnosť', path: '/settings/company' },
      { text: 'Oprávnenia', path: '/settings/permissions' },
    ],
  },
];

export default function Sidebar() {
  const [hoveringDrawer, setHoveringDrawer] = useState(false);
  const [hoveringPopper, setHoveringPopper] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  const navigate = useNavigate();
  const expanded = hoveringDrawer || hoveringPopper;

  const handleItemHover = (event, item) => {
    if (expanded && item.subItems) {
      setHoveredItem(item);
      setAnchorEl(event.currentTarget);
    } else {
      setHoveredItem(null);
      setAnchorEl(null);
    }
  };

  return (
    <>
      <Drawer
        variant="permanent"
        onMouseEnter={() => setHoveringDrawer(true)}
        onMouseLeave={() => setHoveringDrawer(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: expanded ? drawerExpandedWidth : drawerCollapsedWidth,
            overflowX: 'hidden',
            bgcolor: 'primary.main',
            color: 'white',
            position: 'fixed',
            top: `${topOffset}px`,
            height: `calc(100% - ${topOffset}px)`,
            transition: 'width 0.3s ease',
            zIndex: 1200,
          },
        }}
      >
        <List>
          {menuItems.map((item) => (
            <ListItem
              key={item.text}
              disablePadding
              onMouseEnter={(e) => handleItemHover(e, item)}
              onMouseLeave={() => {
                if (!hoveringPopper) {
                  setHoveredItem(null);
                  setAnchorEl(null);
                }
              }}
            >
              <ListItemButton onClick={() => navigate(item.path)}>
                <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                {expanded && <ListItemText primary={item.text} />}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Popper
        open={expanded && Boolean(hoveredItem?.subItems)}
        anchorEl={anchorEl}
        placement="right-start"
        modifiers={[
          {
            name: 'offset',
            options: { offset: [0, 0] }, // presne vedľa
          },
        ]}
        style={{ zIndex: 1300 }}
      >
        {hoveredItem?.subItems && (
          <Paper
            sx={{
              bgcolor: 'primary.dark',
              color: 'white',
              minWidth: 160,
            }}
            onMouseEnter={() => setHoveringPopper(true)}
            onMouseLeave={() => setHoveringPopper(false)}
          >
            <List dense>
              {hoveredItem.subItems.map((sub) => (
                <ListItemButton
                  key={sub.text}
                  onClick={() => navigate(sub.path)}
                  sx={{ color: 'white', '&:hover': { bgcolor: 'primary.light' } }}
                >
                  <ListItemText primary={sub.text} />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
      </Popper>
    </>
  );
}
