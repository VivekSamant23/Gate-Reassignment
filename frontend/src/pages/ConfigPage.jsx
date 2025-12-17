import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { api } from '../api'

export default function ConfigPage() {
  const [configJson, setConfigJson] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await api.get('/config')
      setConfigJson(JSON.stringify(res.data.config || {}, null, 2))
    }
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const parsed = JSON.parse(configJson || '{}')
      await api.post('/config', parsed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Configuration
      </Typography>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography color="text.secondary">
              This is a minimal editor for now. Next step is a proper UI for gates/ramps/hangars.
            </Typography>
            <TextField
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              multiline
              minRows={16}
              fullWidth
              label="Airport config (JSON)"
            />
            <Button variant="contained" disabled={saving} onClick={save}>
              Save
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
