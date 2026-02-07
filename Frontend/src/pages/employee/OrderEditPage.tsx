import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { ordersApi } from '../../services/api'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Card, CardContent } from '../../components/ui/card'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu'
import { 
  Settings,
  LogOut,
  ArrowLeft,
  Activity,
  LayoutDashboard,
  Loader2,
  AlertCircle,
  Lock
} from 'lucide-react'
import { OrderForm } from '../../components/orders/OrderForm'
import { ChangePasswordDialog } from '../../components/common/ChangePasswordDialog'

export const OrderEditPage = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { orderId } = useParams<{ orderId: string }>()
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  // Fetch order data
  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(parseInt(orderId!)),
    enabled: !!orderId,
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getInitials = (name: string) => {
    if (!name) return '??'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleOrderUpdated = () => {
    // Navigate back to dashboard after successful update
    navigate(getDashboardPath())
  }

  const getDashboardPath = () => {
    switch (user?.userRole) {
      case 'superadmin':
      case 'admin':
        return '/admin/dashboard'
      case 'team_lead':
        return '/teamlead/dashboard'
      case 'employee':
        return '/employee/dashboard'
      default:
        return '/login'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate(getDashboardPath())}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Edit Order</h1>
                <p className="text-sm text-slate-600">
                  {order ? `Order #${order.fileNumber}` : 'Loading...'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate(getDashboardPath())}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
              
              <Badge variant="outline" className="px-3 py-1">
                <Activity className="w-3 h-3 mr-1" />
                {user?.userRole}
              </Badge>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(user?.userName || '')}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.userName}</p>
                      <p className="text-xs text-muted-foreground">@{user?.userName}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                    <Lock className="mr-2 h-4 w-4" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-slate-600">Loading order...</span>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="py-16">
                <div className="flex flex-col items-center justify-center text-center">
                  <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Failed to load order
                  </h3>
                  <p className="text-slate-600 mb-4">
                    {error instanceof Error ? error.message : 'An error occurred while loading the order.'}
                  </p>
                  <Button onClick={() => navigate(getDashboardPath())}>
                    Return to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : order ? (
            <OrderForm 
              order={order}
              onSuccess={handleOrderUpdated}
              onCancel={() => navigate(getDashboardPath())}
            />
          ) : (
            <Card>
              <CardContent className="py-16">
                <div className="flex flex-col items-center justify-center text-center">
                  <AlertCircle className="h-12 w-12 text-orange-500 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Order not found
                  </h3>
                  <p className="text-slate-600 mb-4">
                    The order you're looking for doesn't exist or you don't have permission to view it.
                  </p>
                  <Button onClick={() => navigate(getDashboardPath())}>
                    Return to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  )
}

export default OrderEditPage
