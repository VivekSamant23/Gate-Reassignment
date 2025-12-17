import React, { useState } from 'react'
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import { api } from '../api'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(res.data)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Upload Flight Data
      </Typography>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button variant="contained" disabled={!file || uploading} onClick={handleUpload}>
              Upload
            </Button>
            {result && (
              <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
