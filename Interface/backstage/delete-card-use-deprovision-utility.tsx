// v2/components/deprovision-merna-offering/delete-card.tsx

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
import { DeprovisionModal } from "./deprovision-modal";
import { useDeprovisionResource } from "../../hooks/use-deprovision-resource";
import {
  getCapabilityDeletionDescription,
  getDeleteStatusInfo,
} from "../../utils/deprovision-utils";

/**
 * Delete card component - requires MernaResourceProvider above it
 */
export function ExampleDeleteCard() {
  const theme = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    name,
    resourceTag,
    handleDeprovision,
    isDeleting,
    canDeprovision,
    isOwner,
  } = useDeprovisionResource();

  // Combine permission check with status check
  const canDelete = canDeprovision && isOwner;

  const handleOpenModal = () => {
    if (canDelete) {
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

  // Use utility functions
  const additionalDescription = getCapabilityDeletionDescription(resourceTag);
  const statusInfo = getDeleteStatusInfo(isOwner, canDeprovision);

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          borderColor: canDelete
            ? alpha(theme.palette.error.main, 0.3)
            : theme.palette.divider,
          transition: "all 0.2s ease-in-out",
          "&:hover": canDelete
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
  );
}

export default ExampleDeleteCard;
