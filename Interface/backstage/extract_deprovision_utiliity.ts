import { ReactNode } from "react";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import BlockIcon from "@mui/icons-material/Block";

/**
 * Get resource-specific additional description for deletion warning
 * Add more cases as new resource types are supported
 *
 * @param resourceTag - The type of resource (e.g., 'messaging', 'compute', 'cache')
 * @returns Additional warning description or undefined
 */
export function getCapabilityDeletionDescription(
  resourceTag: string
): string | undefined {
  switch (resourceTag.toLowerCase()) {
    case "messaging":
      return "All queue configurations will be deleted alongside the queue set.";
    case "compute":
      return "Ensure the deployment repository is empty before deleting the application.";
    case "cache":
      return "All cache data will be permanently deleted.";
    // TODO: Add more resource types as needed
    // case 'data':
    //   return 'All data stores will be permanently deleted.'
    // case 'secret':
    //   return 'All secrets will be permanently deleted.'
    default:
      return undefined;
  }
}

/**
 * Status info for showing chip/badge when delete is not available
 */
export interface DeleteStatusInfo {
  label: string;
  color: "default" | "warning" | "error";
  icon: ReactNode;
  tooltip: string;
}

/**
 * Get status info for delete button display
 *
 * @param isOwner - Whether the current user is an owner of the resource
 * @param canDeprovision - Whether the resource can be deprovisioned (based on status)
 * @returns StatusInfo object if delete is blocked, null if delete is allowed
 *
 * Usage:
 * ```tsx
 * const statusInfo = getDeleteStatusInfo(isOwner, canDeprovision)
 *
 * {statusInfo ? (
 *   <Chip icon={statusInfo.icon} label={statusInfo.label} />
 * ) : (
 *   <IconButton onClick={handleOpenModal}>
 *     <DeleteIcon />
 *   </IconButton>
 * )}
 * ```
 */
export function getDeleteStatusInfo(
  isOwner: boolean,
  canDeprovision: boolean
): DeleteStatusInfo | null {
  if (!isOwner) {
    return {
      label: "Owner Only",
      color: "default",
      icon: <LockOutlinedIcon fontSize="small" />,
      tooltip: "Only owners can delete this resource",
    };
  }

  if (!canDeprovision) {
    return {
      label: "Cannot Delete",
      color: "default",
      icon: <BlockIcon fontSize="small" />,
      tooltip: "This resource cannot be deleted in its current state",
    };
  }

  // User can delete - return null to show delete button
  return null;
}

/**
 * Check if user can delete the resource
 *
 * @param isOwner - Whether the current user is an owner
 * @param canDeprovision - Whether the resource status allows deletion
 * @returns true if user can delete
 */
export function canUserDelete(
  isOwner: boolean,
  canDeprovision: boolean
): boolean {
  return isOwner && canDeprovision;
}
