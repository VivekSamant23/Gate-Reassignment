import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem
} from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import { api } from '../api'

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`config-tabpanel-${index}`}
      aria-labelledby={`config-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

export default function ConfigPage() {
  const [tabValue, setTabValue] = useState(0)
  const [ramps, setRamps] = useState([])
  const [hangars, setHangars] = useState([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showGateDialog, setShowGateDialog] = useState(false)
  const [editingGate, setEditingGate] = useState(null)
  const [newGate, setNewGate] = useState({
    gate_number: '',
    gate_type: 'ramp',
    max_aircraft: 1,
    aircraft_types: 'narrow_body',
    terminal: 'A',
    coordinates_x: 0,
    coordinates_y: 0
  })

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const res = await api.get('/config')
      const config = res.data
      
      // Parse gates, ramps, and hangars from configuration
      const allResources = config.gates || []
      setRamps(allResources.filter(g => g.gate_type !== 'hangar'))
      setHangars(allResources.filter(g => g.gate_type === 'hangar'))
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const allResources = [...ramps, ...hangars]
      await api.post('/config', { gates: allResources })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddGate = () => {
    setEditingGate(null)
    const defaultType = tabValue === 0 ? 'ramp' : 'hangar'
    setNewGate({
      gate_number: '',
      gate_type: defaultType,
      max_aircraft: 1,
      aircraft_types: 'narrow_body',
      terminal: 'A',
      coordinates_x: 0,
      coordinates_y: 0
    })
    setShowGateDialog(true)
  }

  const handleEditGate = (gate) => {
    setEditingGate(gate)
    setNewGate({ ...gate })
    setShowGateDialog(true)
  }

  const handleSaveGate = () => {
    if (tabValue === 0) {
      // Ramps tab
      if (editingGate) {
        setRamps(ramps.map(g => g.id === editingGate.id ? { ...newGate, id: editingGate.id } : newGate))
      } else {
        setRamps([...ramps, { ...newGate, id: Date.now() }])
      }
    } else {
      // Hangars tab
      if (editingGate) {
        setHangars(hangars.map(g => g.id === editingGate.id ? { ...newGate, id: editingGate.id } : newGate))
      } else {
        setHangars([...hangars, { ...newGate, id: Date.now() }])
      }
    }
    setShowGateDialog(false)
  }

  const handleDeleteGate = (gateId) => {
    if (tabValue === 0) {
      setRamps(ramps.filter(g => g.id !== gateId))
    } else {
      setHangars(hangars.filter(g => g.id !== gateId))
    }
  }

  const getCurrentResources = () => {
    switch (tabValue) {
      case 0: return ramps
      case 1: return hangars
      default: return ramps
    }
  }

  const getResourceType = () => {
    switch (tabValue) {
      case 0: return 'Ramp'
      case 1: return 'Hangar'
      default: return 'Ramp'
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Airport Configuration
      </Typography>

      <Card>
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab label="Ramps" />
              <Tab label="Hangars" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <ResourceTable
              resources={ramps}
              resourceType="Ramp"
              onEdit={handleEditGate}
              onDelete={handleDeleteGate}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <ResourceTable
              resources={hangars}
              resourceType="Hangar"
              onEdit={handleEditGate}
              onDelete={handleDeleteGate}
            />
          </TabPanel>

          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={handleAddGate}
            >
              Add {getResourceType()}
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </Stack>

          {saved && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Configuration saved successfully!
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Resource Dialog */}
      <Dialog open={showGateDialog} onClose={() => setShowGateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingGate ? `Edit ${getResourceType()}` : `Add New ${getResourceType()}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Number/Identifier"
              value={newGate.gate_number}
              onChange={(e) => setNewGate({...newGate, gate_number: e.target.value})}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Type"
                value={newGate.gate_type}
                onChange={(e) => setNewGate({...newGate, gate_type: e.target.value})}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="ramp">Ramp</MenuItem>
                <MenuItem value="hangar">Hangar</MenuItem>
              </TextField>
              <TextField
                label="Terminal"
                value={newGate.terminal}
                onChange={(e) => setNewGate({...newGate, terminal: e.target.value})}
                sx={{ minWidth: 100 }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Max Aircraft"
                type="number"
                value={newGate.max_aircraft}
                onChange={(e) => setNewGate({...newGate, max_aircraft: parseInt(e.target.value) || 1})}
                sx={{ minWidth: 150 }}
              />
              <TextField
                select
                label="Aircraft Types"
                value={newGate.aircraft_types}
                onChange={(e) => setNewGate({...newGate, aircraft_types: e.target.value})}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="narrow_body">Narrow Body Only</MenuItem>
                <MenuItem value="wide_body">Wide Body Only</MenuItem>
                <MenuItem value="wide_body,narrow_body">Both Types</MenuItem>
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="X Coordinate"
                type="number"
                value={newGate.coordinates_x}
                onChange={(e) => setNewGate({...newGate, coordinates_x: parseInt(e.target.value) || 0})}
              />
              <TextField
                label="Y Coordinate"
                type="number"
                value={newGate.coordinates_y}
                onChange={(e) => setNewGate({...newGate, coordinates_y: parseInt(e.target.value) || 0})}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGateDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveGate} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function ResourceTable({ resources, resourceType, onEdit, onDelete }) {
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>{resourceType} Number</TableCell>
            <TableCell>Terminal</TableCell>
            <TableCell>Max Aircraft</TableCell>
            <TableCell>Aircraft Types</TableCell>
            <TableCell>Coordinates</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {resources.map((resource) => (
            <TableRow key={resource.id}>
              <TableCell>{resource.gate_number}</TableCell>
              <TableCell>{resource.terminal}</TableCell>
              <TableCell>{resource.max_aircraft}</TableCell>
              <TableCell>
                {resource.aircraft_types === 'wide_body,narrow_body' ? 'Both' :
                 resource.aircraft_types === 'wide_body' ? 'Wide Body' : 'Narrow Body'}
              </TableCell>
              <TableCell>({resource.coordinates_x}, {resource.coordinates_y})</TableCell>
              <TableCell>
                <Stack direction="row" spacing={1}>
                  <IconButton size="small" onClick={() => onEdit(resource)}>
                    <Edit />
                  </IconButton>
                  <IconButton size="small" onClick={() => onDelete(resource.id)}>
                    <Delete />
                  </IconButton>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
