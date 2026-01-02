import { useState, useCallback } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Stack from "@mui/material/Stack";
import { DeprovisionModal } from "../components/deprovision-merna-offering/deprovision-modal";
import { useDeprovisionResource } from "./use-deprovision-resource";

/**
 * Get resource-specific additional description for deletion warning
 */
function getCapabilityDeletionDescription(
  resourceTag: string
): string | undefined {
  switch (resourceTag.toLowerCase()) {
    case "messaging":
      return "All queue configurations will be deleted alongside the queue set.";
    case "compute":
      return "Ensure the deployment repository is empty before deleting the application.";
    default:
      return undefined;
  }
}
