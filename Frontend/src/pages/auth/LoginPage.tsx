import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { ChangePasswordDialog } from '../../components/common/ChangePasswordDialog'
import { AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../utils/errorUtils'

export const LoginPage: React.FC = () => {
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [forcePasswordChange, setForcePasswordChange] = useState(false)
  
  const login = useAuthStore(state => state.login)
  const navigate = useNavigate()

  const getDashboardPath = (userRole: string) => {
    if (userRole === 'superadmin' || userRole === 'admin') {
      return '/admin/dashboard'
    } else if (userRole === 'team_lead') {
      return '/teamlead/dashboard'
    } else {
      return '/employee/dashboard'
    }
  }

  const navigateToDashboard = () => {
    const user = useAuthStore.getState().user
    if (user) {
      navigate(getDashboardPath(user.userRole))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!userName || !password) {
      setError('Please fill in all fields')
      return
    }

    setIsLoading(true)
    setError('')
    
    try {
      await login(userName, password)
      
      // Check if user must change password
      const user = useAuthStore.getState().user
      if (user?.mustChangePassword) {
        setForcePasswordChange(true)
        toast('Please change your password to continue', { icon: '🔐' })
      } else {
        toast.success('Login successful!')
        navigateToDashboard()
      }
    } catch (error: any) {
      const errorMsg = extractErrorMessage(error, 'Invalid username or password')
      setError(errorMsg)
      toast.error(errorMsg, { duration: 8000 })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChangeSuccess = () => {
    setForcePasswordChange(false)
    toast.success('Password changed successfully! Redirecting...')
    navigateToDashboard()
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50">
        {/* Subtle animated background pattern */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100"></div>
          <div className="absolute top-0 left-0 w-full h-full opacity-30">
            <div className="absolute top-20 left-20 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
            <div className="absolute top-40 right-20 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-20 left-40 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
          </div>
        </div>
        
        {/* Main login card */}
        <div className="w-full max-w-md relative z-10 p-4">
          <Card className="shadow-xl border-slate-200">
            <CardHeader className="space-y-3 pb-6">
              <div className="flex justify-center mb-2">
                <div className="bg-primary rounded-xl p-3 shadow-lg">
                  <ShieldCheck className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-center text-slate-900">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-center text-base text-slate-600">
                Order & Performance Management System
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pb-8">
              {error && (
                <Alert variant="destructive" className="mb-6 border-red-300 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="font-medium">{error}</AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="userName" className="text-sm font-semibold text-slate-700">
                    Username
                  </Label>
                  <Input
                    id="userName"
                    name="userName"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your username"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-11 pr-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1"
                      disabled={isLoading}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
              
              <div className="mt-6 pt-6 border-t border-slate-200">
                <p className="text-xs text-center text-slate-500 flex items-center justify-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure authentication with advanced encryption
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Force Password Change Dialog */}
      <ChangePasswordDialog
        open={forcePasswordChange}
        onOpenChange={setForcePasswordChange}
        forceChange={true}
        onSuccess={handlePasswordChangeSuccess}
      />
    </>
  )
}
