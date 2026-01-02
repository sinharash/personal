// example-delete-card.tsx (or you could name it resource-delete-card.tsx)

import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import { useTheme, alpha } from "@mui/material/styles";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BlockIcon from "@mui/icons-material/Block";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { DeprovisionModal } from "./deprovision-modal";
import { useDeprovisionResource } from "../../hooks/use-deprovision-resource";

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

export const ExampleDeleteCard = () => {
  const theme = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    name,
    resourceTag,
    handleDeprovision,
    isDeleting,
    isBeingDeprovisioned,
    canDeprovision,
  } = useDeprovisionResource();

  const handleOpenModal = () => {
    if (canDeprovision) {
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    if (!isDeleting) {
      setIsModalOpen(false);
    }
  };

  const handleConfirmDelete = async () => {
    await handleDeprovision();
    setIsModalOpen(false);
  };

  const additionalDescription = getCapabilityDeletionDescription(resourceTag);

  // Determine the status display
  const getStatusInfo = () => {
    if (isBeingDeprovisioned) {
      return {
        label: "Deprovisioning",
        color: "warning" as const,
        icon: <WarningAmberIcon fontSize="small" />,
      };
    }
    if (!canDeprovision) {
      return {
        label: "Cannot Delete",
        color: "default" as const,
        icon: <BlockIcon fontSize="small" />,
      };
    }
    return null;
  };

  const statusInfo = getStatusInfo();

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          borderColor: canDeprovision
            ? alpha(theme.palette.error.main, 0.3)
            : theme.palette.divider,
          transition: "all 0.2s ease-in-out",
          "&:hover": canDeprovision
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
                <Chip
                  icon={statusInfo.icon}
                  label={statusInfo.label}
                  color={statusInfo.color}
                  size="small"
                  variant="outlined"
                />
              ) : (
                <Tooltip title={`Delete ${name}`} arrow>
                  <IconButton
                    onClick={handleOpenModal}
                    disabled={!canDeprovision || isDeleting}
                    sx={{
                      color: theme.palette.error.main,
                      backgroundColor: alpha(theme.palette.error.main, 0.08),
                      "&:hover": {
                        backgroundColor: alpha(theme.palette.error.main, 0.16),
                      },
                      "&.Mui-disabled": {
                        color: theme.palette.action.disabled,
                        backgroundColor:
                          theme.palette.action.disabledBackground,
                      },
                    }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            {isBeingDeprovisioned && (
              <Typography variant="caption" color="warning.main">
                This resource is currently being deprovisioned and cannot be
                deleted.
              </Typography>
            )}

            {!canDeprovision && !isBeingDeprovisioned && (
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
  );
};

export default ExampleDeleteCard;
