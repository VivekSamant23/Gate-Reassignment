import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography
} from '@mui/material'

import { api } from '../api'

function formatFlightLabel(f) {
  return `${f.flight_number} (${f.flight_type})`
}

export default function FlightsPage() {
  const [loading, setLoading] = useState(false)
  const [flights, setFlights] = useState([])
  const [selectedFlightIds, setSelectedFlightIds] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [assigning, setAssigning] = useState(false)

  const selectedFlights = useMemo(() => {
    const setIds = new Set(selectedFlightIds)
    return flights.filter((f) => setIds.has(f.id))
  }, [flights, selectedFlightIds])

  const fetchFlights = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/flights')
      setFlights(res.data.flights || [])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRecommendations = useCallback(async () => {
    if (selectedFlightIds.length === 0) {
      setRecommendations([])
      return
    }

    const res = await api.post('/recommendations', { flight_ids: selectedFlightIds })
    setRecommendations(res.data.recommendations || [])
  }, [selectedFlightIds])

  useEffect(() => {
    fetchFlights()
  }, [fetchFlights])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  const bestRecommendationByFlightId = useMemo(() => {
    const best = new Map()
    for (const rec of recommendations) {
      if (!best.has(rec.flight_id)) best.set(rec.flight_id, rec)
    }
    return best
  }, [recommendations])

  const handleAssignBest = async () => {
    setAssigning(true)
    try {
      const assignments = selectedFlights
        .map((f) => {
          const rec = bestRecommendationByFlightId.get(f.id)
          if (!rec) return null
          return { flight_id: f.id, new_gate: rec.gate_number }
        })
        .filter(Boolean)

      await api.post('/assign', { assignments })
      await fetchFlights()
      await fetchRecommendations()
    } finally {
      setAssigning(false)
    }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Flights & Gate Recommendations</Typography>
        <Button variant="outlined" onClick={fetchFlights} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="flight-select-label">Select flights for reassignment</InputLabel>
              <Select
                labelId="flight-select-label"
                multiple
                value={selectedFlightIds}
                label="Select flights for reassignment"
                onChange={(e) => setSelectedFlightIds(e.target.value)}
                renderValue={(selected) => {
                  const setIds = new Set(selected)
                  const names = flights.filter((f) => setIds.has(f.id)).map(formatFlightLabel)
                  return names.join(', ')
                }}
              >
                {flights.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {formatFlightLabel(f)} | Assigned: {f.assigned_gate || '-'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                disabled={selectedFlightIds.length === 0 || assigning}
                onClick={handleAssignBest}
              >
                Apply Best Recommendation
              </Button>
              {(loading || assigning) && <CircularProgress size={24} />}
            </Stack>

            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Current Best Recommendations
              </Typography>
              {selectedFlights.length === 0 ? (
                <Typography color="text.secondary">Select flights to see recommendations.</Typography>
              ) : (
                <Stack spacing={1}>
                  {selectedFlights.map((f) => {
                    const rec = bestRecommendationByFlightId.get(f.id)
                    return (
                      <Box key={f.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>
                          {formatFlightLabel(f)}
                        </Typography>
                        <Typography>
                          Best gate: <b>{rec?.gate_number || '-'}</b>
                          {rec ? ` (score ${rec.total_score})` : ''}
                        </Typography>
                      </Box>
                    )
                  })}
                </Stack>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
