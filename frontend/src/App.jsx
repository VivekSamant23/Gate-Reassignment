import React from 'react'
import { Routes, Route, Link, Navigate } from 'react-router-dom'
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography
} from '@mui/material'

import FlightsPage from './pages/FlightsPage'
import UploadPage from './pages/UploadPage'
import ConfigPage from './pages/ConfigPage'

export default function App() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Gate Reassignment
          </Typography>
          <Button color="inherit" component={Link} to="/flights">Flights</Button>
          <Button color="inherit" component={Link} to="/upload">Upload</Button>
          <Button color="inherit" component={Link} to="/config">Config</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/flights" replace />} />
          <Route path="/flights" element={<FlightsPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </Container>
    </Box>
  )
}
