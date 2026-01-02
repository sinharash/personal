import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEntity } from '@backstage/plugin-catalog-react'
import { useQuery } from '@tanstack/react-query'
import {
  MutationDeprovisionApplicationServiceArgs,
  useDeprovisionApplicationServiceMutation,
} from '@gpd-hub-plugin/cloud-experience-common'
import { useApplicationServiceQueryOptions } from '../../../v1/features/service-offering/api/mutation.deprovision-application-service'
import { useNotify } from '../../../v1/hooks/use-notify'
import logger from '../../../v1/utils/logger'

/**
 * Hook to handle MERNA resource deprovisioning from entity metadata
 * Fetches applicationService from GraphQL to check status
 *
 * @returns Object containing name, resource tag, delete handler, and loading state
 */
export function useDeprovisionResource() {
  const { entity } = useEntity()
  const { notify } = useNotify()
  const navigate = useNavigate()
  const deprovisionMutation = useDeprovisionApplicationServiceMutation()
  const applicationServiceQueryOptions = useApplicationServiceQueryOptions()

  // Extract data from entity
  const businessAppId = entity.metadata?.annotations?.['hub.merna.sf/business-app-id'] || ''
  const name = entity.metadata?.title || ''
  const envLabel = entity.metadata?.labels?.['hub.merna.sf/environment'] || 'test'
  const environment = envLabel.toUpperCase()

  console.log('[useDeprovisionResource] Entity data:', {
    businessAppId,
    name,
    environment,
    hasAnnotation: !!entity.metadata?.annotations?.['hub.merna.sf/business-app-id']
  })

  // Fetch applicationService to get real-time status
  const { data: appServiceData } = useQuery(
    applicationServiceQueryOptions({
      businessApplicationId: businessAppId,
      name: name,
      environment: environment as any,
    })
  )

  const applicationService = appServiceData?.data?.applicationService
  const status = applicationService?.status || ''

  console.log('[useDeprovisionResource] Status:', {
    status,
    hasAppService: !!applicationService,
    fullResponse: appServiceData
  })

  // Check if resource is being deprovisioned or deleted
  const isBeingDeprovisioned = status === 'DEPROVISIONED' || status === 'PROVISIONING'

  // Only allow deletion if status is exactly PROVISIONED or ERROR
  // TODO: Remove '!status ||' after testing - it's only for v1 route testing without proper entity annotations
  const allowedStatus = status === 'PROVISIONED' || status === 'ERROR'
  // const allowedStatus = !status || status === 'PROVISIONED' || status === 'ERROR'

  // Extract display data for modal
  const tags = entity.metadata?.tags || []
  const resourceTag = tags[0] || 'service'

  /**
   * Execute deprovision mutation
   */
  const handleDeprovision = useCallback(async (): Promise<void> => {
    const variables: MutationDeprovisionApplicationServiceArgs = {
      businessApplicationId: businessAppId,
      environment: environment as any,
      name: name,
    }

    const { errors } = await deprovisionMutation.mutateAsync(variables)

    if (errors) {
      for (const error of errors) {
        const reasons = Array.isArray(error.reason) ? error.reason.flat() : [error.reason]

        for (const reason of reasons) {
          if (reason.includes('Unauthorized')) {
            notify({ severity: 'error', error: new Error(reason) })
          } else {
            notify({ severity: 'error', error: new Error(reason) })
          }
        }
      }
      return
    }

    notify({ message: 'Resource scheduled for deletion 🗑️' })
  } catch (error) {
    logger.error('[Delete resource error]', error)
    notify({ severity: 'error', error: new Error('Failed to delete resource') })
  } finally {
    // Always navigate back after showing message (success or error)
    setTimeout(() => {
      navigate(-1)
    }, 1000)
  }
  }, [businessAppId, environment, name, deprovisionMutation, notify, navigate])

  return {
    name,
    resourceTag: resourceTag.toUpperCase(),
    handleDeprovision,
    isDeleting: deprovisionMutation.isPending,
    isBeingDeprovisioned, // Real-time status from GraphQL
    canDeprovision: !!businessAppId && !isBeingDeprovisioned && allowedStatus, // Only allow if PROVISIONED or ERROR
  }
}