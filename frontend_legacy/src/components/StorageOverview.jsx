import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Box, Typography, Grid, Paper, Chip, Divider, Stack } from '@mui/material';

export default function StorageOverview({ token, setError }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const resp = await axios.get('http://localhost:8000/warehouse/items', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setItems(resp.data);
      } catch (err) {
        setError?.('Nepodarilo sa načítať sklad: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    fetchItems();
  }, [token, setError]);

  const totalCount = items.length;
  const totalQuantity = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const lowStock = items.filter(i => i.min_threshold != null && i.quantity <= i.min_threshold);
  const outStock = items.filter(i => (i.quantity || 0) <= 0);
  const okStock = items.length - lowStock.length - outStock.length;
  const totalValue = items.reduce((sum, i) => sum + ((i.cost_price || 0) * (i.quantity || 0)), 0);
  const categories = useMemo(() => {
    const m = new Map();
    for (const i of items) {
      const key = i.category || 'Nezaradené';
      m.set(key, (m.get(key) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a,b) => b[1]-a[1]);
  }, [items]);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Sklad - Prehľad</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Počet položiek</Typography>
            <Typography variant="h5">{totalCount}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Súčet množstiev</Typography>
            <Typography variant="h5">{totalQuantity}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Celková hodnota zásob</Typography>
            <Typography variant="h5">{totalValue.toFixed(2)} €</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Nízke zásoby</Typography>
            <Typography variant="h5">{lowStock.length}</Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {lowStock.slice(0, 6).map(i => (
                <Chip key={i.id} label={`${i.name} (${i.quantity} ${i.unit})`} color="warning" size="small" />
              ))}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Zdravie skladu</Typography>
            <Box sx={{ mt: 1, display:'flex', height: 16, borderRadius: 8, overflow:'hidden', bgcolor:'grey.200' }}>
              <Box sx={{ width: `${(okStock/Math.max(1, items.length))*100}%`, bgcolor: 'success.light' }} />
              <Box sx={{ width: `${(lowStock.length/Math.max(1, items.length))*100}%`, bgcolor: 'warning.light' }} />
              <Box sx={{ width: `${(outStock.length/Math.max(1, items.length))*100}%`, bgcolor: 'error.light' }} />
            </Box>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <Chip label={`OK: ${okStock}`} color="success" size="small" />
              <Chip label={`Nízke: ${lowStock.length}`} color="warning" size="small" />
              <Chip label={`Vypnuté: ${outStock.length}`} color="error" size="small" />
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Kategórie</Typography>
            <Box sx={{ display:'flex', flexWrap:'wrap', gap: 1 }}>
              {categories.map(([name, count]) => (
                <Chip key={name} label={`${name} (${count})`} variant="outlined" />
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
