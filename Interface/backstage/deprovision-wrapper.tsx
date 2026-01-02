// resource-page-wrapper.tsx

import { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { useTheme, alpha } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useDeprovisionResource } from "../../hooks/use-deprovision-resource";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

/**
 * Full-page deprovisioning status display
 */
function DeprovisioningStatusView({ resourceName }: { resourceName?: string }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 400,
        py: 6,
        px: 3,
      }}
    >
      {/* Cloud Icon with Clock */}
      <Box
        sx={{
          position: "relative",
          mb: 4,
        }}
      >
        <CloudOffOutlinedIcon
          sx={{
            fontSize: 120,
            color: alpha(theme.palette.text.secondary, 0.3),
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: -8,
            right: -8,
            backgroundColor: theme.palette.background.paper,
            borderRadius: "50%",
            p: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: theme.shadows[2],
          }}
        >
          <ScheduleIcon
            sx={{
              fontSize: 32,
              color: theme.palette.text.secondary,
            }}
          />
        </Box>
      </Box>

      {/* Status Message */}
      <Stack spacing={1} alignItems="center">
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            backgroundColor: alpha(theme.palette.info.main, 0.08),
            borderRadius: 2,
            px: 2,
            py: 1,
          }}
        >
          <InfoOutlinedIcon
            sx={{
              fontSize: 20,
              color: theme.palette.info.main,
            }}
          />
          <Typography variant="body1" color="text.primary">
            App service is being deprovisioned
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary">
          This process may take a while.
        </Typography>

        {resourceName && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
            Resource: {resourceName}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

interface ResourcePageWrapperContentProps {
  children: ReactNode;
}

/**
 * Inner wrapper that checks deprovisioning status
 */
function ResourcePageWrapperContent({
  children,
}: ResourcePageWrapperContentProps) {
  const { name, isBeingDeprovisioned } = useDeprovisionResource();

  // If resource is being deprovisioned, show the status view instead of normal content
  if (isBeingDeprovisioned) {
    return <DeprovisioningStatusView resourceName={name} />;
  }

  // Otherwise render the normal page content
  return <>{children}</>;
}

interface ResourcePageWrapperProps {
  children: ReactNode;
}

/**
 * Wrapper component for MERNA resource pages
 * Checks if resource is being deprovisioned and shows appropriate UI
 */
export function ResourcePageWrapper({ children }: ResourcePageWrapperProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ResourcePageWrapperContent>{children}</ResourcePageWrapperContent>
    </QueryClientProvider>
  );
}

export default ResourcePageWrapper;
