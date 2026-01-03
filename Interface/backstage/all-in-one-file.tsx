// Create new file: v2/hooks/merna-resource-provider.tsx

import { createContext, useContext, ReactNode } from 'react'
import { useEntity } from '@backstage/plugin-catalog-react'
import { useQuery } from '@tanstack/react-query'
import { useApplicationServiceQueryOptions } from '../../v1/features/service-offering/api/application-service-queryoptions'
import { createPermissionChecker } from '../../v1/utils/permissions'

// Define the shape of our context data
interface MernaResourceContextType {
  // Entity data
  name: string
  resourceTag: string
  environment: string
  businessAppId: string
  
  // Application service data
  applicationService: any | null
  status: string
  isLoading: boolean
  
  // Permissions
  permissions: ReturnType<typeof createPermissionChecker>
  isOwner: boolean
  
  // Computed flags
  isBeingDeprovisioned: boolean
  canDeprovision: boolean
}

// Create the context with null default
const MernaResourceContext = createContext<MernaResourceContextType | null>(null)

// Hook to use the context
export function useMernaResourceContext() {
  const context = useContext(MernaResourceContext)
  if (!context) {
    throw new Error('useMernaResourceContext must be used within a MernaResourceProvider')
  }
  return context
}

// Provider component
interface MernaResourceProviderProps {
  children: ReactNode
}

export function MernaResourceProvider({ children }: MernaResourceProviderProps) {
  const { entity } = useEntity()
  const applicationServiceQueryOptions = useApplicationServiceQueryOptions()

  // Extract data from entity using YOUR annotation keys
  const businessAppId = entity.metadata?.annotations?.['hub.merna.sf/business-app-id'] || ''
  const name = entity.metadata?.title || entity.metadata?.name || ''
  const envLabel = entity.metadata?.labels?.['hub.merna.sf/environment'] || 'test'
  const environment = envLabel.toUpperCase()
  const tags = entity.metadata?.tags || []
  const resourceTag = tags[0]?.toUpperCase() || 'SERVICE'

  // Fetch application service data
  const { data: appServiceData, isLoading } = useQuery(
    applicationServiceQueryOptions({
      businessApplicationId: businessAppId,
      name: name,
      environment: environment as any,
    })
  )

  const applicationService = appServiceData?.data?.applicationService
  const status = applicationService?.status || ''

  // Get permissions from applicationService
  const permissionLevels = applicationService?.permissionLevels || []
  const permissions = createPermissionChecker(permissionLevels)
  const isOwner = permissions.hasRole('OWNER')

  // Compute status flags
  const isBeingDeprovisioned = status === 'DEPROVISIONED' || status === 'PROVISIONING'
  const allowedStatus = status === 'PROVISIONED' || status === 'ERROR'
  const canDeprovision = !!businessAppId && !isBeingDeprovisioned && allowedStatus && isOwner

  // Build context value
  const contextValue: MernaResourceContextType = {
    name,
    resourceTag,
    environment,
    businessAppId,
    applicationService,
    status,
    isLoading,
    permissions,
    isOwner,
    isBeingDeprovisioned,
    canDeprovision,
  }

  return (
    <MernaResourceContext.Provider value={contextValue}>
      {children}
    </MernaResourceContext.Provider>
  )
}

export { MernaResourceContext }

// Now simplify your use-deprovision-resource.ts:

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MutationDeprovisionApplicationServiceArgs,
  useDeprovisionApplicationServiceMutation,
} from '@gpd-hub-plugin/cloud-experience-common'
import { useNotify } from '../../../v1/hooks/use-notify'
import logger from '../../../v1/utils/logger'
import { useMernaResourceContext } from './merna-resource-provider'

/**
 * Hook to handle MERNA resource deprovisioning
 * Must be used within MernaResourceProvider
 */
export function useDeprovisionResource() {
  const {
    name,
    resourceTag,
    environment,
    businessAppId,
    isBeingDeprovisioned,
    canDeprovision,
    isOwner,
  } = useMernaResourceContext()

  const { notify } = useNotify()
  const navigate = useNavigate()
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
        navigate(-1)
      }, 1000)
    }
  }, [businessAppId, environment, name, deprovisionMutation, notify, navigate])

  return {
    name,
    resourceTag,
    handleDeprovision,
    isDeleting: deprovisionMutation.isPending,
    isBeingDeprovisioned,
    canDeprovision,
    isOwner,
  }
}

// Update your delete-card.tsx:

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

function getCapabilityDeletionDescription(resourceTag: string): string | undefined {
  switch (resourceTag.toLowerCase()) {
    case 'messaging':
      return 'All queue configurations will be deleted alongside the queue set.'
    case 'compute':
      return 'Ensure the deployment repository is empty before deleting the application.'
    default:
      return undefined
  }
}

/**
 * Delete card component - requires MernaResourceProvider above it
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
  } = useDeprovisionResource()

  // Combine permission check with status check
  const canDelete = canDeprovision && isOwner

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

  const additionalDescription = getCapabilityDeletionDescription(resourceTag)

  // Determine status info for chip display
  const getStatusInfo = () => {
    if (!isOwner) {
      return {
        label: 'Owner Only',
        color: 'default' as const,
        icon: <LockOutlinedIcon fontSize="small" />,
        tooltip: 'Only owners can delete this resource',
      }
    }
    if (!canDeprovision) {
      return {
        label: 'Cannot Delete',
        color: 'default' as const,
        icon: <BlockIcon fontSize="small" />,
        tooltip: 'This resource cannot be deleted in its current state',
      }
    }
    return null
  }

  const statusInfo = getStatusInfo()

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
                <Typography variant="subtitle1" fontWeight="bold" color="error">
                  Danger Zone
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Permanently delete this {resourceTag.toLowerCase()}
                </Typography>
              </Box>

              {statusInfo ? (
                <Tooltip title={statusInfo.tooltip} arrow>
                  <Chip
                    icon={statusInfo.icon}
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

// Update your resource-page-wrapper.tsx:

import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import { useTheme, alpha } from '@mui/material/styles'
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined'
import ScheduleIcon from '@mui/icons-material/Schedule'
import { MernaResourceProvider, useMernaResourceContext } from '../../hooks/merna-resource-provider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

/**
 * Deprovisioning status view
 */
function DeprovisioningStatusView() {
  const theme = useTheme()
  const { name } = useMernaResourceContext()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
        py: 6,
        px: 3,
      }}
    >
      <Box sx={{ position: 'relative', mb: 4 }}>
        <CloudOffOutlinedIcon
          sx={{
            fontSize: 120,
            color: alpha(theme.palette.text.secondary, 0.3),
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: -8,
            right: -8,
            backgroundColor: theme.palette.background.paper,
            borderRadius: '50%',
            p: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: theme.shadows[2],
          }}
        >
          <ScheduleIcon
            sx={{
              fontSize: 32,
              color: theme.palette.text.secondary,
            }}
          />
        </Box>
      </Box>

      <Stack spacing={1} alignItems="center">
        <Alert severity="info">
          <AlertTitle>App service is being deprovisioned</AlertTitle>
          This process may take a while.
        </Alert>

        {name && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
            Resource: {name}
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

/**
 * Content wrapper that checks deprovisioning status
 */
function ResourcePageWrapperContent({ children }: { children: ReactNode }) {
  const { isBeingDeprovisioned, isLoading } = useMernaResourceContext()

  if (isLoading) {
    return <Typography>Loading...</Typography>
  }

  if (isBeingDeprovisioned) {
    return <DeprovisioningStatusView />
  }

  return <>{children}</>
}

/**
 * Main wrapper component for MERNA resource pages
 */
interface ResourcePageWrapperProps {
  children: ReactNode
}

export function ResourcePageWrapper({ children }: ResourcePageWrapperProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MernaResourceProvider>
        <ResourcePageWrapperContent>{children}</ResourcePageWrapperContent>
      </MernaResourceProvider>
    </QueryClientProvider>
  )
}

export default ResourcePageWrapper
```

---

## Summary of Files

| File | Purpose |
|------|---------|
| `merna-resource-provider.tsx` | **NEW** - Your own context provider that reads `hub.merna.sf/business-app-id` |
| `use-deprovision-resource.ts` | Simplified - uses context instead of fetching directly |
| `delete-card.tsx` | Simplified - no providers needed, just uses hooks |
| `resource-page-wrapper.tsx` | Wraps everything with QueryClient + MernaResourceProvider |
| `deprovision-modal.tsx` | No changes needed |

## Provider Stack
```
ResourcePageWrapper
  └── QueryClientProvider      ← For React Query
        └── MernaResourceProvider   ← YOUR context with correct annotations
              └── ResourcePageWrapperContent
                    └── ExampleDeleteCard
                          └── useMernaResourceContext() ← Gets all the data!