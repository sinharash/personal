import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useEntity } from "@backstage/plugin-catalog-react";
import {
  MutationDeprovisionApplicationServiceArgs,
  useDeprovisionApplicationServiceMutation,
} from "@gpd-hub-plugin/cloud-experience-common";
import { useNotify } from "../../../v1/hooks/use-notify";
import logger from "../../../v1/utils/logger";

/**
 * Simple hook to delete/deprovision a MERNA resource
 *
 * No UI, no modal, no card - just a trigger function.
 * Call deleteResource() from anywhere (dropdown, button, etc.)
 *
 * @example
 * // In any component inside EntityPage:
 * const { deleteResource, isDeleting } = useDeleteResource()
 *
 * // In dropdown menu:
 * <MenuItem onClick={deleteResource} disabled={isDeleting}>
 *   Delete
 * </MenuItem>
 */
export function useDeleteResource() {
  const navigate = useNavigate();
  const { notify } = useNotify();
  const { entity } = useEntity();

  // Extract data from entity
  const businessAppId =
    entity.metadata?.annotations?.["hub.merna.sf/business-app-id"] || "";
  const name = entity.metadata?.title || entity.metadata?.name || "";
  const envLabel = entity.metadata?.labels?.["hub.merna.sf/environment"] || "";
  const environment = envLabel.toUpperCase();

  // Mutation
  const deprovisionMutation = useDeprovisionApplicationServiceMutation();

  /**
   * Delete the resource - call this from anywhere
   */
  const deleteResource = useCallback(async (): Promise<void> => {
    const variables: MutationDeprovisionApplicationServiceArgs = {
      businessApplicationId: businessAppId,
      environment: environment as any,
      name: name,
    };

    try {
      const { errors } = await deprovisionMutation.mutateAsync(variables);

      if (errors) {
        for (const error of errors) {
          const reasons = Array.isArray(error.reason)
            ? error.reason.flat()
            : [error.reason];
          for (const reason of reasons) {
            notify({ severity: "error", error: new Error(reason) });
          }
        }
        return;
      }

      notify({ message: "Resource scheduled for deletion 🗑️" });

      // Navigate back
      setTimeout(() => {
        navigate(-1);
      }, 1000);
    } catch (error) {
      logger.error("[Delete resource error]", error);
      notify({
        severity: "error",
        error: new Error("Failed to delete resource"),
      });
    }
  }, [businessAppId, environment, name, deprovisionMutation, notify, navigate]);

  return {
    deleteResource,
    isDeleting: deprovisionMutation.isPending,
    // Extra info if needed
    resourceName: name,
    businessAppId,
  };
}

// Usage - Super Simple
import { useDeleteResource } from "../../hooks/use-delete-resource";

function TheirDropdown() {
  const { deleteResource, isDeleting } = useDeleteResource();

  return (
    <Menu>
      <MenuItem onClick={deleteResource} disabled={isDeleting}>
        {isDeleting ? "Deleting..." : "Delete"}
      </MenuItem>
    </Menu>
  );
}


>>>>>>

delete button to test 

import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useDeleteResource } from '../../hooks/use-delete-resource-trigger'

/**
 * Simple test component - just a trash icon button
 * 
 * Use this to test the delete trigger.
 * Replace with dropdown later.
 */
export function DeleteButton() {
  const { deleteResource, isDeleting, resourceName } = useDeleteResource()

  return (
    <Tooltip title={isDeleting ? 'Deleting...' : `Delete ${resourceName}`} arrow>
      <span>
        <IconButton
          onClick={deleteResource}
          disabled={isDeleting}
          color="error"
        >
          {isDeleting ? (
            <CircularProgress size={24} color="error" />
          ) : (
            <DeleteOutlineIcon />
          )}
        </IconButton>
      </span>
    </Tooltip>
  )
}

export default DeleteButton

>>>>>

import { DeleteButton } from '../components/deprovision-merna-offering/delete-button'

// In EntityPage, just add:
<DeleteButton />