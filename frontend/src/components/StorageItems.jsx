import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, IconButton, Snackbar, Alert, Chip, Tooltip, TableSortLabel, TablePagination, InputAdornment } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const units = ['pcs', 'g', 'ml', 'kg', 'l'];

export default function StorageItems({ token, setError }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', sku: '', quantity: 0, unit: 'pcs', min_threshold: '', category: '', location: '', cost_price: '', notes: '' });
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const fileInputRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchItems = async () => {
    try {
      const resp = await axios.get('http://localhost:8000/warehouse/items', { headers });
      setItems(resp.data);
    } catch (err) {
      setError?.('Nepodarilo sa načítať sklad: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', sku: '', quantity: 0, unit: 'pcs', min_threshold: '', category: '', location: '', cost_price: '', notes: '' }); setOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...item, min_threshold: item.min_threshold ?? '', cost_price: item.cost_price ?? '' }); setOpen(true); };
  const closeDialog = () => setOpen(false);

  const saveItem = async () => {
    try {
      const payload = { ...form, quantity: Number(form.quantity || 0), min_threshold: form.min_threshold === '' ? null : Number(form.min_threshold), cost_price: form.cost_price === '' ? null : Number(form.cost_price) };
      if (editing) {
        await axios.put(`http://localhost:8000/warehouse/items/${editing.id}`, payload, { headers });
        setToast({ open: true, message: 'Položka upravená', severity: 'success' });
      } else {
        await axios.post('http://localhost:8000/warehouse/items', payload, { headers });
        setToast({ open: true, message: 'Položka pridaná', severity: 'success' });
      }
      closeDialog();
      fetchItems();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Chyba pri ukladaní položky';
      setToast({ open: true, message: msg, severity: 'error' });
    }
  };

  const deleteItem = async (id) => {
    try {
      await axios.delete(`http://localhost:8000/warehouse/items/${id}`, { headers });
      setToast({ open: true, message: 'Položka vymazaná', severity: 'success' });
      fetchItems();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Chyba pri mazaní položky';
      setToast({ open: true, message: msg, severity: 'error' });
    }
  };

  const statusOf = (i) => {
    if ((i.quantity || 0) <= 0) return 'OUT';
    if (i.min_threshold != null && i.quantity <= i.min_threshold) return 'LOW';
    return 'OK';
  };

  const copySku = async (sku) => {
    if (!sku) return;
    try {
      await navigator.clipboard.writeText(sku);
      setToast({ open: true, message: 'SKU skopírované', severity: 'success' });
    } catch {
      setToast({ open: true, message: 'Nepodarilo sa skopírovať SKU', severity: 'warning' });
    }
  };

  const adjustQuantity = async (item, delta) => {
    try {
      const qty = Math.max(0, (item.quantity || 0) + delta);
      const payload = { ...item, quantity: qty };
      delete payload.id; // not needed in body
      await axios.put(`http://localhost:8000/warehouse/items/${item.id}`, payload, { headers });
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, quantity: qty } : p)));
    } catch (err) {
      const msg = err.response?.data?.detail || 'Chyba pri úprave množstva';
      setToast({ open: true, message: msg, severity: 'error' });
    }
  };

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort(), [items]);

  const filtered = useMemo(() => {
    const term = (search || '').toLowerCase();
    let data = items.filter(i =>
      (!term || (i.name && i.name.toLowerCase().includes(term)) || (i.sku && i.sku.toLowerCase().includes(term)) || (i.category && i.category.toLowerCase().includes(term))) &&
      (!categoryFilter || i.category === categoryFilter) &&
      (!statusFilter || statusOf(i) === statusFilter)
    );
    data.sort((a, b) => {
      const va = a[orderBy];
      const vb = b[orderBy];
      let cmp = 0;
      if (va == null && vb == null) cmp = 0; else if (va == null) cmp = -1; else if (vb == null) cmp = 1; else if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb; else cmp = String(va).localeCompare(String(vb));
      return order === 'asc' ? cmp : -cmp;
    });
    return data;
  }, [items, search, categoryFilter, statusFilter, orderBy, order]);

  const paged = useMemo(() => filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [filtered, page, rowsPerPage]);

  const handleSort = (col) => {
    if (orderBy === col) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setOrderBy(col); setOrder('asc'); }
  };

  const exportCSV = () => {
    const cols = ['name','sku','quantity','unit','min_threshold','category','location','cost_price','notes'];
    const rows = filtered.map(i => cols.map(c => (i[c] ?? '')).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'warehouse_items.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      const header = lines.shift();
      const cols = header.split(',').map(s => s.trim());
      const required = ['name','quantity','unit'];
      for (const r of required) if (!cols.includes(r)) throw new Error(`Chýba stĺpec: ${r}`);
      const idx = Object.fromEntries(cols.map((c, i) => [c, i]));
      let imported = 0;
      for (const line of lines) {
        const parts = line.split(',');
        const obj = {
          name: parts[idx['name']]?.trim(),
          sku: parts[idx['sku']]?.trim() || '',
          quantity: Number(parts[idx['quantity']] ?? 0),
          unit: parts[idx['unit']]?.trim() || 'pcs',
          min_threshold: parts[idx['min_threshold']]?.trim() === '' ? null : Number(parts[idx['min_threshold']] ?? ''),
          category: parts[idx['category']]?.trim() || '',
          location: parts[idx['location']]?.trim() || '',
          cost_price: parts[idx['cost_price']]?.trim() === '' ? null : Number(parts[idx['cost_price']] ?? ''),
          notes: parts[idx['notes']]?.trim() || '',
        };
        if (!obj.name) continue;
        try {
          await axios.post('http://localhost:8000/warehouse/items', obj, { headers });
          imported++;
        } catch {
          // continue on error for next rows
        }
      }
      setToast({ open: true, message: `Import dokončený: ${imported} položiek`, severity: 'success' });
      fetchItems();
    } catch (err) {
      setToast({ open: true, message: `Chyba importu: ${err.message || err}`, severity: 'error' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Sklad - Položky</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField size="small" label="Hľadať" value={search} onChange={(e) => setSearch(e.target.value)} />
          <TextField size="small" select label="Kategória" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">Všetky</MenuItem>
            {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Stav" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="">Všetky</MenuItem>
            <MenuItem value="OK">OK</MenuItem>
            <MenuItem value="LOW">Nízke</MenuItem>
            <MenuItem value="OUT">Vypnuté</MenuItem>
          </TextField>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={exportCSV}>Export</Button>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={importCSV} />
          <Button variant="outlined" startIcon={<FileUploadIcon />} onClick={() => fileInputRef.current?.click()}>Import</Button>
          <Button variant="contained" onClick={openCreate}>Pridať</Button>
        </Box>
      </Box>

      <Paper sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sortDirection={orderBy==='name'?order:false}>
                <TableSortLabel active={orderBy==='name'} direction={orderBy==='name'?order:'asc'} onClick={() => handleSort('name')}>Názov</TableSortLabel>
              </TableCell>
              <TableCell>SKU</TableCell>
              <TableCell align="right" sortDirection={orderBy==='quantity'?order:false}>
                <TableSortLabel active={orderBy==='quantity'} direction={orderBy==='quantity'?order:'asc'} onClick={() => handleSort('quantity')}>Množstvo</TableSortLabel>
              </TableCell>
              <TableCell>Jednotka</TableCell>
              <TableCell>Min.</TableCell>
              <TableCell>Kategória</TableCell>
              <TableCell>Pozícia</TableCell>
              <TableCell align="right">Stav</TableCell>
              <TableCell align="right">Hodnota</TableCell>
              <TableCell align="right"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map(i => {
              const st = statusOf(i);
              const value = (i.cost_price ?? 0) * (i.quantity ?? 0);
              return (
                <TableRow key={i.id} hover>
                  <TableCell>{i.name}</TableCell>
                  <TableCell>
                    <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                      {i.sku || '-'}
                      {i.sku && (
                        <Tooltip title="Skopírovať">
                          <IconButton size="small" onClick={() => copySku(i.sku)}><ContentCopyIcon fontSize="inherit" /></IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:0.5 }}>
                      <IconButton size="small" onClick={() => adjustQuantity(i, -1)}><RemoveIcon fontSize="small" /></IconButton>
                      {i.quantity}
                      <IconButton size="small" onClick={() => adjustQuantity(i, +1)}><AddIcon fontSize="small" /></IconButton>
                    </Box>
                  </TableCell>
                  <TableCell>{i.unit}</TableCell>
                  <TableCell>{i.min_threshold ?? '-'}</TableCell>
                  <TableCell>{i.category || '-'}</TableCell>
                  <TableCell>{i.location || '-'}</TableCell>
                  <TableCell align="right">
                    {st === 'OK' && <Chip size="small" label="OK" color="success" />}
                    {st === 'LOW' && <Chip size="small" label="Nízke" color="warning" />}
                    {st === 'OUT' && <Chip size="small" label="Vypredané" color="error" />}
                  </TableCell>
                  <TableCell align="right">{value ? value.toFixed(2) + ' €' : '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => openEdit(i)}><EditIcon /></IconButton>
                    <IconButton onClick={() => deleteItem(i.id)} color="error"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5,10,25,50]}
        />
      </Paper>

      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Upraviť položku' : 'Pridať položku'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="dense" label="Názov" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <TextField fullWidth margin="dense" label="SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} InputProps={{ endAdornment: form.sku ? <InputAdornment position="end"><IconButton size="small" onClick={() => copySku(form.sku)}><ContentCopyIcon fontSize="inherit" /></IconButton></InputAdornment> : null }} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField type="number" margin="dense" label="Množstvo" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} fullWidth />
            <TextField select margin="dense" label="Jednotka" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} fullWidth>
              {units.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField type="number" margin="dense" label="Min. zásoba" value={form.min_threshold} onChange={e => setForm({ ...form, min_threshold: e.target.value })} fullWidth />
            <TextField margin="dense" label="Kategória" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} fullWidth />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField margin="dense" label="Pozícia" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} fullWidth />
            <TextField type="number" margin="dense" label="Nákupná cena" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} fullWidth />
          </Box>
          <TextField fullWidth margin="dense" label="Poznámky" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Zrušiť</Button>
          <Button variant="contained" onClick={saveItem}>Uložiť</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast(t => ({ ...t, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={() => setToast(t => ({ ...t, open: false }))} severity={toast.severity} sx={{ width: '100%' }}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
