import { useState } from 'react'
import ReactDOM from 'react-dom'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import { useTheme, alpha } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import BlockIcon from '@mui/icons-material/Block'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined'
import ScheduleIcon from '@mui/icons-material/Schedule'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { DeprovisionModal } from './deprovision-modal'
import { useDeprovisionResource } from '../../hooks/use-deprovision-resource'
import { BusinessAppProvider, useBusinessAppContext } from '../../../v1/hooks/business-app-provider'
import { createPermissionChecker } from '../../../v1/utils/permissions'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

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
 * Full-page deprovisioning overlay using Portal
 */
function DeprovisioningOverlay({ resourceName }: { resourceName?: string }) {
  const theme = useTheme()

  const container =
    document.querySelector('article') ||
    document.querySelector('[class*="BackstageContent"]') ||
    document.querySelector('main')

  if (!container) return null

  return ReactDOM.createPortal(
    <Paper
      elevation={0}
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.palette.background.default,
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            backgroundColor: alpha(theme.palette.info.main, 0.08),
            borderRadius: 2,
            px: 2,
            py: 1,
          }}
        >
          <InfoOutlinedIcon
            sx={{ fontSize: 20, color: theme.palette.info.main }}
          />
          <Typography variant="body1" color="text.primary">
            App service is being deprovisioned
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary">
          This process may take a while.
        </Typography>

        {resourceName && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
            Resource: {resourceName}
          </Typography>
        )}
      </Stack>
    </Paper>,
    container
  )
}

/**
 * Inner component that uses all the hooks
 */
function ExampleDeleteCardContent() {
  const theme = useTheme()
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Get deprovision resource data
  const {
    name,
    resourceTag,
    handleDeprovision,
    isDeleting,
    isBeingDeprovisioned,
    canDeprovision,
  } = useDeprovisionResource()

  // Get permissions from BusinessAppContext
  const { businessAppData } = useBusinessAppContext()
  const permissions = createPermissionChecker(
    businessAppData?.data?.businessApplication?.permissionLevels
  )
  const isOwner = permissions.hasRole('OWNER')

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

  // If deprovisioning, render the overlay via Portal
  if (isBeingDeprovisioned) {
    return (
      <>
        <DeprovisioningOverlay resourceName={name} />
        <Card variant="outlined" sx={{ borderRadius: 2, opacity: 0 }}>
          <CardContent>
            <Box height={80} />
          </CardContent>
        </Card>
      </>
    )
  }

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

/**
 * Wrapper with all required providers
 */
export function ExampleDeleteCard() {
  return (
    <QueryClientProvider client={queryClient}>
      <BusinessAppProvider>
        <ExampleDeleteCardContent />
      </BusinessAppProvider>
    </QueryClientProvider>
  )
}

export default ExampleDeleteCard
```

