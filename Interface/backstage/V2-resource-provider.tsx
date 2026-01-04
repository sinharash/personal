import { createContext, useContext, ReactNode, useMemo } from 'react'
import { useEntity } from '@backstage/plugin-catalog-react'
import { useQuery } from '@tanstack/react-query'
import { useApplicationServiceQueryOptions } from '../../v1/features/service-offering/api/application-service-queryoptions'
import { useBusinessApplicationQueryOptions } from '../../v1/features/business-app/api/queryoptions.business-application'
import { createPermissionChecker } from '../../v1/utils/permissions'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Resource type determines which data fetching strategy to use
 */
type ResourceType = 'business-app' | 'cluster' | 'unknown'

/**
 * Common interface returned by the context - same for all resource types
 * Components consuming this context don't need to know which flow was used
 */
interface MernaResourceContextType {
  // Entity data
  name: string
  resourceTag: string
  environment: string
  
  // Resource identification
  resourceType: ResourceType
  businessAppId: string    // V1: used for deprovision mutation
  // TODO V2: Add clusterId when cluster strategy is implemented
  // clusterId: string
  
  // Permissions
  isOwner: boolean
  
  // Status
  status: string
  isLoading: boolean
  
  // Computed flags (same interface regardless of resource type)
  isBeingDeprovisioned: boolean
  canDeprovision: boolean
  
  // Error state
  error: Error | null
}

// =============================================================================
// CONTEXT
// =============================================================================

const MernaResourceContext = createContext<MernaResourceContextType | null>(null)

export function useMernaResourceContext() {
  const context = useContext(MernaResourceContext)
  if (!context) {
    throw new Error('useMernaResourceContext must be used within a MernaResourceProvider')
  }
  return context
}

// =============================================================================
// ANNOTATION DETECTION
// =============================================================================

interface DetectedResource {
  type: ResourceType
  businessAppId: string
  // TODO V2: Add clusterId when ready
  // clusterId: string
}

/**
 * Detect which type of resource this entity represents based on annotations
 */
function detectResourceType(entity: any): DetectedResource {
  const annotations = entity.metadata?.annotations || {}
  
  // V1: Business App based resources (current implementation)
  if (annotations['hub.merna.sf/business-app-id']) {
    return {
      type: 'business-app',
      businessAppId: annotations['hub.merna.sf/business-app-id'],
    }
  }
  
  // V2: Cluster based resources (future implementation)
  // TODO: Update annotation key when finalized
  if (annotations['hub.merna.sf/cluster']) {
    return {
      type: 'cluster',
      businessAppId: '', // V2 won't use businessAppId
      // clusterId: annotations['hub.merna.sf/cluster'],
    }
  }
  
  // Unknown resource type
  return {
    type: 'unknown',
    businessAppId: '',
  }
}

// =============================================================================
// V1 STRATEGY: Business App Based Resources
// =============================================================================

interface StrategyResult {
  isOwner: boolean
  status: string
  isLoading: boolean
  isBeingDeprovisioned: boolean
  canDeprovision: boolean
  error: Error | null
}

function useBusinessAppStrategy(
  entity: any,
  businessAppId: string,
  enabled: boolean
): StrategyResult {
  const applicationServiceQueryOptions = useApplicationServiceQueryOptions()
  const businessAppQueryOptions = useBusinessApplicationQueryOptions()

  const name = entity.metadata?.title || entity.metadata?.name || ''
  const envLabel = entity.metadata?.labels?.['hub.merna.sf/environment'] || 'test'
  const environment = envLabel.toUpperCase()

  // Query 1: Fetch businessApplication for PERMISSIONS
  const {
    data: businessAppData,
    isLoading: isBusinessAppLoading,
    error: businessAppError,
  } = useQuery({
    ...businessAppQueryOptions({ id: businessAppId }),
    enabled: enabled && !!businessAppId,
  })

  // Query 2: Fetch applicationService for STATUS
  const {
    data: appServiceData,
    isLoading: isAppServiceLoading,
    error: appServiceError,
  } = useQuery({
    ...applicationServiceQueryOptions({
      businessApplicationId: businessAppId,
      name: name,
      environment: environment as any,
    }),
    enabled: enabled && !!businessAppId,
  })

  // If not enabled, return empty state
  if (!enabled) {
    return {
      isOwner: false,
      status: '',
      isLoading: false,
      isBeingDeprovisioned: false,
      canDeprovision: false,
      error: null,
    }
  }

  // Extract data from queries
  const businessApplication = businessAppData?.data?.businessApplication
  const applicationService = appServiceData?.data?.applicationService
  const status = applicationService?.status || ''

  // Get permissions from businessApplication
  const permissionLevels = businessApplication?.permissionLevels || []
  const permissions = createPermissionChecker(permissionLevels)
  const isOwner = permissions.hasRole('OWNER')

  // Compute status flags
  const isBeingDeprovisioned = status === 'DEPROVISIONED' || status === 'PROVISIONING'
  const allowedStatus = status === 'PROVISIONED' || status === 'ERROR'
  const canDeprovision = !!businessAppId && !isBeingDeprovisioned && allowedStatus

  const isLoading = isBusinessAppLoading || isAppServiceLoading
  const error = (businessAppError as Error) || (appServiceError as Error) || null

  return {
    isOwner,
    status,
    isLoading,
    isBeingDeprovisioned,
    canDeprovision,
    error,
  }
}

// =============================================================================
// V2 STRATEGY: Cluster Based Resources (TODO: Implement when ready)
// =============================================================================

function useClusterStrategy(
  entity: any,
  enabled: boolean
): StrategyResult {
  // TODO: Implement cluster-based data fetching when API is ready
  // 
  // This will likely involve:
  // 1. A new query hook for cluster data (e.g., useClusterQueryOptions)
  // 2. Different permission structure
  // 3. Different status values
  // 4. Different mutation for deprovisioning
  //
  // Example structure (update when API is finalized):
  // 
  // const clusterId = entity.metadata?.annotations?.['hub.merna.sf/cluster']
  // const clusterQueryOptions = useClusterQueryOptions()
  // 
  // const { data: clusterData, isLoading, error } = useQuery({
  //   ...clusterQueryOptions({ clusterId }),
  //   enabled: enabled && !!clusterId,
  // })
  // 
  // const cluster = clusterData?.data?.cluster
  // const status = cluster?.status || ''
  // const isOwner = cluster?.permissions?.includes('OWNER') || false
  // 
  // return {
  //   isOwner,
  //   status,
  //   isLoading,
  //   isBeingDeprovisioned: status === 'DEPROVISIONING',
  //   canDeprovision: isOwner && status === 'ACTIVE',
  //   error: null,
  // }

  if (enabled) {
    console.warn('[MernaResourceProvider] Cluster strategy not yet implemented')
  }
  
  return {
    isOwner: false,
    status: 'UNKNOWN',
    isLoading: false,
    isBeingDeprovisioned: false,
    canDeprovision: false,
    error: enabled ? new Error('Cluster resource type not yet implemented') : null,
  }
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface MernaResourceProviderProps {
  children: ReactNode
}

export function MernaResourceProvider({ children }: MernaResourceProviderProps) {
  const { entity } = useEntity()

  // Detect resource type from annotations
  const { type: resourceType, businessAppId } = useMemo(
    () => detectResourceType(entity),
    [entity]
  )

  // Extract common entity data
  const name = entity.metadata?.title || entity.metadata?.name || ''
  const tags = entity.metadata?.tags || []
  const resourceTag = tags[0]?.toUpperCase() || 'SERVICE'
  const envLabel = entity.metadata?.labels?.['hub.merna.sf/environment'] || 'test'
  const environment = envLabel.toUpperCase()

  // Use appropriate strategy based on resource type
  // Note: All hooks must be called unconditionally (Rules of Hooks)
  // We use 'enabled' flag to prevent unnecessary API calls
  const businessAppData = useBusinessAppStrategy(
    entity,
    businessAppId,
    resourceType === 'business-app'
  )
  
  const clusterData = useClusterStrategy(
    entity,
    resourceType === 'cluster'
  )

  // Select the correct data based on resource type
  const strategyData = useMemo(() => {
    switch (resourceType) {
      case 'business-app':
        return businessAppData
      case 'cluster':
        return clusterData
      case 'unknown':
      default:
        return {
          isOwner: false,
          status: 'UNKNOWN',
          isLoading: false,
          isBeingDeprovisioned: false,
          canDeprovision: false,
          error: new Error('Unknown resource type - missing required annotations'),
        }
    }
  }, [resourceType, businessAppData, clusterData])

  // Build context value with consistent interface
  const contextValue: MernaResourceContextType = useMemo(
    () => ({
      // Common entity data
      name,
      resourceTag,
      environment,
      
      // Resource identification
      resourceType,
      businessAppId,
      // TODO V2: Add clusterId here
      
      // Strategy-specific data (same interface for all)
      ...strategyData,
    }),
    [name, resourceTag, environment, resourceType, businessAppId, strategyData]
  )

  return (
    <MernaResourceContext.Provider value={contextValue}>
      {children}
    </MernaResourceContext.Provider>
  )
}

export { MernaResourceContext }
```

---

**How it works:**
```
Entity arrives
       ↓
detectResourceType(entity)
       ↓
┌──────────────────────────────────────────────────────────────┐
│  Check annotations:                                          │
│                                                              │
│  hub.merna.sf/business-app-id exists?                        │
│    → YES → type = 'business-app', use V1 strategy            │
│                                                              │
│  hub.merna.sf/cluster exists?                                │
│    → YES → type = 'cluster', use V2 strategy (TODO)          │
│                                                              │
│  Neither?                                                    │
│    → type = 'unknown', return error state                    │
└──────────────────────────────────────────────────────────────┘
       ↓
Return SAME interface to components
       ↓
┌──────────────────────────────────────────────────────────────┐
│  {                                                           │
│    name: string                                              │
│    resourceTag: string                                       │
│    isOwner: boolean                                          │
│    status: string                                            │
│    canDeprovision: boolean                                   │
│    isBeingDeprovisioned: boolean                             │
│    ...                                                       │
│  }                                                           │
│                                                              │
│  Components don't care which strategy was used!              │
└──────────────────────────────────────────────────────────────┘

When V2 is ready, you just:

Update the annotation key in detectResourceType() if needed
Implement useClusterStrategy() with the real API calls
Everything else stays the same!


Optional: Add debug info
If you want to see which strategy is being used during development:
tsx// In your delete-card or any component
const { resourceType, resourceId } = useMernaResourceContext()

console.log(`[Debug] Using ${resourceType} strategy with ID: ${resourceId}`)

Does this approach work for your needs? Want me to adjust anything or add more TODO comments for the V2 implementation?




// Now use-deprovision-resource.ts
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
    businessAppId,    // ← Back to using businessAppId
    resourceType,
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
    // V1: Business App based deprovisioning
    if (resourceType === 'business-app') {
      const variables: MutationDeprovisionApplicationServiceArgs = {
        businessApplicationId: businessAppId,    // ← Used here
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
      return
    }

    // V2: Cluster based deprovisioning
    // TODO: Implement when cluster API is ready
    if (resourceType === 'cluster') {
      // const clusterVariables = {
      //   clusterId: clusterId,
      //   ...
      // }
      // await clusterDeprovisionMutation.mutateAsync(clusterVariables)
      
      notify({ severity: 'error', error: new Error('Cluster deprovisioning not yet implemented') })
      return
    }

    // Unknown resource type
    notify({ severity: 'error', error: new Error('Cannot deprovision unknown resource type') })
  }, [businessAppId, environment, name, resourceType, deprovisionMutation, notify, navigate])

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


//Summary:
//VariableWhat it isUsed bybusinessAppIdValue from hub.merna.sf/business-app-id annotationV1 queries and mutationresourceType'business-app' or 'cluster' or 'unknown'Strategy selectionnameEntity name/titleBoth V1 and V2environmentFrom hub.merna.sf/environment labelBoth V1 and V2
//When V2 is ready, you'll add clusterId to the context and use it in the cluster strategy.