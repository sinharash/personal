//use-deprovision-resource.ts
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEntity } from '@backstage/plugin-catalog-react'
import { useQuery } from '@tanstack/react-query'
import {
  MutationDeprovisionApplicationServiceArgs,
  useDeprovisionApplicationServiceMutation,
} from '@gpd-hub-plugin/cloud-experience-common'
import { useNotify } from '../../../v1/hooks/use-notify'
import logger from '../../../v1/utils/logger'
import { useApplicationServiceQueryOptions } from '../../../v1/features/service-offering/api/application-service-queryoptions'
import { useBusinessApplicationQueryOptions } from '../../../v1/features/business-app/api/queryoptions.business-application'
import { createPermissionChecker } from '../../../v1/utils/permissions'

/**
 * Hook to handle MERNA resource deprovisioning
 * 
 * This hook does everything:
 * 1. Gets entity data from Backstage (useEntity)
 * 2. Fetches businessApplication for PERMISSIONS (isOwner)
 * 3. Fetches applicationService for STATUS (canDeprovision)
 * 4. Handles the deprovision mutation
 * 
 * NO CONTEXT/PROVIDER NEEDED - just wrap with QueryClientProvider
 * 
 * Usage:
 * <DeleteCardWrapper>  // provides QueryClientProvider
 *   <ExampleDeleteCard />  // uses this hook
 * </DeleteCardWrapper>
 */
export function useDeprovisionResource() {
  const navigate = useNavigate()
  const { notify } = useNotify()
  const { entity } = useEntity()

  // Get query options hooks
  const applicationServiceQueryOptions = useApplicationServiceQueryOptions()
  const businessAppQueryOptions = useBusinessApplicationQueryOptions()

  // =========================================================================
  // EXTRACT DATA FROM ENTITY
  // =========================================================================
  const businessAppId = entity.metadata?.annotations?.['hub.merna.sf/business-app-id'] || ''
  const name = entity.metadata?.title || entity.metadata?.name || ''
  const envLabel = entity.metadata?.labels?.['hub.merna.sf/environment'] || ''
  const environment = envLabel.toUpperCase()
  const tags = entity.metadata?.tags || []
  const resourceTag = tags[0]?.toUpperCase() || 'SERVICE'

  // =========================================================================
  // QUERY 1: Fetch businessApplication for PERMISSIONS
  // =========================================================================
  const { data: businessAppData, isLoading: isBusinessAppLoading } = useQuery(
    businessAppQueryOptions({ id: businessAppId })
  )

  // =========================================================================
  // QUERY 2: Fetch applicationService for STATUS
  // =========================================================================
  const { data: appServiceData, isLoading: isAppServiceLoading } = useQuery(
    applicationServiceQueryOptions({
      businessApplicationId: businessAppId,
      name: name,
      environment: environment as any,
    })
  )

  // =========================================================================
  // EXTRACT DATA FROM QUERIES
  // =========================================================================
  const businessApplication = businessAppData?.data?.businessApplication
  const applicationService = appServiceData?.data?.applicationService
  const status = applicationService?.status || ''

  // Get permissions from businessApplication (not applicationService!)
  const permissionLevels = businessApplication?.permissionLevels || []
  const permissions = createPermissionChecker(permissionLevels)
  const isOwner = permissions.hasRole('OWNER')

  // =========================================================================
  // COMPUTE STATUS FLAGS
  // =========================================================================
  const isBeingDeprovisioned = status === 'DEPROVISIONED' || status === 'PROVISIONING'
  const allowedStatus = status === 'PROVISIONED' || status === 'ERROR' || status === 'PROVISIONING'
  const canDeprovision = !!businessAppId && !isBeingDeprovisioned && allowedStatus

  const isLoading = isBusinessAppLoading || isAppServiceLoading

  // =========================================================================
  // MUTATION
  // =========================================================================
  const deprovisionMutation = useDeprovisionApplicationServiceMutation()

  /**
   * Execute deprovision mutation
   */
  const handleDeprovision = useCallback(async (): Promise<void> => {
    const variables: MutationDeprovisionApplicationServiceArgs = {
      businessApplicationId: businessAppId,
      environment: environment as any,
      name: name,
    }

    try {
      const { errors } = await deprovisionMutation.mutateAsync(variables)

      if (errors) {
        for (const error of errors) {
          const reasons = Array.isArray(error.reason) ? error.reason.flat() : [error.reason]
          for (const reason of reasons) {
            notify({ severity: 'error', error: new Error(reason) })
          }
        }
        return
      }

      notify({ message: 'Resource scheduled for deletion 🗑️' })
    } catch (error) {
      logger.error('[Delete resource error]', error)
      notify({ severity: 'error', error: new Error('Failed to delete resource') })
    } finally {
      setTimeout(() => {
        navigate('/catalog')
      }, 1000)
    }
  }, [businessAppId, environment, name, deprovisionMutation, notify, navigate])

  // =========================================================================
  // RETURN
  // =========================================================================
  return {
    name,
    resourceTag,
    handleDeprovision,
    isDeleting: deprovisionMutation.isPending,
    isBeingDeprovisioned,
    canDeprovision,
    isOwner,
    isLoading,
  }
}


>>>>>>>>>>>
// delete-card-wrapper.tsx

import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * QueryClient configuration
 * 
 * staleTime: 5 * 60 * 1000 = 300,000ms = 5 minutes
 *   - Data is considered "fresh" for 5 minutes
 *   - During this time, React Query uses cached data without refetching
 *   - After 5 minutes, data becomes "stale" and will refetch on next access
 * 
 * retry: 1
 *   - If API call fails, try 1 more time before showing error
 *   - Total attempts = 2 (original + 1 retry)
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

interface DeleteCardWrapperProps {
  children: ReactNode
}

/**
 * Simple wrapper that provides QueryClientProvider
 * 
 * This is all you need! No custom context required.
 * 
 * Usage in EntityPage:
 * <DeleteCardWrapper>
 *   <ExampleDeleteCard />
 * </DeleteCardWrapper>
 */
export function DeleteCardWrapper({ children }: DeleteCardWrapperProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

export default DeleteCardWrapper



>>>>>

// delete-card.tsx

import { useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import { useTheme, alpha } from '@mui/material/styles'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import BlockIcon from '@mui/icons-material/Block'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { DeprovisionModal } from './deprovision-modal'
import { useDeprovisionResource } from '../../hooks/use-deprovision-resource'
import {
  canUserDelete,
  getCapabilityDeletionDescription,
  getDeleteStatusInfo,
  StatusIconType,
} from '../../utils/deprovision-helpers'

/**
 * Helper to render icon based on icon type from utility
 */
function getStatusIcon(iconType: StatusIconType) {
  switch (iconType) {
    case 'lock':
      return <LockOutlinedIcon fontSize="small" />
    case 'block':
      return <BlockIcon fontSize="small" />
  }
}

/**
 * Delete card component
 * 
 * Requirements:
 * 1. Must be inside EntityPage (uses useEntity internally)
 * 2. Must be wrapped with DeleteCardWrapper (provides QueryClient)
 * 
 * Usage:
 * <DeleteCardWrapper>
 *   <ExampleDeleteCard />
 * </DeleteCardWrapper>
 */
export function ExampleDeleteCard() {
  const theme = useTheme()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const {
    name,
    resourceTag,
    handleDeprovision,
    isDeleting,
    canDeprovision,
    isOwner,
    isLoading,
  } = useDeprovisionResource()

  // Use utility functions
  const canDelete = canUserDelete(isOwner, canDeprovision)
  const statusInfo = getDeleteStatusInfo(isOwner, canDeprovision)
  const additionalDescription = getCapabilityDeletionDescription(resourceTag)

  const handleOpenModal = () => {
    if (canDelete) {
      setIsModalOpen(true)
    }
  }

  const handleCloseModal = () => {
    if (!isDeleting) {
      setIsModalOpen(false)
    }
  }

  const handleConfirmDelete = async () => {
    await handleDeprovision()
    setIsModalOpen(false)
  }

  // Show loading state
  if (isLoading) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography color="text.secondary">Loading...</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          borderColor: canDelete
            ? alpha(theme.palette.error.main, 0.3)
            : theme.palette.divider,
          transition: 'all 0.2s ease-in-out',
          '&:hover': canDelete
            ? {
                borderColor: theme.palette.error.main,
                boxShadow: `0 0 0 1px ${alpha(theme.palette.error.main, 0.2)}`,
              }
            : {},
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography variant="h5" fontWeight="bold" color="error">
                  Danger Zone
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Permanently delete this {resourceTag.toLowerCase()}
                </Typography>
              </Box>

              {statusInfo ? (
                <Tooltip title={statusInfo.tooltip} arrow>
                  <Chip
                    icon={getStatusIcon(statusInfo.iconType)}
                    label={statusInfo.label}
                    color={statusInfo.color}
                    size="small"
                    variant="outlined"
                  />
                </Tooltip>
              ) : (
                <Tooltip title={`Delete ${name}`} arrow>
                  <IconButton
                    onClick={handleOpenModal}
                    disabled={!canDelete || isDeleting}
                    sx={{
                      color: theme.palette.error.main,
                      backgroundColor: alpha(theme.palette.error.main, 0.08),
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.error.main, 0.16),
                      },
                      '&.Mui-disabled': {
                        color: theme.palette.action.disabled,
                        backgroundColor: theme.palette.action.disabledBackground,
                      },
                    }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            {!isOwner && (
              <Typography variant="caption" color="text.secondary">
                You must be an owner of this resource to delete it.
              </Typography>
            )}

            {isOwner && !canDeprovision && (
              <Typography variant="caption" color="text.secondary">
                This resource cannot be deleted in its current state.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      <DeprovisionModal
        name={name}
        resourceTag={resourceTag}
        open={isModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        additionalDescription={additionalDescription}
      />
    </>
  )
}

export default ExampleDeleteCard