import { useCallback, useEffect, useState } from 'react'
import { zoomInfoIntegrationService } from '../services/zoominfoIntegration.service'

export function useZoomInfoIntegration() {
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [clientIdMasked, setClientIdMasked] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [removing, setRemoving] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      setError(null)
      const s = await zoomInfoIntegrationService.getStatus()
      setConfigured(s.configured)
      setClientIdMasked(s.clientIdMasked)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to load ZoomInfo status',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleTest = useCallback(async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Client ID and client secret are required to test')
      return
    }
    setTesting(true)
    setError(null)
    setSuccess(null)
    try {
      await zoomInfoIntegrationService.testCredentials(
        clientId.trim(),
        clientSecret.trim(),
      )
      setSuccess('Connection test succeeded')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }, [clientId, clientSecret])

  const handleSave = useCallback(async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Client ID and client secret are required')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await zoomInfoIntegrationService.saveCredentials(
        clientId.trim(),
        clientSecret.trim(),
      )
      setConfigured(true)
      setClientIdMasked(res.clientIdMasked ?? null)
      setClientSecret('')
      setSuccess(res.message || 'Saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [clientId, clientSecret])

  const handleRemove = useCallback(async () => {
    setRemoving(true)
    setError(null)
    setSuccess(null)
    try {
      await zoomInfoIntegrationService.disconnect()
      setConfigured(false)
      setClientIdMasked(null)
      setClientId('')
      setClientSecret('')
      setSuccess('ZoomInfo integration removed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemoving(false)
    }
  }, [])

  return {
    loading,
    configured,
    clientIdMasked,
    clientId,
    setClientId,
    clientSecret,
    setClientSecret,
    error,
    success,
    saving,
    testing,
    removing,
    handleTest,
    handleSave,
    handleRemove,
  }
}
