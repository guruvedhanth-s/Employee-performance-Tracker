import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, AlertTriangle, CheckCircle } from 'lucide-react'
import { resetDatabase } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

export const DatabaseResetComponent: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  const { user } = useAuthStore()

  // Only show for superadmin
  if (user?.userRole !== 'superadmin') {
    return null
  }

  const handleReset = async () => {
    if (confirmText !== 'RESET') {
      setMessage({ type: 'error', text: 'Please type RESET to confirm' })
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      const response = await resetDatabase()
      setMessage({ 
        type: 'success', 
        text: `Database reset successfully! ${response.details.organizations} organizations, ${response.details.admin_users} admin users, and ${response.details.teams} teams created.` 
      })
      
      // Clear local storage and redirect to login after successful reset
      setTimeout(() => {
        localStorage.clear()
        window.location.href = '/login'
      }, 3000)
      
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || 'Failed to reset database' 
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setConfirmText('')
    setMessage(null)
  }

  return (
    <Card className="border-red-200">
      <CardHeader className="bg-red-50">
        <CardTitle className="flex items-center gap-2 text-red-700">
          <Trash2 className="h-5 w-5" />
          Database Reset
        </CardTitle>
        <CardDescription className="text-red-600">
          Completely reset the database - this action cannot be undone
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            <strong>Warning:</strong> This will permanently delete all data including:
            <ul className="mt-2 list-disc list-inside text-sm">
              <li>All orders and order history</li>
              <li>All user accounts except initial admins</li>
              <li>All teams and team assignments</li>
              <li>All performance metrics</li>
              <li>All audit trails</li>
            </ul>
            The database will be recreated with initial organizations and admin users.
          </AlertDescription>
        </Alert>

        {message && (
          <Alert className={`mb-4 ${message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Reset Database
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Confirm Database Reset
              </DialogTitle>
              <DialogDescription>
                This action will permanently delete all data and cannot be undone.
                The database will be recreated with initial setup data.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="confirm-text">
                  Type "RESET" to confirm this action:
                </Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESET"
                  className="uppercase"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={isLoading || confirmText !== 'RESET'}
              >
                {isLoading ? 'Resetting...' : 'Reset Database'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}