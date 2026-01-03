import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MutationDeprovisionApplicationServiceArgs,
  useDeprovisionApplicationServiceMutation,
} from "@gpd-hub-plugin/cloud-experience-common";
import { useNotify } from "../../../v1/hooks/use-notify";
import logger from "../../../v1/utils/logger";
import { useMernaResourceContext } from "./merna-resource-provider";

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
  } = useMernaResourceContext();

  const { notify } = useNotify();
  const navigate = useNavigate();
  const deprovisionMutation = useDeprovisionApplicationServiceMutation();

  /**
   * Execute deprovision mutation
   */
  const handleDeprovision = useCallback(async (): Promise<void> => {
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
    } catch (error) {
      logger.error("[Delete resource error]", error);
      notify({
        severity: "error",
        error: new Error("Failed to delete resource"),
      });
    } finally {
      setTimeout(() => {
        navigate(-1);
      }, 1000);
    }
  }, [businessAppId, environment, name, deprovisionMutation, notify, navigate]);

  return {
    name,
    resourceTag,
    handleDeprovision,
    isDeleting: deprovisionMutation.isPending,
    isBeingDeprovisioned,
    canDeprovision,
    isOwner,
  };
}
