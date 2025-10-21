import React, { useState, useEffect } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Popper,
  Paper,
  ListItemButton,
  Divider,
  Badge,
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
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BusinessIcon from '@mui/icons-material/Business';
import GroupIcon from '@mui/icons-material/Group';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';

const drawerCollapsedWidth = 60;
const drawerExpandedWidth = 200;
const topOffset = 55;

export default function Sidebar() {
  const [hoveringDrawer, setHoveringDrawer] = useState(false);
  const [hoveringPopper, setHoveringPopper] = useState(false);
  const collapseTimeoutRef = React.useRef(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [userRole, setUserRole] = useState('user');
  const [anchorEl, setAnchorEl] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);

  const navigate = useNavigate();
  const expanded = hoveringDrawer || hoveringPopper;

  useEffect(() => {
    // Get user role from localStorage
    const updateUserRole = () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setUserRole(user.role || 'user');
    };
    
    updateUserRole();
    
    // Listen for storage changes (e.g., when user logs in)
    window.addEventListener('storage', updateUserRole);
    
    // Also check periodically in case storage event doesn't fire
    const interval = setInterval(updateUserRole, 1000);
    
    return () => {
      window.removeEventListener('storage', updateUserRole);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // Poll low-stock count for warehouse and update badge
    let cancel = false;
    const fetchLowStock = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const resp = await fetch('http://localhost:8000/warehouse/items', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const items = await resp.json();
        if (cancel) return;
        const count = items.filter((i) => i.min_threshold != null && i.quantity <= i.min_threshold).length;
        setLowStockCount(count);
      } catch {
        /* ignore errors */
      }
    };
    fetchLowStock();
    const interval = setInterval(fetchLowStock, 60000); // refresh every 60s
    return () => {
      cancel = true;
      clearInterval(interval);
    };
  }, []);

  // Regular menu items for all users
  const regularMenuItems = [
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
        { text: 'Laboratórium', path: '/settings/lab' },
        { text: 'Oprávnenia', path: '/settings/permissions' },
      ],
    },
  ];

  // Superadmin-only menu items
  const superadminMenuItems = [
    { text: 'Superadmin', icon: <AdminPanelSettingsIcon />, path: '/superadmin/dashboard' },
    { text: 'Laboratóriá', icon: <BusinessIcon />, path: '/superadmin/labs' },
    { text: 'Všetci používatelia', icon: <GroupIcon />, path: '/superadmin/users' },
    { text: 'Predplatné', icon: <SubscriptionsIcon />, path: '/superadmin/subscriptions' },
  ];

  // Combine menu items based on role
  const menuItems = userRole === 'superadmin' 
    ? [...superadminMenuItems, ...regularMenuItems] 
    : regularMenuItems;

  const handleItemHover = (event, item) => {
    if (item.subItems) {
      setHoveredItem(item);
      setAnchorEl(event.currentTarget);
    } else {
      setHoveredItem(null);
      setAnchorEl(null);
    }
  };

  const handleDrawerLeave = () => {
    setHoveringDrawer(false);
    // Start a short timeout to collapse if not hovering popper
    if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    collapseTimeoutRef.current = setTimeout(() => {
      if (!hoveringDrawer && !hoveringPopper) {
        setHoveredItem(null);
        setAnchorEl(null);
      }
    }, 100);
  };

  const handlePopperLeave = () => {
    setHoveringPopper(false);
    // Start a short timeout to collapse if not hovering drawer
    if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    collapseTimeoutRef.current = setTimeout(() => {
      if (!hoveringDrawer && !hoveringPopper) {
        setHoveredItem(null);
        setAnchorEl(null);
      }
    }, 100);
  };

  return (
    <>
      <Drawer
        variant="permanent"
        onMouseEnter={() => {
          setHoveringDrawer(true);
          if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
        }}
        onMouseLeave={handleDrawerLeave}
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
            >
              <ListItemButton onClick={() => navigate(item.path)}>
                <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                  {item.text === 'Sklad' ? (
                    <Badge color="warning" badgeContent={lowStockCount} invisible={lowStockCount === 0} overlap="circular">
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                {expanded && <ListItemText primary={item.text} />}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {expanded && hoveredItem?.subItems && (
        <Popper
          open={true}
          anchorEl={anchorEl}
          placement="right-start"
          modifiers={[{ name: 'offset', options: { offset: [0, 0] } }]}
          style={{ zIndex: 1300 }}
        >
          <Paper
            sx={{
              bgcolor: 'primary.dark',
              color: 'white',
              minWidth: 160,
            }}
            onMouseEnter={() => setHoveringPopper(true)}
            onMouseLeave={handlePopperLeave}
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
        </Popper>
      )}
    </>
  );
}
