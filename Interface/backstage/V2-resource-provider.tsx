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
  resourceId: string // businessAppId or clusterId depending on type
  
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

/**
 * Detect which type of resource this entity represents based on annotations
 */
function detectResourceType(entity: any): { type: ResourceType; id: string } {
  const annotations = entity.metadata?.annotations || {}
  
  // V1: Business App based resources (current implementation)
  if (annotations['hub.merna.sf/business-app-id']) {
    return {
      type: 'business-app',
      id: annotations['hub.merna.sf/business-app-id'],
    }
  }
  
  // V2: Cluster based resources (future implementation)
  // TODO: Update annotation key when finalized
  if (annotations['hub.merna.sf/cluster']) {
    return {
      type: 'cluster',
      id: annotations['hub.merna.sf/cluster'],
    }
  }
  
  // Unknown resource type
  return {
    type: 'unknown',
    id: '',
  }
}

// =============================================================================
// V1 STRATEGY: Business App Based Resources
// =============================================================================

function useBusinessAppStrategy(
  entity: any,
  resourceId: string
): Omit<MernaResourceContextType, 'name' | 'resourceTag' | 'environment' | 'resourceType' | 'resourceId'> {
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
  } = useQuery(businessAppQueryOptions({ id: resourceId }))

  // Query 2: Fetch applicationService for STATUS
  const {
    data: appServiceData,
    isLoading: isAppServiceLoading,
    error: appServiceError,
  } = useQuery(
    applicationServiceQueryOptions({
      businessApplicationId: resourceId,
      name: name,
      environment: environment as any,
    })
  )

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
  const canDeprovision = !!resourceId && !isBeingDeprovisioned && allowedStatus

  const isLoading = isBusinessAppLoading || isAppServiceLoading
  const error = businessAppError || appServiceError || null

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
  resourceId: string
): Omit<MernaResourceContextType, 'name' | 'resourceTag' | 'environment' | 'resourceType' | 'resourceId'> {
  // TODO: Implement cluster-based data fetching when API is ready
  // 
  // This will likely involve:
  // 1. A new query hook for cluster data (e.g., useClusterQueryOptions)
  // 2. Different permission structure
  // 3. Different status values
  //
  // Example structure (update when API is finalized):
  // 
  // const clusterQueryOptions = useClusterQueryOptions()
  // const { data: clusterData, isLoading, error } = useQuery(
  //   clusterQueryOptions({ clusterId: resourceId })
  // )
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
  //   error,
  // }

  console.warn('[MernaResourceProvider] Cluster strategy not yet implemented')
  
  return {
    isOwner: false,
    status: 'UNKNOWN',
    isLoading: false,
    isBeingDeprovisioned: false,
    canDeprovision: false,
    error: new Error('Cluster resource type not yet implemented'),
  }
}

// =============================================================================
// UNKNOWN STRATEGY: Fallback for unrecognized resource types
// =============================================================================

function useUnknownStrategy(): Omit<MernaResourceContextType, 'name' | 'resourceTag' | 'environment' | 'resourceType' | 'resourceId'> {
  console.warn('[MernaResourceProvider] Unknown resource type - no matching annotation found')
  
  return {
    isOwner: false,
    status: 'UNKNOWN',
    isLoading: false,
    isBeingDeprovisioned: false,
    canDeprovision: false,
    error: new Error('Unknown resource type - missing required annotations'),
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
  const { type: resourceType, id: resourceId } = useMemo(
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
  const businessAppData = useBusinessAppStrategy(entity, resourceId)
  const clusterData = useClusterStrategy(entity, resourceId)
  const unknownData = useUnknownStrategy()

  // Select the correct data based on resource type
  const strategyData = useMemo(() => {
    switch (resourceType) {
      case 'business-app':
        return businessAppData
      case 'cluster':
        return clusterData
      case 'unknown':
      default:
        return unknownData
    }
  }, [resourceType, businessAppData, clusterData, unknownData])

  // Build context value with consistent interface
  const contextValue: MernaResourceContextType = useMemo(
    () => ({
      // Common entity data
      name,
      resourceTag,
      environment,
      
      // Resource identification
      resourceType,
      resourceId,
      
      // Strategy-specific data (same interface for all)
      ...strategyData,
    }),
    [name, resourceTag, environment, resourceType, resourceId, strategyData]
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