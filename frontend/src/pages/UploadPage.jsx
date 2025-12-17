import React, { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
  Divider,
  Alert,
  Snackbar
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Download } from '@mui/icons-material'

export default function UploadPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [uploadStuck, setUploadStuck] = useState(false)
  const [abortController, setAbortController] = useState(null)

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setUploadStuck(false)
    const controller = new AbortController()
    setAbortController(controller)
    const stuckTimer = setTimeout(() => setUploadStuck(true), 25000)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
        signal: controller.signal
      })
      setResult(res.data)
      setShowSuccess(true)
      // Redirect to flights page after successful upload
      setTimeout(() => {
        navigate('/flights')
      }, 2000)
    } catch (error) {
      console.error('Upload error:', error)
      const errorMsg = error.response?.data?.error || error.message || 'Upload failed (no details from server)'
      setResult({ error: errorMsg })
    } finally {
      setUploading(false)
      clearTimeout(stuckTimer)
      setAbortController(null)
      setUploadStuck(false)
    }
  }

  const handleAbortUpload = () => {
    if (abortController) abortController.abort()
    setUploading(false)
    setUploadStuck(false)
    setAbortController(null)
    setResult({ error: 'Upload cancelled by user.' })
  }

  const downloadTemplate = async (filename) => {
    try {
      const response = await fetch(`/api/template/${filename}`)
      if (!response.ok) {
        throw new Error('Template download failed')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading template:', error)
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Upload Flight Data
      </Typography>
      
      {/* Template Download Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Download Template
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Start with our template file to ensure your data format is correct.
          </Alert>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => downloadTemplate('flight_upload_template.csv')}
            >
              Download CSV Template
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => downloadTemplate('flight_upload_template.xlsx')}
            >
              Download Excel Template
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* File Upload Section */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Upload Your File
          </Typography>
          <Stack spacing={2}>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ padding: '10px', border: '1px dashed #ccc', borderRadius: '4px' }}
            />
            <Button 
              variant="contained" 
              disabled={!file || uploading} 
              onClick={handleUpload}
              fullWidth
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            {uploadStuck && (
              <Alert severity="warning" action={
                <Button size="small" onClick={handleAbortUpload}>Cancel</Button>
              }>
                Upload is taking longer than expected. If the file is very large, this is normal. You can wait or cancel.
              </Alert>
            )}
            {result && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Upload Results:
                </Typography>
                <Box sx={{ 
                  backgroundColor: '#f5f5f5', 
                  padding: 2, 
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}>
                  {result.error ? (
                    <Typography variant="body2" color="error">
                      Error: {result.error}
                    </Typography>
                  ) : (
                    <>
                      <Typography variant="body2">
                        Processed rows: {result.processed_rows}
                      </Typography>
                      <Typography variant="body2">
                        Saved flights: {result.saved_flights}
                      </Typography>
                      <Typography variant="body2">
                        Columns found: {result.columns?.join(', ')}
                      </Typography>
                    </>
                  )}
                </Box>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
      
      <Snackbar
        open={showSuccess}
        autoHideDuration={2000}
        message="Upload successful! Redirecting to Flights page..."
        onClose={() => setShowSuccess(false)}
      />
    </Box>
  )
}
