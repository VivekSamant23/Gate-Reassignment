import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip
} from '@mui/material'
import { Add, Edit, Delete, FlightLand, FlightTakeoff, SwapHoriz } from '@mui/icons-material'
import { api } from '../api'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toDisplayDateFromIso(iso) {
  if (!iso || typeof iso !== 'string') return ''
  const m = iso.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})/)
  if (!m) return iso
  return `${m[3]}-${m[2]}-${m[1]}`
}

function toDisplayTimeFromIso(iso) {
  if (!iso || typeof iso !== 'string') return ''
  const m = iso.match(/^([0-9]{2}):([0-9]{2})/)
  if (!m) return iso
  return `${m[1]}:${m[2]}`
}

function parseDateInputToIso(value) {
  const v = (value || '').trim()
  if (!v) return { display: '', iso: '' }

  if (v.toLowerCase() === 'n') {
    const d = new Date()
    const dd = pad2(d.getDate())
    const mm = pad2(d.getMonth() + 1)
    const yyyy = String(d.getFullYear())
    return { display: `${dd}-${mm}-${yyyy}`, iso: `${yyyy}-${mm}-${dd}` }
  }

  // Accept DDMMYYYY
  const digits = v.replace(/[^0-9]/g, '')
  if (digits.length === 8) {
    const dd = digits.slice(0, 2)
    const mm = digits.slice(2, 4)
    const yyyy = digits.slice(4, 8)
    return { display: `${dd}-${mm}-${yyyy}`, iso: `${yyyy}-${mm}-${dd}` }
  }

  // Accept DD-MM-YYYY
  const m = v.match(/^([0-9]{2})-?([0-9]{2})-?([0-9]{4})$/)
  if (m) {
    const dd = m[1]
    const mm = m[2]
    const yyyy = m[3]
    return { display: `${dd}-${mm}-${yyyy}`, iso: `${yyyy}-${mm}-${dd}` }
  }

  // Accept ISO
  const iso = v.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/)
  if (iso) {
    const yyyy = iso[1]
    const mm = iso[2]
    const dd = iso[3]
    return { display: `${dd}-${mm}-${yyyy}`, iso: `${yyyy}-${mm}-${dd}` }
  }

  return { display: v, iso: '' }
}

function parseTimeInputToHHMM(value) {
  const v = (value || '').trim()
  if (!v) return { display: '', hhmm: '' }

  // Accept HHMM
  const digits = v.replace(/[^0-9]/g, '')
  if (digits.length === 4) {
    const hh = digits.slice(0, 2)
    const mm = digits.slice(2, 4)
    return { display: `${hh}:${mm}`, hhmm: `${hh}:${mm}` }
  }

  // Accept HH:MM or HH:MM:SS
  const m = v.match(/^([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?$/)
  if (m) {
    const hh = m[1]
    const mm = m[2]
    return { display: `${hh}:${mm}`, hhmm: `${hh}:${mm}` }
  }

  return { display: v, hhmm: '' }
}

export default function FlightsPage() {
  const [flights, setFlights] = useState([])
  const [selectedFlights, setSelectedFlights] = useState([])
  const [recommendations, setRecommendations] = useState({})
  const [loading, setLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createAttempted, setCreateAttempted] = useState(false)
  const [createError, setCreateError] = useState('')
  const [gateOptions, setGateOptions] = useState([])
  const [showEditRecDialog, setShowEditRecDialog] = useState(false)
  const [editingRecFlightId, setEditingRecFlightId] = useState(null)
  const [editingRecGate, setEditingRecGate] = useState('')
  const [editingRecApplied, setEditingRecApplied] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [detailsFlight, setDetailsFlight] = useState(null)
  const [detailsEdited, setDetailsEdited] = useState({})
  const [globalFilters, setGlobalFilters] = useState({
    flight_number: '',
    scheduled_date: '',
    status: 'all'
  })
  const [columnFilters, setColumnFilters] = useState({
    flight_number: '',
    scheduled_date: '',
    scheduled_time: '',
    aircraft_registration: '',
    aircraft_type: '',
    assigned_gate: '',
    planned_gate: '',
    flight_type: '',
    status: '',
    recommendation: ''
  })
  const [newFlight, setNewFlight] = useState({
    flight_number: '',
    scheduled_date: '',
    scheduled_time: '',
    aircraft_registration: '',
    aircraft_type: 'narrow_body',
    new_position: '',
    old_position: '',
    assigned_gate: '',
    planned_gate: '',
    flight_type: 'arrival',
    status: 'scheduled'
  })

  const missingFields = (() => {
    const missing = []
    if (!newFlight.flight_number?.trim()) missing.push('Flight Number')
    if (!newFlight.scheduled_date) missing.push('Date')
    if (!newFlight.scheduled_time) missing.push('Time')
    if (!newFlight.aircraft_type) missing.push('Aircraft Type')
    if (!newFlight.flight_type) missing.push('Flight Type')
    return missing
  })()

  useEffect(() => {
    loadGateOptions()
    loadFlights()
  }, [])

  const loadGateOptions = async () => {
    try {
      const res = await api.get('/config')
      const all = res.data?.gates || []
      const opts = all.map((g) => g.gate_number).filter(Boolean).sort()
      setGateOptions(opts)
    } catch (error) {
      console.error('Failed to load gate options:', error)
      setGateOptions([])
    }
  }

  const loadFlights = async () => {
    try {
      const res = await api.get('/flights')
      setFlights(res.data)
      const ids = (res.data || []).map((f) => f.id).filter(Boolean)
      if (ids.length > 0) {
        const recRes = await api.post('/recommendations', { flight_ids: ids })
        setRecommendations(recRes.data.recommendations || {})
      } else {
        setRecommendations({})
      }
    } catch (error) {
      console.error('Failed to load flights:', error)
    }
  }

  const handleSelect = (flightId) => {
    setSelectedFlights(prev => 
      prev.includes(flightId) 
        ? prev.filter(id => id !== flightId)
        : [...prev, flightId]
    )
  }

  const handleSelectAll = () => {
    if (selectedFlights.length === flights.length) {
      setSelectedFlights([])
    } else {
      setSelectedFlights(flights.map(f => f.id))
    }
  }

  const handleAssign = async () => {
    const setIds = new Set(selectedFlights)
    const assignments = Object.entries(recommendations)
      .filter(([flightId]) => setIds.has(parseInt(flightId)))
      .map(([flightId, gateId]) => ({
        flight_id: parseInt(flightId),
        new_gate: gateId
      }))

    if (assignments.length === 0) return
    try {
      await api.post('/assign', { assignments })
      await loadFlights()
      setSelectedFlights([])
    } catch (error) {
      console.error('Failed to assign gates:', error)
    }
  }

  const handleOpenEditRecommendation = (flightId) => {
    setEditingRecFlightId(flightId)
    setEditingRecGate(recommendations[flightId] || '')
    setShowEditRecDialog(true)
  }

  const handleSaveEditedRecommendation = () => {
    if (!editingRecFlightId) return
    setRecommendations((prev) => ({
      ...prev,
      [editingRecFlightId]: editingRecGate
    }))
    setEditingRecApplied(false)
    setShowEditRecDialog(false)
    setEditingRecFlightId(null)
    setEditingRecGate('')
  }

  const handleApplyEditedRecommendation = async () => {
    if (!editingRecFlightId || !editingRecGate) return
    try {
      await api.post('/assign', {
        assignments: [{ flight_id: editingRecFlightId, new_gate: editingRecGate }]
      })
      await loadFlights()
      setEditingRecApplied(true)
      setTimeout(() => setEditingRecApplied(false), 2000)
    } catch (error) {
      console.error('Failed to apply edited recommendation:', error)
    }
  }

  const handleOpenDetails = (flight) => {
    setDetailsFlight(flight)
    setDetailsEdited({
      ...flight,
      scheduled_date: toDisplayDateFromIso(flight.scheduled_date),
      scheduled_time: toDisplayTimeFromIso(flight.scheduled_time)
    })
    setShowDetailsDialog(true)
  }

  const handleSaveDetails = async () => {
    if (!detailsFlight) return
    const dateParsed = parseDateInputToIso(detailsEdited.scheduled_date)
    const timeParsed = parseTimeInputToHHMM(detailsEdited.scheduled_time)
    if (!dateParsed.iso || !timeParsed.hhmm) {
      alert('Invalid date/time. Use DDMMYYYY/N and HHMM.')
      return
    }
    const payload = {
      ...detailsEdited,
      scheduled_date: dateParsed.iso,
      scheduled_time: timeParsed.hhmm
    }
    if (payload.flight_type !== 'movement') {
      payload.new_position = ''
      payload.old_position = ''
    }
    try {
      await api.put(`/flights/${detailsFlight.id}`, payload)
      await loadFlights()
      setShowDetailsDialog(false)
      setDetailsFlight(null)
      setDetailsEdited({})
    } catch (error) {
      console.error('Failed to update flight:', error)
      alert('Failed to update flight')
    }
  }

  const handleClearAllData = async () => {
    if (!confirm('Are you sure you want to delete all flights and recommendations? This cannot be undone.')) return
    try {
      await api.delete('/flights')
      await loadFlights()
      setSelectedFlights([])
      setRecommendations({})
    } catch (error) {
      console.error('Failed to clear data:', error)
      alert('Failed to clear data')
    }
  }

  const handleResetDbSchema = async () => {
    if (!confirm('Reset DB schema (drop & recreate all tables)? Use this after changing models. This will delete ALL data.')) return
    try {
      await api.post('/admin/reset-db')
      await loadFlights()
      setSelectedFlights([])
      setRecommendations({})
      alert('Database schema reset completed. You can now Upload/Create again.')
    } catch (error) {
      console.error('Failed to reset DB schema:', error)
      alert(error?.response?.data?.error || 'Failed to reset DB schema')
    }
  }

  const handleCreateFlight = async () => {
    setCreateAttempted(true)
    setCreateError('')
    if (missingFields.length > 0) {
      setCreateError(`Missing required fields: ${missingFields.join(', ')}`)
      return
    }

    const dateParsed = parseDateInputToIso(newFlight.scheduled_date)
    const timeParsed = parseTimeInputToHHMM(newFlight.scheduled_time)
    if (!dateParsed.iso) {
      setCreateError('Invalid Date. Use DDMMYYYY, DD-MM-YYYY, or N for today.')
      return
    }
    if (!timeParsed.hhmm) {
      setCreateError('Invalid Time. Use HHMM (24h) or HH:MM.')
      return
    }

    const payload = {
      ...newFlight,
      scheduled_date: dateParsed.iso,
      scheduled_time: timeParsed.hhmm
    }
    if (payload.flight_type !== 'movement') {
      payload.new_position = ''
      payload.old_position = ''
    }

    try {
      await api.post('/flights', payload)
      await loadFlights()
      setShowCreateDialog(false)
      setCreateAttempted(false)
      setCreateError('')
      setNewFlight({
        flight_number: '',
        scheduled_date: '',
        scheduled_time: '',
        aircraft_registration: '',
        aircraft_type: 'narrow_body',
        new_position: '',
        old_position: '',
        assigned_gate: '',
        planned_gate: '',
        flight_type: 'arrival',
        status: 'scheduled'
      })
    } catch (error) {
      console.error('Failed to create flight:', error)
      const msg = error?.response?.data?.error || error?.message || 'Create flight failed'
      setCreateError(msg)
    }
  }

  const filteredFlights = (flights || []).filter((f) => {
    const displayDate = toDisplayDateFromIso(f.scheduled_date)
    const displayTime = toDisplayTimeFromIso(f.scheduled_time)
    const rec = recommendations[f.id] || ''

    // Global filters (separate fields)
    const fn = (globalFilters.flight_number || '').trim().toLowerCase()
    const fd = (toDisplayDateFromIso(parseDateInputToIso(globalFilters.scheduled_date).iso) || '').trim().toLowerCase()
    const fs = (globalFilters.status || '').trim().toLowerCase() === 'all' ? '' : (globalFilters.status || '').trim().toLowerCase()
    if (fn && !(f.flight_number || '').toLowerCase().startsWith(fn)) return false
    if (fd && !displayDate.startsWith(fd)) return false
    if (fs && !(f.status || '').toLowerCase().startsWith(fs)) return false

    const startsWith = (val, q) => {
      const s = (val ?? '').toString().toLowerCase()
      const qq = (q ?? '').toString().trim().toLowerCase()
      if (!qq) return true
      return s.startsWith(qq)
    }

    if (!startsWith(f.flight_number, columnFilters.flight_number)) return false
    if (!startsWith(displayDate, columnFilters.scheduled_date)) return false
    if (!startsWith(displayTime, columnFilters.scheduled_time)) return false
    if (!startsWith(f.aircraft_registration, columnFilters.aircraft_registration)) return false
    if (!startsWith(f.aircraft_type, columnFilters.aircraft_type)) return false
    if (!startsWith(f.assigned_gate, columnFilters.assigned_gate)) return false
    if (!startsWith(f.planned_gate, columnFilters.planned_gate)) return false
    if (!startsWith(f.flight_type, columnFilters.flight_type)) return false
    if (!startsWith(f.status, columnFilters.status)) return false
    if (!startsWith(rec, columnFilters.recommendation)) return false

    return true
  })

  return (
    <Box
      sx={{
        minHeight: '100%',
        py: 1,
        background: 'radial-gradient(1200px 600px at 20% -10%, rgba(33,150,243,0.14) 0%, rgba(255,255,255,0) 60%), radial-gradient(900px 500px at 80% 0%, rgba(76,175,80,0.10) 0%, rgba(255,255,255,0) 55%)'
      }}
    >
      <Card
        sx={{
          mb: 2,
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid rgba(15, 23, 42, 0.10)'
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 2,
            background: 'linear-gradient(135deg, rgba(2,6,23,0.92) 0%, rgba(17,24,39,0.92) 60%, rgba(30,58,138,0.92) 100%)'
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Stack spacing={0.5}>
              <Typography variant="h5" sx={{ color: 'rgba(255,255,255,0.92)', fontWeight: 700 }}>
                Ramp Assignment Console
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.70)' }}>
                Review flights, validate schedules, and apply best-fit ramp recommendations
              </Typography>
            </Stack>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateDialog(true)}
              sx={{
                borderRadius: 999,
                px: 2,
                background: 'linear-gradient(135deg, #2563EB 0%, #22C55E 110%)'
              }}
            >
              Create Flight/Move
            </Button>
            <Button
              variant="text"
              onClick={handleClearAllData}
              sx={{ borderRadius: 999, px: 2, color: 'rgba(255,255,255,0.72)' }}
            >
              Clear All Data
            </Button>
            <Button
              variant="text"
              onClick={handleResetDbSchema}
              sx={{ borderRadius: 999, px: 2, color: 'rgba(255,255,255,0.72)' }}
            >
              Reset DB Schema
            </Button>
          </Stack>
        </Box>
      </Card>

      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid rgba(15, 23, 42, 0.10)',
          boxShadow: '0 18px 55px rgba(2, 6, 23, 0.10)'
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Flight #"
                value={globalFilters.flight_number}
                onChange={(e) => setGlobalFilters({ ...globalFilters, flight_number: e.target.value })}
                size="small"
              />
              <TextField
                label="Date (DDMMYYYY or N)"
                value={globalFilters.scheduled_date}
                onChange={(e) => setGlobalFilters({ ...globalFilters, scheduled_date: e.target.value })}
                size="small"
                onBlur={() => {
                  const parsed = parseDateInputToIso(globalFilters.scheduled_date)
                  if (parsed.display) setGlobalFilters({ ...globalFilters, scheduled_date: parsed.display })
                }}
              />
              <TextField
                select
                label="Status"
                value={globalFilters.status}
                onChange={(e) => setGlobalFilters({ ...globalFilters, status: e.target.value })}
                size="small"
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="delayed">Delayed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
              <Button
                variant="text"
                onClick={() => {
                  setGlobalFilters({ flight_number: '', scheduled_date: '', status: 'all' })
                  setColumnFilters({
                    flight_number: '',
                    scheduled_date: '',
                    scheduled_time: '',
                    aircraft_registration: '',
                    aircraft_type: '',
                    assigned_gate: '',
                    planned_gate: '',
                    flight_type: '',
                    status: '',
                    recommendation: ''
                  })
                }}
              >
                Clear Filters
              </Button>
            </Stack>
            <Stack direction="row" spacing={2}>
              <Button 
                variant="outlined" 
                onClick={handleAssign}
                disabled={selectedFlights.length === 0}
              >
                Apply Best Recommendation
              </Button>
              <Typography variant="body2" sx={{ ml: 'auto', alignSelf: 'center' }}>
                {selectedFlights.length} flights selected
              </Typography>
            </Stack>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedFlights.length > 0 && selectedFlights.length < flights.length}
                        checked={selectedFlights.length === flights.length && flights.length > 0}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>Flight Number</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Aircraft</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Assigned Gate</TableCell>
                    <TableCell>Planned Gate</TableCell>
                    <TableCell>Flight Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Recommendation</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell />
                    <TableCell>
                      <TextField
                        value={columnFilters.flight_number}
                        onChange={(e) => setColumnFilters({ ...columnFilters, flight_number: e.target.value })}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        label="Date (DDMMYYYY or N)"
                        value={columnFilters.scheduled_date}
                        onChange={(e) => setColumnFilters({ ...columnFilters, scheduled_date: e.target.value })}
                        size="small"
                        onBlur={() => {
                          const parsed = parseDateInputToIso(columnFilters.scheduled_date)
                          if (parsed.display) setColumnFilters({ ...columnFilters, scheduled_date: parsed.display })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        label="Time (HHMM 24h)"
                        value={columnFilters.scheduled_time}
                        onChange={(e) => setColumnFilters({ ...columnFilters, scheduled_time: e.target.value })}
                        size="small"
                        onBlur={() => {
                          const parsed = parseTimeInputToHHMM(columnFilters.scheduled_time)
                          if (parsed.display) setColumnFilters({ ...columnFilters, scheduled_time: parsed.display })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={columnFilters.aircraft_registration}
                        onChange={(e) => setColumnFilters({ ...columnFilters, aircraft_registration: e.target.value })}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={columnFilters.aircraft_type}
                        onChange={(e) => setColumnFilters({ ...columnFilters, aircraft_type: e.target.value })}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={columnFilters.assigned_gate}
                        onChange={(e) => setColumnFilters({ ...columnFilters, assigned_gate: e.target.value })}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={columnFilters.planned_gate}
                        onChange={(e) => setColumnFilters({ ...columnFilters, planned_gate: e.target.value })}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={columnFilters.flight_type}
                        onChange={(e) => setColumnFilters({ ...columnFilters, flight_type: e.target.value })}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={columnFilters.status}
                        onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={columnFilters.recommendation}
                        onChange={(e) => setColumnFilters({ ...columnFilters, recommendation: e.target.value })}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredFlights.map(flight => (
                    <TableRow 
                      key={flight.id} 
                      hover 
                      sx={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        if (e.target.closest('input') || e.target.closest('button') || e.target.closest('svg')) return
                        handleOpenDetails(flight)
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedFlights.includes(flight.id)}
                          onChange={() => handleSelect(flight.id)}
                        />
                      </TableCell>
                      <TableCell>{flight.flight_number}</TableCell>
                      <TableCell>{toDisplayDateFromIso(flight.scheduled_date)}</TableCell>
                      <TableCell>{toDisplayTimeFromIso(flight.scheduled_time)}</TableCell>
                      <TableCell>{flight.aircraft_registration}</TableCell>
                      <TableCell>
                        <Chip 
                          label={flight.aircraft_type} 
                          size="small" 
                          color={flight.aircraft_type === 'wide_body' ? 'secondary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{flight.assigned_gate || 'Unassigned'}</TableCell>
                      <TableCell>{flight.planned_gate || 'N/A'}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {flight.flight_type === 'arrival' && <FlightLand sx={{ fontSize: 16, color: 'success.main' }} />}
                          {flight.flight_type === 'departure' && <FlightTakeoff sx={{ fontSize: 16, color: 'warning.main' }} />}
                          {flight.flight_type === 'movement' && <SwapHoriz sx={{ fontSize: 16, color: 'info.main' }} />}
                          <Chip 
                            label={flight.flight_type} 
                            size="small" 
                            color={flight.flight_type === 'arrival' ? 'success' : flight.flight_type === 'departure' ? 'warning' : 'info'}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={flight.status} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {recommendations[flight.id] ? (
                            <Chip 
                              label={recommendations[flight.id]} 
                              color="primary" 
                              size="small"
                            />
                          ) : (
                            <Chip label="-" size="small" />
                          )}
                          <Tooltip title="Edit recommendation">
                            <span>
                              <IconButton size="small" onClick={() => handleOpenEditRecommendation(flight.id)}>
                                <Edit />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={showEditRecDialog} onClose={() => setShowEditRecDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Recommendation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Recommended Gate"
              value={editingRecGate}
              onChange={(e) => setEditingRecGate(e.target.value)}
              fullWidth
            >
              {gateOptions.map((g) => (
                <MenuItem key={g} value={g}>{g}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowEditRecDialog(false)
              setEditingRecFlightId(null)
              setEditingRecGate('')
              setEditingRecApplied(false)
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSaveEditedRecommendation} variant="contained">Save</Button>
          <Button onClick={handleApplyEditedRecommendation} variant="outlined" disabled={!editingRecGate || editingRecApplied}>
            {editingRecApplied ? 'Applied' : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Flight Details/Edit Dialog */}
      <Dialog open={showDetailsDialog} onClose={() => setShowDetailsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Flight Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Flight Type"
              value={detailsEdited.flight_type || ''}
              onChange={(e) => setDetailsEdited({ ...detailsEdited, flight_type: e.target.value })}
              fullWidth
            >
              <MenuItem value="arrival">Arrival</MenuItem>
              <MenuItem value="departure">Departure</MenuItem>
              <MenuItem value="movement">Movement</MenuItem>
            </TextField>
            <TextField
              label="Flight Number"
              value={detailsEdited.flight_number || ''}
              onChange={(e) => setDetailsEdited({ ...detailsEdited, flight_number: e.target.value })}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Date (DDMMYYYY or N)"
                value={detailsEdited.scheduled_date || ''}
                onChange={(e) => setDetailsEdited({ ...detailsEdited, scheduled_date: e.target.value })}
                onBlur={() => {
                  const parsed = parseDateInputToIso(detailsEdited.scheduled_date)
                  if (parsed.display) setDetailsEdited({ ...detailsEdited, scheduled_date: parsed.display })
                }}
              />
              <TextField
                label="Time (HHMM 24h)"
                value={detailsEdited.scheduled_time || ''}
                onChange={(e) => setDetailsEdited({ ...detailsEdited, scheduled_time: e.target.value })}
                onBlur={() => {
                  const parsed = parseTimeInputToHHMM(detailsEdited.scheduled_time)
                  if (parsed.display) setDetailsEdited({ ...detailsEdited, scheduled_time: parsed.display })
                }}
              />
            </Stack>
            <TextField
              label="Aircraft Registration"
              value={detailsEdited.aircraft_registration || ''}
              onChange={(e) => setDetailsEdited({ ...detailsEdited, aircraft_registration: e.target.value })}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Aircraft Type"
                value={detailsEdited.aircraft_type || ''}
                onChange={(e) => setDetailsEdited({ ...detailsEdited, aircraft_type: e.target.value })}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="narrow_body">Narrow Body</MenuItem>
                <MenuItem value="wide_body">Wide Body</MenuItem>
              </TextField>
              <TextField
                select
                label="Status"
                value={detailsEdited.status || ''}
                onChange={(e) => setDetailsEdited({ ...detailsEdited, status: e.target.value })}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="delayed">Delayed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Ramp"
                value={detailsEdited.assigned_gate || ''}
                onChange={(e) => setDetailsEdited({ ...detailsEdited, assigned_gate: e.target.value })}
              />
              <TextField
                label="Planned Gate (optional)"
                value={detailsEdited.planned_gate || ''}
                onChange={(e) => setDetailsEdited({ ...detailsEdited, planned_gate: e.target.value })}
              />
            </Stack>
            {detailsEdited.flight_type === 'movement' && (
              <Stack direction="row" spacing={2}>
                <TextField
                  label="New Position"
                  value={detailsEdited.new_position || ''}
                  onChange={(e) => setDetailsEdited({ ...detailsEdited, new_position: e.target.value })}
                />
                <TextField
                  label="Old Position"
                  value={detailsEdited.old_position || ''}
                  onChange={(e) => setDetailsEdited({ ...detailsEdited, old_position: e.target.value })}
                />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetailsDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveDetails} variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* Create Flight Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Flight/Move</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {createError && (
              <Alert severity="error">{createError}</Alert>
            )}
            <TextField
              select
              label="Flight Type"
              value={newFlight.flight_type}
              onChange={(e) => setNewFlight({ ...newFlight, flight_type: e.target.value })}
              error={createAttempted && !newFlight.flight_type}
              fullWidth
            >
              <MenuItem value="arrival">Arrival</MenuItem>
              <MenuItem value="departure">Departure</MenuItem>
              <MenuItem value="movement">Movement</MenuItem>
            </TextField>
            <TextField
              label="Flight Number"
              value={newFlight.flight_number}
              onChange={(e) => setNewFlight({...newFlight, flight_number: e.target.value})}
              error={createAttempted && !newFlight.flight_number?.trim()}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Date (DDMMYYYY or N)"
                value={newFlight.scheduled_date}
                onChange={(e) => setNewFlight({...newFlight, scheduled_date: e.target.value})}
                error={createAttempted && !newFlight.scheduled_date}
                onBlur={() => {
                  const parsed = parseDateInputToIso(newFlight.scheduled_date)
                  if (parsed.display) setNewFlight({ ...newFlight, scheduled_date: parsed.display })
                }}
              />
              <TextField
                label="Time (HHMM 24h)"
                value={newFlight.scheduled_time}
                onChange={(e) => setNewFlight({...newFlight, scheduled_time: e.target.value})}
                error={createAttempted && !newFlight.scheduled_time}
                onBlur={() => {
                  const parsed = parseTimeInputToHHMM(newFlight.scheduled_time)
                  if (parsed.display) setNewFlight({ ...newFlight, scheduled_time: parsed.display })
                }}
              />
            </Stack>
            <TextField
              label="Aircraft Registration"
              value={newFlight.aircraft_registration}
              onChange={(e) => setNewFlight({...newFlight, aircraft_registration: e.target.value})}
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Aircraft Type"
                value={newFlight.aircraft_type}
                onChange={(e) => setNewFlight({...newFlight, aircraft_type: e.target.value})}
                sx={{ minWidth: 200 }}
                error={createAttempted && !newFlight.aircraft_type}
              >
                <MenuItem value="narrow_body">Narrow Body</MenuItem>
                <MenuItem value="wide_body">Wide Body</MenuItem>
              </TextField>
              <TextField
                select
                label="Status"
                value={newFlight.status}
                onChange={(e) => setNewFlight({...newFlight, status: e.target.value})}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="delayed">Delayed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Ramp"
                value={newFlight.assigned_gate}
                onChange={(e) => setNewFlight({...newFlight, assigned_gate: e.target.value})}
              />
              <TextField
                label="Planned Gate (optional)"
                value={newFlight.planned_gate}
                onChange={(e) => setNewFlight({...newFlight, planned_gate: e.target.value})}
              />
            </Stack>
            {newFlight.flight_type === 'movement' && (
              <Stack direction="row" spacing={2}>
                <TextField
                  label="New Position"
                  value={newFlight.new_position}
                  onChange={(e) => setNewFlight({ ...newFlight, new_position: e.target.value })}
                />
                <TextField
                  label="Old Position"
                  value={newFlight.old_position}
                  onChange={(e) => setNewFlight({ ...newFlight, old_position: e.target.value })}
                />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowCreateDialog(false)
              setCreateAttempted(false)
              setCreateError('')
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleCreateFlight} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
