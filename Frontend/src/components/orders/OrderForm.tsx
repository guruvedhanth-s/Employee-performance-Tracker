import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { teamsApi, referenceApi, usersApi, ordersApi, organizationsApi } from '../../services/api'
import type { 
  OrderCreate, 
  OrderUpdate,
  Order,
  UserAliasOption  // Used for alias options query result type
} from '../../types'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Loader2, Save, Info } from 'lucide-react'
import toast from 'react-hot-toast'

interface OrderFormProps {
  order?: Order
  onSuccess?: () => void
  onCancel?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const OrderForm = ({ order, onSuccess, onCancel: _onCancel }: OrderFormProps) => {
  const isEditMode = !!order
  const { user } = useAuthStore()
  
  // Get edit permissions from the order (set by backend)
  const editPermissions = order?.editPermissions
  
  // Determine what this user can edit in edit mode
  const canEditOrderDetails = !isEditMode || (editPermissions?.canEditOrderDetails ?? true)
  const canEditStep1 = !isEditMode || (editPermissions?.canEditStep1 ?? true)
  const canEditStep2 = !isEditMode || (editPermissions?.canEditStep2 ?? true)
  
  // Form state
  const [fileNumber, setFileNumber] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [selectedState, setSelectedState] = useState('')
  const [county, setCounty] = useState('')
  const [selectedProductType, setSelectedProductType] = useState('')
  const [selectedTransactionTypeId, setSelectedTransactionTypeId] = useState<number | null>(null)
  const [selectedProcessTypeId, setSelectedProcessTypeId] = useState<number | null>(null)
  const [selectedOrderStatusId, setSelectedOrderStatusId] = useState<number | null>(null)
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null)
  
  // Step assignment state - only used by admins
  const [step1UserId, setStep1UserId] = useState<number | null>(null)
  const [step1FakeName, setStep1FakeName] = useState<string>('')
  const [step1StartTime, setStep1StartTime] = useState('')
  const [step1EndTime, setStep1EndTime] = useState('')
  const [step2UserId, setStep2UserId] = useState<number | null>(null)
  const [step2FakeName, setStep2FakeName] = useState<string>('')
  const [step2StartTime, setStep2StartTime] = useState('')
  const [step2EndTime, setStep2EndTime] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  
  // File number check state - simplified
  const [fileNumberExists, setFileNumberExists] = useState(false)
  const [canAddStep2, setCanAddStep2] = useState(false)
  const [canAddStep1, setCanAddStep1] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_existingOrderId, setExistingOrderId] = useState<number | null>(null)
  const [isCheckingFileNumber, setIsCheckingFileNumber] = useState(false)

  // Check user role - determines form behavior
  const isAdminOrSuperadmin = user?.userRole === 'admin' || user?.userRole === 'superadmin'
  const isTeamLead = user?.userRole === 'team_lead'
  // const isEmployee = user?.userRole === 'employee'
  
  // Can this user assign work to others? (admin, superadmin, team_lead)
  const canAssignToOthers = isAdminOrSuperadmin || isTeamLead

  // For regular users: fetch their team memberships
  const { data: userProfile, isLoading: loadingUserProfile } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: () => usersApi.get(user!.id),
    enabled: !!user && !isAdminOrSuperadmin,
  })

  // For superadmin: fetch all organizations to allow selection
  const { data: organizationsData, isLoading: loadingOrganizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationsApi.list({ isActive: true }),
    enabled: !!user && user.userRole === 'superadmin',
  })

  // Determine which orgId to use for fetching teams
  const effectiveOrgId = user?.userRole === 'superadmin' 
    ? selectedOrgId 
    : (user?.orgId || null)

  // For admin/superadmin: fetch all teams in the selected organization
  const { data: allTeamsData, isLoading: loadingAllTeams } = useQuery({
    queryKey: ['teams', effectiveOrgId],
    queryFn: () => teamsApi.list({ orgId: effectiveOrgId || undefined, isActive: true }),
    enabled: !!user && isAdminOrSuperadmin && !!effectiveOrgId,
  })

  // Fetch team details when a team is selected (moved up to be available in getAvailableTeams)
  const { data: selectedTeamDetails, isLoading: loadingTeamDetails } = useQuery({
    queryKey: ['team', selectedTeamId],
    queryFn: () => teamsApi.get(selectedTeamId!),
    enabled: !!selectedTeamId,
  })

  // Get the teams to display based on user role
  const getAvailableTeams = (): { id: number; name: string }[] => {
    let teams: { id: number; name: string }[] = []
    
    if (isAdminOrSuperadmin) {
      // Admin/Superadmin sees all org teams
      teams = allTeamsData?.items?.map(t => ({ id: t.id, name: t.name })) || []
    } else {
      // Regular users (employee, team_lead) only see their assigned teams
      // Filter by both: user's membership active (isActive) AND team not deactivated (teamIsActive)
      teams = userProfile?.teams?.filter(t => t.isActive && t.teamIsActive).map(t => ({ 
        id: t.teamId, 
        name: t.teamName 
      })) || []
    }
    
    // In edit mode, ensure the order's team is always in the list
    if (isEditMode && order?.teamId) {
      const orderTeamExists = teams.some(t => t.id === order.teamId)
      if (!orderTeamExists) {
        // Use the team name from selectedTeamDetails if available, otherwise show placeholder
        const teamName = selectedTeamDetails?.name || `Team ${order.teamId}`
        teams = [{ id: order.teamId, name: teamName }, ...teams]
      }
    }
    
    return teams
  }

  const availableTeams = getAvailableTeams()
  const loadingTeams = isAdminOrSuperadmin ? (loadingAllTeams || loadingOrganizations) : loadingUserProfile

  // Fetch reference data
  const { data: transactionTypes, isLoading: loadingTransactionTypes } = useQuery({
    queryKey: ['transactionTypes'],
    queryFn: referenceApi.getTransactionTypes,
  })

  const { data: processTypes, isLoading: loadingProcessTypes } = useQuery({
    queryKey: ['processTypes'],
    queryFn: referenceApi.getProcessTypes,
  })

  const { data: orderStatuses, isLoading: loadingOrderStatuses } = useQuery({
    queryKey: ['orderStatuses'],
    queryFn: referenceApi.getOrderStatuses,
  })

  const { data: divisions, isLoading: loadingDivisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: referenceApi.getDivisions,
  })

  // Fetch alias options (masked names) for the selected team - for user assignment
  const { data: aliasOptions = [], isLoading: loadingAliasOptions } = useQuery({
    queryKey: ['teamAliasOptions', selectedTeamId],
    queryFn: () => teamsApi.getAliasOptions(selectedTeamId!),
    enabled: !!selectedTeamId && canAssignToOthers,
  })

  // Fetch fake names pool for the selected team - for order masking
  const { data: faNamesData, isLoading: loadingFakeNames } = useQuery({
    queryKey: ['teamFakeNames', selectedTeamId],
    queryFn: () => teamsApi.getFakeNames(selectedTeamId!),
    enabled: !!selectedTeamId,
  })
  const faNames = faNamesData?.items || []

  // Get available states and products from selected team
  // In edit mode, ensure the order's current values are always included in the options
  const teamStates = selectedTeamDetails?.states?.map(s => s.state) || []
  const teamProducts = selectedTeamDetails?.products?.map(p => p.productType) || []
  
  // Include the order's current state/product if not already in the list (for edit mode)
  const availableStates = isEditMode && order?.state && !teamStates.includes(order.state)
    ? [order.state, ...teamStates]
    : teamStates
  const availableProducts = isEditMode && order?.productType && !teamProducts.includes(order.productType)
    ? [order.productType, ...teamProducts]
    : teamProducts

  // Check file number + product type combination - check if it exists globally
  const checkFileNumberAndProduct = async (fileNum: string, productType: string) => {
    if (!fileNum.trim() || !productType.trim() || !selectedTeamId || isEditMode) {
      setFileNumberExists(false)
      setCanAddStep2(false)
      setCanAddStep1(false)
      setExistingOrderId(null)
      return
    }
    
    setIsCheckingFileNumber(true)
    try {
      const result = await ordersApi.checkFileNumber(fileNum.trim(), selectedTeamId, productType.trim())
      
      if (result.exists) {
        // File + product combination exists globally - check if Step 1 or Step 2 can be added
        if (result.sameTeam && result.step1Completed && !result.step2Completed) {
          // Same team, Step 1 done, Step 2 available - allow user to add Step 2
          setFileNumberExists(true)
          setCanAddStep2(true)
          setCanAddStep1(false)
          setExistingOrderId(result.orderId)
          
          // Auto-fill form with existing order details
          if (result.existingOrderDetails) {
            const details = result.existingOrderDetails
            setSelectedState(details.state || '')
            setCounty(details.county || '')
            // Don't overwrite productType since user already selected it
            setSelectedTransactionTypeId(details.transactionTypeId || null)
            setSelectedOrderStatusId(details.orderStatusId || null)
            setSelectedDivisionId(details.divisionId || null)
            if (details.entryDate) {
              setEntryDate(details.entryDate)
            }
          }
          
          // Auto-select Step2 process type
          if (processTypes) {
            const step2Process = processTypes.find(p => p.name === 'Step2' && p.isActive)
            if (step2Process) {
              setSelectedProcessTypeId(step2Process.id)
            }
          }
          
          toast.success('File found! You can add Step 2 to this order.', { duration: 5000 })
        } else if (result.sameTeam && !result.step1Completed && result.step2Completed) {
          // Same team, Step 2 done, Step 1 available - allow user to add Step 1
          setFileNumberExists(true)
          setCanAddStep2(false)
          setCanAddStep1(true)
          setExistingOrderId(result.orderId)
          
          // Auto-fill form with existing order details
          if (result.existingOrderDetails) {
            const details = result.existingOrderDetails
            setSelectedState(details.state || '')
            setCounty(details.county || '')
            // Don't overwrite productType since user already selected it
            setSelectedTransactionTypeId(details.transactionTypeId || null)
            setSelectedOrderStatusId(details.orderStatusId || null)
            setSelectedDivisionId(details.divisionId || null)
            if (details.entryDate) {
              setEntryDate(details.entryDate)
            }
          }
          
          // Auto-select Step1 process type
          if (processTypes) {
            const step1Process = processTypes.find(p => p.name === 'Step1' && p.isActive)
            if (step1Process) {
              setSelectedProcessTypeId(step1Process.id)
            }
          }
          
          toast.success('File found! You can add Step 1 to this order.', { duration: 5000 })
        } else {
          // File + product exists but can't add Step 1 or Step 2 - show error
          setFileNumberExists(true)
          setCanAddStep2(false)
          setCanAddStep1(false)
          setExistingOrderId(null)
          toast.error('File number with this product type already exists', { duration: 5000 })
        }
      } else {
        // File + product combination doesn't exist anywhere - new order allowed
        setFileNumberExists(false)
        setCanAddStep2(false)
        setCanAddStep1(false)
        setExistingOrderId(null)
      }
    } catch (error) {
      console.error('Error checking file number:', error)
      setFileNumberExists(false)
      setCanAddStep2(false)
      setCanAddStep1(false)
      setExistingOrderId(null)
    } finally {
      setIsCheckingFileNumber(false)
    }
  }

  // Check file number on blur - requires both file number and product type
  const handleFileNumberBlur = async () => {
    await checkFileNumberAndProduct(fileNumber, selectedProductType)
  }

  // Check when product type changes (if file number is already filled)
  const handleProductTypeChange = async (newProductType: string) => {
    setSelectedProductType(newProductType)
    // Reset the check states when product type changes
    setFileNumberExists(false)
    setCanAddStep2(false)
    setCanAddStep1(false)
    setExistingOrderId(null)
    // Check if file number is already filled
    if (fileNumber.trim() && newProductType.trim() && selectedTeamId && !isEditMode) {
      await checkFileNumberAndProduct(fileNumber, newProductType)
    }
  }

  // Reset dependent fields when team changes (only in create mode)
  useEffect(() => {
    if (!isEditMode) {
      // Reset fields first
      setSelectedState('')
      setSelectedProductType('')
      setCounty('')
      setSelectedTransactionTypeId(null)
      setStep1UserId(null)
      setStep2UserId(null)
      setFileNumberExists(false)
      setCanAddStep2(false)
      setCanAddStep1(false)
      setExistingOrderId(null)
    }
  }, [selectedTeamId, isEditMode])

  // Auto-select organization for admin users (they have a fixed orgId)
  useEffect(() => {
    if (user?.userRole === 'admin' && user.orgId && !selectedOrgId) {
      setSelectedOrgId(user.orgId)
    }
  }, [user, selectedOrgId])

  // Reset team selection when organization changes
  useEffect(() => {
    if (!isEditMode) {
      setSelectedTeamId(null)
    }
  }, [selectedOrgId, isEditMode])

  // Initialize form with order data in edit mode
  useEffect(() => {
    if (isEditMode && order) {
      setFileNumber(order.fileNumber)
      setEntryDate(order.entryDate.split('T')[0])
      setSelectedOrgId(order.orgId) // Set organization ID in edit mode
      setSelectedTeamId(order.teamId)
      setSelectedState(order.state)
      setCounty(order.county)
      setSelectedProductType(order.productType)
      setSelectedTransactionTypeId(order.transactionTypeId)
      setSelectedProcessTypeId(order.processTypeId)
      setSelectedOrderStatusId(order.orderStatusId)
      setSelectedDivisionId(order.divisionId)
      
      // Set step info
      if (order.step1) {
        if (order.step1.userId) setStep1UserId(order.step1.userId)
        if (order.step1.faName) setStep1FakeName(order.step1.faName)
        if (order.step1.startTime) setStep1StartTime(order.step1.startTime.split('T')[0])
        if (order.step1.endTime) setStep1EndTime(order.step1.endTime.split('T')[0])
      }
      if (order.step2) {
        if (order.step2.userId) setStep2UserId(order.step2.userId)
        if (order.step2.faName) setStep2FakeName(order.step2.faName)
        if (order.step2.startTime) setStep2StartTime(order.step2.startTime.split('T')[0])
        if (order.step2.endTime) setStep2EndTime(order.step2.endTime.split('T')[0])
      }
    }
  }, [isEditMode, order])

  // Auto-select team if user only has one team (only in create mode)
  useEffect(() => {
    if (!isEditMode && availableTeams.length === 1 && !selectedTeamId) {
      setSelectedTeamId(availableTeams[0].id)
    }
  }, [availableTeams, selectedTeamId, isEditMode])

  // Auto-set order status to first active one (only in create mode)
  useEffect(() => {
    if (!isEditMode && orderStatuses?.length && !selectedOrderStatusId) {
      const activeStatus = orderStatuses.find(s => s.isActive)
      if (activeStatus) setSelectedOrderStatusId(activeStatus.id)
    }
  }, [orderStatuses, selectedOrderStatusId, isEditMode])

  // Auto-set division to first one (only in create mode)
  useEffect(() => {
    if (!isEditMode && divisions?.length && !selectedDivisionId) {
      setSelectedDivisionId(divisions[0].id)
    }
  }, [divisions, selectedDivisionId, isEditMode])

  // Auto-set process type for employees (only in create mode)
  useEffect(() => {
    if (!isEditMode && processTypes?.length && !selectedProcessTypeId) {
      // Default to first active process type
      const defaultProcess = processTypes.find(p => p.isActive)
      if (defaultProcess) setSelectedProcessTypeId(defaultProcess.id)
    }
  }, [processTypes, selectedProcessTypeId, isEditMode])

  // Handle process type changes - manage step users for Single Seat
  useEffect(() => {
    const selectedProcessType = processTypes?.find(p => p.id === selectedProcessTypeId)
    if (selectedProcessType?.name === 'Single Seat' && canAssignToOthers) {
      // For single seat, step2 user should be same as step1
      setStep2UserId(step1UserId)
    }
  }, [selectedProcessTypeId, step1UserId, processTypes, canAssignToOthers])

  const validateForm = (): boolean => {
    const newErrors: string[] = []
    
    // Superadmin must select an organization
    if (user?.userRole === 'superadmin' && !selectedOrgId) {
      newErrors.push('Organization is required')
    }
    
    if (!fileNumber.trim()) newErrors.push('File number is required')
    // Entry date is auto-generated, no validation needed
    if (!selectedTeamId) newErrors.push('Team is required')
    if (!selectedState) newErrors.push('State is required')
    if (!county.trim()) newErrors.push('County is required')
    if (!selectedProductType) newErrors.push('Product type is required')
    if (!selectedTransactionTypeId) newErrors.push('Transaction type is required')
    if (!selectedProcessTypeId) newErrors.push('Process type is required')
    if (!selectedDivisionId) newErrors.push('Division is required')
    
    // Order status is only required for admins
    if (canAssignToOthers && !selectedOrderStatusId) newErrors.push('Order status is required')
    
    // NOTE: We don't validate duplicate file numbers on the frontend anymore.
    // The backend will return appropriate error messages as toast notifications.
    
    // For admins assigning to others, validate step users
    if (canAssignToOthers) {
      const selectedProcessType = processTypes?.find(p => p.id === selectedProcessTypeId)
      if (selectedProcessType) {
        // Note: User assignment removed from UI - users will be auto-assigned by backend or manually set
        // Validation removed since Assign User dropdown is removed
      }
    }
    
    // Validate fake names and dates are required
    const currentProcessType = processTypes?.find(p => p.id === selectedProcessTypeId)
    if (currentProcessType) {
      // Validate fake names first
      if (isEditMode && !canAssignToOthers) {
        // Employee editing - validate fake names for steps they can edit
        if (canEditStep1 && (currentProcessType.name === 'Step1' || currentProcessType.name === 'Single Seat')) {
          if (!step1FakeName || !step1FakeName.trim()) {
            newErrors.push('Step 1 fake name is required')
          }
        }
        if (canEditStep2 && currentProcessType.name === 'Step2') {
          if (!step2FakeName || !step2FakeName.trim()) {
            newErrors.push('Step 2 fake name is required')
          }
        }
      } else {
        // Create mode or admin - validate fake names based on process type
        if (currentProcessType.name === 'Step1' || currentProcessType.name === 'Single Seat') {
          if (!step1FakeName || !step1FakeName.trim()) {
            newErrors.push('Step 1 fake name is required')
          }
        }
        if (currentProcessType.name === 'Step2') {
          if (!step2FakeName || !step2FakeName.trim()) {
            newErrors.push('Step 2 fake name is required')
          }
        }
      }
      
      // Then validate dates
      // In edit mode for employees, only validate steps they can actually edit
      if (isEditMode && !canAssignToOthers) {
        // Employee editing - validate based on edit permissions
        if (canEditStep1 && (currentProcessType.name === 'Step1' || currentProcessType.name === 'Single Seat')) {
          if (!step1StartTime) {
            newErrors.push('Step 1 Start Date is required')
          }
          if (!step1EndTime) {
            newErrors.push('Step 1 End Date is required')
          }
        }
        if (canEditStep2) {
          // If they can edit step 2, require step 2 dates
          if (!step2StartTime) {
            newErrors.push('Step 2 Start Date is required')
          }
          if (!step2EndTime) {
            newErrors.push('Step 2 End Date is required')
          }
        }
      } else {
        // Create mode or admin - validate based on process type
        if (currentProcessType.name === 'Step1' || currentProcessType.name === 'Single Seat') {
          if (!step1StartTime) {
            newErrors.push('Step 1 Start Date is required')
          }
          if (!step1EndTime) {
            newErrors.push('Step 1 End Date is required')
          }
        }
        if (currentProcessType.name === 'Step2') {
          if (!step2StartTime) {
            newErrors.push('Step 2 Start Date is required')
          }
          if (!step2EndTime) {
            newErrors.push('Step 2 End Date is required')
          }
        }
      }
    }
    
    // Show validation errors as toast notifications
    if (newErrors.length > 0) {
      toast.error(newErrors.join('\n'))
    }
    
    return newErrors.length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setSubmitting(true)
    
    try {
      const selectedProcessType = processTypes?.find(p => p.id === selectedProcessTypeId)
      
      // For employees editing existing orders, only send step-related fields
      // This prevents sending order details that they can't modify
      const isEmployeeEditingExisting = isEditMode && order && !canAssignToOthers
      
      let orderData: OrderCreate | OrderUpdate
      
      if (isEmployeeEditingExisting) {
        // Employee editing existing order - only send step fields they CAN edit
        orderData = {} as OrderUpdate
        
        // Send Step 1 data if employee can edit it and has entered data
        if (canEditStep1 && step1StartTime && step1EndTime) {
          orderData.step1UserId = user!.id
          if (step1FakeName) orderData.step1FakeName = step1FakeName
          orderData.step1StartTime = step1StartTime
          orderData.step1EndTime = step1EndTime
        }
        
        // Send Step 2 data if employee can edit it and has entered data
        if (canEditStep2 && step2StartTime && step2EndTime) {
          orderData.step2UserId = user!.id
          if (step2FakeName) orderData.step2FakeName = step2FakeName
          orderData.step2StartTime = step2StartTime
          orderData.step2EndTime = step2EndTime
        }
      } else {
        // Admin/Team Lead OR new order creation - send all fields
        orderData = {
          fileNumber: fileNumber.trim(),
          entryDate,
          transactionTypeId: selectedTransactionTypeId!,
          processTypeId: selectedProcessTypeId!,
          orderStatusId: selectedOrderStatusId!,
          divisionId: selectedDivisionId!,
          state: selectedState,
          county: county.trim(),
          productType: selectedProductType,
          teamId: selectedTeamId!,
          orgId: effectiveOrgId || user?.orgId || 0,
        }
        
        // Determine step user assignment
        if (canAssignToOthers) {
          // Admin/Team Lead - auto-assign to themselves since Assign User dropdown was removed
          if (selectedProcessType?.name === 'Step1') {
            orderData.step1UserId = user!.id
            if (step1FakeName) orderData.step1FakeName = step1FakeName
            if (step1StartTime) orderData.step1StartTime = step1StartTime
            if (step1EndTime) orderData.step1EndTime = step1EndTime
          }
          
          if (selectedProcessType?.name === 'Step2') {
            orderData.step2UserId = user!.id
            if (step2FakeName) orderData.step2FakeName = step2FakeName
            if (step2StartTime) orderData.step2StartTime = step2StartTime
            if (step2EndTime) orderData.step2EndTime = step2EndTime
          }
          
          if (selectedProcessType?.name === 'Single Seat') {
            // For single seat, both step1 and step2 use same user (current user), fake name, and same dates
            orderData.step1UserId = user!.id
            orderData.step2UserId = user!.id
            if (step1FakeName) {
              orderData.step1FakeName = step1FakeName
              orderData.step2FakeName = step1FakeName
            }
            if (step1StartTime) {
              orderData.step1StartTime = step1StartTime
              orderData.step2StartTime = step1StartTime
            }
            if (step1EndTime) {
              orderData.step1EndTime = step1EndTime
              orderData.step2EndTime = step1EndTime
            }
          }
        } else {
          // Employee entering their own work (new order) - auto-assign to themselves
          if (selectedProcessType?.name === 'Step1') {
            orderData.step1UserId = user!.id
            if (step1FakeName) orderData.step1FakeName = step1FakeName
            if (step1StartTime) orderData.step1StartTime = step1StartTime
            if (step1EndTime) orderData.step1EndTime = step1EndTime
          }
          
          if (selectedProcessType?.name === 'Step2') {
            orderData.step2UserId = user!.id
            if (step2FakeName) orderData.step2FakeName = step2FakeName
            if (step2StartTime) orderData.step2StartTime = step2StartTime
            if (step2EndTime) orderData.step2EndTime = step2EndTime
          }
          
          if (selectedProcessType?.name === 'Single Seat') {
            // Single seat - assign both steps to themselves
            orderData.step1UserId = user!.id
            orderData.step2UserId = user!.id
            if (step1FakeName) {
              orderData.step1FakeName = step1FakeName
              orderData.step2FakeName = step1FakeName
            }
            if (step1StartTime) {
              orderData.step1StartTime = step1StartTime
              orderData.step2StartTime = step1StartTime
            }
            if (step1EndTime) {
              orderData.step1EndTime = step1EndTime
              orderData.step2EndTime = step1EndTime
            }
          }
        }
      }
      
      if (isEditMode && order) {
        // Update existing order
        await ordersApi.update(order.id, orderData as OrderUpdate)
        toast.success('Order updated successfully!')
      } else {
        // Create new order (or update existing if adding Step 1 or Step 2)
        await ordersApi.create(orderData as OrderCreate)
        
        // Show appropriate message
        if (fileNumberExists && canAddStep2) {
          toast.success('Step 2 added to existing order!')
        } else if (fileNumberExists && canAddStep1) {
          toast.success('Step 1 added to existing order!')
        } else {
          toast.success('Order created successfully!')
        }
        
        // Reset form completely to fresh state (like a new order page)
        setSelectedTeamId(null)
        setFileNumber('')
        setEntryDate(new Date().toISOString().split('T')[0])
        setSelectedState('')
        setCounty('')
        setSelectedProductType('')
        setSelectedTransactionTypeId(null)
        setStep1UserId(null)
        setStep1StartTime('')
        setStep1EndTime('')
        setStep2UserId(null)
        setStep2StartTime('')
        setStep2EndTime('')
        setFileNumberExists(false)
        setCanAddStep2(false)
        setCanAddStep1(false)
        
        // Reset to default values
        const defaultProcess = processTypes?.find(p => p.isActive)
        if (defaultProcess) {
          setSelectedProcessTypeId(defaultProcess.id)
        } else {
          setSelectedProcessTypeId(null)
        }
        
        const activeStatus = orderStatuses?.find(s => s.isActive)
        if (activeStatus) {
          setSelectedOrderStatusId(activeStatus.id)
        } else {
          setSelectedOrderStatusId(null)
        }
        
        if (divisions?.length) {
          setSelectedDivisionId(divisions[0].id)
        } else {
          setSelectedDivisionId(null)
        }
      }
      
      onSuccess?.()
    } catch (error: any) {
      console.error('Order submission error:', error)
      console.error('Error response:', error.response)
      console.error('Error response data:', error.response?.data)
      
      let errorMsg = isEditMode ? 'Failed to update order' : 'Failed to create order'
      
      // Field name to user-friendly label mapping
      const fieldLabels: Record<string, string> = {
        'file_number': 'File Number',
        'fileNumber': 'File Number',
        'entry_date': 'Entry Date',
        'entryDate': 'Entry Date',
        'state': 'State (use 2-5 letter code like CA, TX)',
        'county': 'County',
        'product_type': 'Product Type',
        'productType': 'Product Type',
        'transaction_type_id': 'Transaction Type',
        'transactionTypeId': 'Transaction Type',
        'process_type_id': 'Process Type',
        'processTypeId': 'Process Type',
        'order_status_id': 'Order Status',
        'orderStatusId': 'Order Status',
        'division_id': 'Division',
        'divisionId': 'Division',
        'team_id': 'Team',
        'teamId': 'Team',
        'step1_start_time': 'Step 1 Start Time',
        'step1StartTime': 'Step 1 Start Time',
        'step1_end_time': 'Step 1 End Time',
        'step1EndTime': 'Step 1 End Time',
        'step2_start_time': 'Step 2 Start Time',
        'step2StartTime': 'Step 2 Start Time',
        'step2_end_time': 'Step 2 End Time',
        'step2EndTime': 'Step 2 End Time',
      }
      
      // Try to extract error message from various response formats
      if (error.response) {
        // Server responded with an error status
        const data = error.response.data
        console.log('Response data type:', typeof data, data)
        
        if (data) {
          if (typeof data.detail === 'string') {
            errorMsg = data.detail
          } else if (Array.isArray(data.detail)) {
            // Pydantic validation errors come as array
            const errorMessages = data.detail.map((err: any) => {
              // Extract field name from loc array (e.g., ["body", "state"] -> "state")
              const fieldName = err.loc?.slice(-1)[0] || ''
              const friendlyFieldName = fieldLabels[fieldName] || fieldName
              const message = err.msg || err.message || 'Invalid value'
              
              if (friendlyFieldName) {
                return `${friendlyFieldName}: ${message}`
              }
              return message
            })
            errorMsg = errorMessages.join('\n')
          } else if (typeof data.message === 'string') {
            errorMsg = data.message
          } else if (typeof data.error === 'string') {
            errorMsg = data.error
          } else if (typeof data === 'string') {
            errorMsg = data
          }
        }
      } else if (error.request) {
        // Request was made but no response received (network error, CORS, server down)
        errorMsg = 'Unable to reach the server. Please check your connection and try again.'
      } else if (error.message) {
        // Something else happened while setting up the request
        errorMsg = error.message
      }
      
      // Show error as toast notification
      toast.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const isLoading = loadingTeams || loadingTransactionTypes || loadingProcessTypes || loadingOrderStatuses || loadingDivisions

  const selectedProcessType = processTypes?.find(p => p.id === selectedProcessTypeId)
  const showStep1Fields = selectedProcessType?.name === 'Step1' || selectedProcessType?.name === 'Single Seat'
  const showStep2Fields = selectedProcessType?.name === 'Step2' || selectedProcessType?.name === 'Single Seat'
  
  // In edit mode, also show step fields based on edit permissions (e.g., employee adding Step 2 to Step1 order)
  const showStep1Section = showStep1Fields || (isEditMode && canEditStep1)
  const showStep2Section = showStep2Fields || (isEditMode && canEditStep2)
  
  // Disable other fields until team is selected (for new orders)
  const teamNotSelected = !isEditMode && !selectedTeamId

  // Filter process types - if file exists and can add Step 2 or Step 1, only show that type
  const availableProcessTypes = useMemo(() => {
    if (!processTypes) return []
    
    const activeTypes = processTypes.filter(p => p.isActive)
    
    // In edit mode, show all active types
    if (isEditMode) {
      return activeTypes
    }
    
    // If file exists and can add Step 2, only show Step2
    if (fileNumberExists && canAddStep2) {
      return activeTypes.filter(p => p.name === 'Step2')
    }
    
    // If file exists and can add Step 1, only show Step1
    if (fileNumberExists && canAddStep1) {
      return activeTypes.filter(p => p.name === 'Step1')
    }
    
    // Otherwise show all active types
    return activeTypes
  }, [processTypes, fileNumberExists, canAddStep2, canAddStep1, isEditMode])

  // Check if form is valid for save button
  const isFormValid = useMemo(() => {
    // Basic required fields
    if (!selectedTeamId) return false
    if (!fileNumber.trim()) return false
    if (!selectedState) return false
    if (!county.trim()) return false
    if (!selectedProductType) return false
    if (!selectedTransactionTypeId) return false
    if (!selectedProcessTypeId) return false
    if (!selectedDivisionId) return false
    
    // Block if file exists but can't add Step 1 or Step 2
    if (!isEditMode && fileNumberExists && !canAddStep2 && !canAddStep1) return false
    
    // Superadmin must select an organization
    if (user?.userRole === 'superadmin' && !selectedOrgId) return false
    
    // Order status is required for all users
    if (!selectedOrderStatusId) return false
    
    const currentProcessType = processTypes?.find(p => p.id === selectedProcessTypeId)
    
    // Step validation based on process type and user role
    if (isEditMode && !canAssignToOthers) {
      // Employee editing - validate based on edit permissions
      if (canEditStep1 && (currentProcessType?.name === 'Step1' || currentProcessType?.name === 'Single Seat')) {
        if (!step1StartTime || !step1EndTime) return false
        if (!step1FakeName || !step1FakeName.trim()) return false
      }
      if (canEditStep2) {
        if (!step2StartTime || !step2EndTime) return false
        if (!step2FakeName || !step2FakeName.trim()) return false
      }
    } else {
      // Create mode or admin - validate based on process type
      if (currentProcessType?.name === 'Step1' || currentProcessType?.name === 'Single Seat') {
        if (!step1StartTime || !step1EndTime) return false
        if (!step1FakeName || !step1FakeName.trim()) return false
      }
      
      if (currentProcessType?.name === 'Step2') {
        if (!step2StartTime || !step2EndTime) return false
        if (!step2FakeName || !step2FakeName.trim()) return false
      }
    }
    
    return true
  }, [
    selectedTeamId, fileNumber, selectedState, county, selectedProductType,
    selectedTransactionTypeId, selectedProcessTypeId, selectedOrderStatusId,
    selectedDivisionId, selectedOrgId, step1StartTime, step1EndTime,
    step2StartTime, step2EndTime, step1FakeName, step2FakeName, canAssignToOthers,
    processTypes, user?.userRole, isEditMode, canEditStep1, canEditStep2,
    fileNumberExists, canAddStep2, canAddStep1
  ])

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      {isLoading ? (
        <Card className="h-full flex items-center justify-center border-gray-200">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="h-full flex flex-col">
          {/* Main Content - Two Column Layout */}
          <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden min-h-0">
            
            {/* LEFT COLUMN: Order Details */}
            <div className="border border-gray-200 rounded-md p-4 bg-white flex flex-col shadow-sm overflow-hidden">
              <h3 className="text-sm font-semibold border-b border-gray-200 pb-2 mb-4 text-gray-800">Order Details</h3>
              
              <div className="flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {/* Edit Permissions Banner */}
                {isEditMode && editPermissions && !canAssignToOthers && (
                  <div className={`rounded-md p-2.5 ${editPermissions.canEdit ? 'bg-blue-50 border border-blue-200' : 'bg-gray-100 border border-gray-300'}`}>
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
                      <div>
                        <p className="font-medium text-xs text-gray-800">
                          {editPermissions.canEdit ? 'Edit Mode' : 'View Only'}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">{editPermissions.reason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Organization - superadmin only */}
                {user?.userRole === 'superadmin' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="organization" className="text-xs font-semibold text-gray-700">Organization *</Label>
                    <Select
                      value={selectedOrgId ? selectedOrgId.toString() : undefined}
                      onValueChange={(value) => setSelectedOrgId(parseInt(value))}
                      disabled={loadingOrganizations}
                    >
                      <SelectTrigger className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder={loadingOrganizations ? "Loading..." : "Select organization"} />
                      </SelectTrigger>
                      <SelectContent>
                        {organizationsData?.items?.map((org) => (
                          <SelectItem key={org.id} value={org.id.toString()}>{org.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Team */}
                {availableTeams.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="team" className="text-xs font-semibold text-gray-700">Team *</Label>
                    <Select
                      value={selectedTeamId ? selectedTeamId.toString() : undefined}
                      onValueChange={(value) => setSelectedTeamId(parseInt(value))}
                      disabled={loadingTeams || !canEditOrderDetails}
                    >
                      <SelectTrigger className={`h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${!canEditOrderDetails ? 'bg-gray-50' : ''}`}>
                        <SelectValue placeholder={loadingTeams ? "Loading..." : "Select team"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTeams.map((team) => (
                          <SelectItem key={team.id} value={team.id.toString()}>{team.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* No teams message */}
                {!loadingTeams && availableTeams.length === 0 && (user?.userRole !== 'superadmin' || selectedOrgId) && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-xs text-yellow-800 font-medium">
                      {isAdminOrSuperadmin ? "No teams found in this organization" : "You are not assigned to any active teams"}
                    </p>
                  </div>
                )}

                {/* File Number & Division */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fileNumber" className="text-xs font-semibold text-gray-700">File Number *</Label>
                    <div className="relative">
                      <Input
                        id="fileNumber"
                        placeholder={teamNotSelected ? "Select team first" : "Enter file number"}
                        value={fileNumber}
                        onChange={(e) => {
                          setFileNumber(e.target.value)
                          // Reset check state when typing
                          setFileNumberExists(false)
                          setCanAddStep2(false)
                          setCanAddStep1(false)
                          setExistingOrderId(null)
                        }}
                        onBlur={handleFileNumberBlur}
                        disabled={isEditMode || teamNotSelected}
                        className={`h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${(isEditMode || teamNotSelected) ? 'bg-gray-50' : ''}`}
                      />
                      {isCheckingFileNumber && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="division" className="text-xs font-semibold text-gray-700">Division *</Label>
                    <Select
                      value={selectedDivisionId ? selectedDivisionId.toString() : undefined}
                      onValueChange={(value) => setSelectedDivisionId(parseInt(value))}
                      disabled={!canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1}
                    >
                      <SelectTrigger className={`h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${(!canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1) ? 'bg-gray-50' : ''}`}>
                        <SelectValue placeholder={teamNotSelected ? "Select team first" : "Select division"} />
                      </SelectTrigger>
                      <SelectContent>
                        {divisions?.map((division) => (
                          <SelectItem key={division.id} value={division.id.toString()}>{division.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* State & County */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="state" className="text-xs font-semibold text-gray-700">State *</Label>
                    <Select
                      value={selectedState || undefined}
                      onValueChange={setSelectedState}
                      disabled={loadingTeamDetails || !canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1}
                    >
                      <SelectTrigger className={`h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${(!canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1) ? 'bg-gray-50' : ''}`}>
                        <SelectValue placeholder={teamNotSelected ? "Select team first" : (loadingTeamDetails ? "Loading..." : "Select state")} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStates.map((state) => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="county" className="text-xs font-semibold text-gray-700">County *</Label>
                    <Input
                      id="county"
                      placeholder={teamNotSelected ? "Select team first" : "Enter county"}
                      value={county}
                      onChange={(e) => setCounty(e.target.value)}
                      disabled={!canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1}
                      className={`h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${(!canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1) ? 'bg-gray-50' : ''}`}
                    />
                  </div>
                </div>

                {/* Product Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="productType" className="text-xs font-semibold text-gray-700">Product Type *</Label>
                  <Select
                    value={selectedProductType || undefined}
                    onValueChange={handleProductTypeChange}
                    disabled={loadingTeamDetails || !canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1}
                  >
                    <SelectTrigger className={`h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${(!canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1) ? 'bg-gray-50' : ''}`}>
                      <SelectValue placeholder={teamNotSelected ? "Select team first" : (loadingTeamDetails ? "Loading..." : "Select product type")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((product) => (
                        <SelectItem key={product} value={product}>{product}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Transaction Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="transactionType" className="text-xs font-semibold text-gray-700">Transaction Type *</Label>
                  <Select
                    value={selectedTransactionTypeId ? selectedTransactionTypeId.toString() : undefined}
                    onValueChange={(value) => setSelectedTransactionTypeId(parseInt(value))}
                    disabled={!canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1}
                  >
                    <SelectTrigger className={`h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${(!canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1) ? 'bg-gray-50' : ''}`}>
                      <SelectValue placeholder={teamNotSelected ? "Select team first" : "Select transaction type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {transactionTypes?.filter(t => t.isActive).map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Work Assignment */}
            <div className="border border-gray-200 rounded-md p-4 bg-white flex flex-col shadow-sm overflow-hidden">
              <h3 className="text-sm font-semibold border-b border-gray-200 pb-2 mb-4 text-gray-800">
                Work Assignment
              </h3>

              <div className="flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {!teamNotSelected && (
                  <>
                    {/* Process Type */}
                    <div className="space-y-1.5">
                      <Label htmlFor="processType" className="text-xs font-semibold text-gray-700">Process Type *</Label>
                      <Select
                        value={selectedProcessTypeId ? selectedProcessTypeId.toString() : undefined}
                        onValueChange={(value) => setSelectedProcessTypeId(parseInt(value))}
                        disabled={!canEditOrderDetails || teamNotSelected || availableProcessTypes.length === 0 || canAddStep2 || canAddStep1}
                      >
                        <SelectTrigger className={`h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${(!canEditOrderDetails || teamNotSelected || availableProcessTypes.length === 0 || canAddStep2 || canAddStep1) ? 'bg-gray-50' : ''}`}>
                          <SelectValue placeholder={teamNotSelected ? "Select team first" : (availableProcessTypes.length === 0 ? "No process available" : "Select process type")} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProcessTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>{type.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Order Status */}
                    <div className="space-y-1.5">
                      <Label htmlFor="orderStatus" className="text-xs font-semibold text-gray-700">Order Status *</Label>
                      <Select
                        value={selectedOrderStatusId ? selectedOrderStatusId.toString() : undefined}
                        onValueChange={(value) => setSelectedOrderStatusId(parseInt(value))}
                        disabled={!canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1}
                      >
                        <SelectTrigger className={`h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${(!canEditOrderDetails || teamNotSelected || canAddStep2 || canAddStep1) ? 'bg-gray-50' : ''}`}>
                          <SelectValue placeholder={teamNotSelected ? "Select team first" : "Select status"} />
                        </SelectTrigger>
                        <SelectContent>
                          {orderStatuses?.filter(s => s.isActive).map((status) => (
                            <SelectItem key={status.id} value={status.id.toString()}>{status.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Step Assignment */}
                {!teamNotSelected && (
                  <div className="space-y-3">
                    {/* Step 1 */}
                    {showStep1Section && (
                      <div className="border border-gray-200 rounded-md p-3.5 bg-gray-50">
                        <div className="text-xs font-semibold text-gray-800 mb-3">
                          {selectedProcessType?.name === 'Single Seat' ? 'Single Seat' : 'Step 1'}
                        </div>

                        {/* Fake Name Selection - everyone needs this */}
                        {(canAssignToOthers || canEditStep1) && (
                          <div className="mb-3">
                            <Label className="text-xs font-medium text-gray-700 mb-1.5 block">Fake Name *</Label>
                            <Select
                              value={step1FakeName || undefined}
                              onValueChange={(value) => setStep1FakeName(value)}
                            >
                              <SelectTrigger className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white">
                                <SelectValue placeholder={loadingFakeNames ? "Loading..." : "Select fake name"} />
                              </SelectTrigger>
                              <SelectContent>
                                {faNames.map((fn) => (
                                  <SelectItem key={fn.id} value={fn.faName}>
                                    {fn.faName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Read-only Step 1 info for employees */}
                        {!canAssignToOthers && isEditMode && order?.step1 && !canEditStep1 && (
                          <div className="text-xs text-gray-600 mb-3">
                            <span className="font-medium">{order.step1.userName || order.step1.userName}</span>
                          </div>
                        )}

                        {/* Date Inputs */}
                        {(canAssignToOthers || (canEditStep1 && !isEditMode) || (canEditStep1 && isEditMode)) && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">Start Date *</Label>
                              <Input
                                type="date"
                                value={step1StartTime}
                                onChange={(e) => setStep1StartTime(e.target.value)}
                                className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">End Date *</Label>
                              <Input
                                type="date"
                                value={step1EndTime}
                                onChange={(e) => setStep1EndTime(e.target.value)}
                                className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step 2 */}
                    {showStep2Section && selectedProcessType?.name !== 'Single Seat' && (
                      <div className="border border-gray-200 rounded-md p-3.5 bg-gray-50">
                        <div className="text-xs font-semibold text-gray-800 mb-3">Step 2</div>

                        {/* Fake Name Selection - everyone needs this */}
                        {(canAssignToOthers || canEditStep2) && (
                          <div className="mb-3">
                            <Label className="text-xs font-medium text-gray-700 mb-1.5 block">Fake Name *</Label>
                            <Select
                              value={step2FakeName || undefined}
                              onValueChange={(value) => setStep2FakeName(value)}
                            >
                              <SelectTrigger className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-white">
                                <SelectValue placeholder={loadingFakeNames ? "Loading..." : "Select fake name"} />
                              </SelectTrigger>
                              <SelectContent>
                                {faNames.map((fn) => (
                                  <SelectItem key={fn.id} value={fn.faName}>
                                    {fn.faName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Read-only Step 2 info for employees */}
                        {!canAssignToOthers && isEditMode && order?.step2 && !canEditStep2 && (
                          <div className="text-xs text-gray-600 mb-3">
                            <span className="font-medium">{order.step2.userName || order.step2.userName}</span>
                          </div>
                        )}

                        {/* Date Inputs */}
                        {(canAssignToOthers || (canEditStep2 && !isEditMode) || (canEditStep2 && isEditMode)) && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">Start Date *</Label>
                              <Input
                                type="date"
                                value={step2StartTime}
                                onChange={(e) => setStep2StartTime(e.target.value)}
                                className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">End Date *</Label>
                              <Input
                                type="date"
                                value={step2EndTime}
                                onChange={(e) => setStep2EndTime(e.target.value)}
                                className="h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Placeholder when team not selected */}
                {teamNotSelected && (
                  <div className="flex items-center justify-center h-full min-h-[200px] text-gray-400">
                    <div className="text-center">
                      <Info className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium text-gray-500">Select a team to begin</p>
                      <p className="text-xs text-gray-400 mt-1">Choose a team from the left to configure order details</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-4 flex-shrink-0">
            <Button 
              type="submit" 
              disabled={submitting || !isFormValid} 
              className="w-full h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? 'Updating Order...' : 'Saving Order...'}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEditMode ? 'Update Order' : 'Save Order'}
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

export default OrderForm
