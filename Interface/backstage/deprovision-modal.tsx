import { FC, useState, ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTheme, alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

interface DeprovisionModalProps {
  name: string;
  resourceTag: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
  additionalDescription?: string;
  serviceIcon?: ReactNode;
}

const DeprovisionModal: FC<DeprovisionModalProps> = ({
  name,
  resourceTag,
  open,
  onClose,
  onConfirm,
  isDeleting = false,
  additionalDescription,
}) => {
  const theme = useTheme();
  const [confirmText, setConfirmText] = useState("");
  const requiredConfirmText = name || "";
  const isConfirmValid = confirmText === requiredConfirmText;

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText("");
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (isConfirmValid) {
      await onConfirm();
    }
  };

  // const isDark = theme.palette.mode === 'dark'
  const dangerColor = theme.palette.error.main;
  const dangerBg = alpha(dangerColor, 0.08);
  // const dangerBorder = alpha(dangerColor, 0.3)

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
        },
      }}
    >
      {isDeleting && <LinearProgress color="error" />}

      {/* Header */}
      <DialogTitle sx={{ pb: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 2,
                backgroundColor: dangerBg,
                color: dangerColor,
              }}
            >
              <DeleteIcon />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                Delete "{name}"
              </Typography>
              <Typography variant="h6" color="error">
                This action cannot be undone
              </Typography>
            </Box>
          </Stack>
          <IconButton
            onClick={handleClose}
            disabled={isDeleting}
            size="small"
            sx={{ color: "text.secondary" }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        <Stack spacing={3}>
          {/* Warning Alert */}
          <Alert
            severity="error"
            icon={<WarningAmberRoundedIcon />}
            sx={{
              borderRadius: 2,
              "& .MuiAlert-message": {
                width: "100%",
              },
            }}
          >
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Warning: Permanent Deletion
            </Typography>
            <Typography variant="body2">
              The {resourceTag.toLowerCase()} will be permanently deleted. This
              action is irreversible and cannot be undone.
              {additionalDescription && ` ${additionalDescription}`}
            </Typography>
          </Alert>

          {/* Confirmation Input */}
          <Box>
            <Alert
              severity="info"
              icon={<InfoOutlinedIcon />}
              sx={{
                mb: 2,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.info.main, 0.08),
              }}
            >
              <Typography variant="body2">
                Please type <strong>{requiredConfirmText}</strong> to confirm
              </Typography>
            </Alert>

            <TextField
              fullWidth
              autoFocus
              placeholder={`Type "${requiredConfirmText}" to confirm`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isDeleting}
              error={confirmText.length > 0 && !isConfirmValid}
              helperText={
                confirmText.length > 0 && !isConfirmValid
                  ? "Name does not match"
                  : ""
              }
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  fontFamily: "monospace",
                },
              }}
            />
          </Box>
        </Stack>
      </DialogContent>

      <Divider />

      {/* Actions */}
      <DialogActions
        sx={{
          p: 2.5,
          backgroundColor: dangerBg,
        }}
      >
        <Button
          onClick={handleClose}
          disabled={isDeleting}
          variant="outlined"
          sx={{ borderRadius: 2 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!isConfirmValid || isDeleting}
          variant="contained"
          color="error"
          startIcon={isDeleting ? undefined : <DeleteForeverIcon />}
          sx={{
            borderRadius: 2,
            minWidth: 140,
          }}
        >
          {isDeleting ? "Deleting..." : "Delete Forever"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export { DeprovisionModal };
