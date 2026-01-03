import { createContext, useContext, ReactNode } from "react";
import { useEntity } from "@backstage/plugin-catalog-react";
import { useQuery } from "@tanstack/react-query";
import { useApplicationServiceQueryOptions } from "../../v1/features/service-offering/api/application-service-queryoptions";
import { createPermissionChecker } from "../../v1/utils/permissions";

// Define the shape of our context data
interface MernaResourceContextType {
  // Entity data
  name: string;
  resourceTag: string;
  environment: string;
  businessAppId: string;

  // Application service data
  applicationService: any | null;
  status: string;
  isLoading: boolean;

  // Permissions
  permissions: ReturnType<typeof createPermissionChecker>;
  isOwner: boolean;

  // Computed flags
  isBeingDeprovisioned: boolean;
  canDeprovision: boolean;
}

// Create the context with null default
const MernaResourceContext = createContext<MernaResourceContextType | null>(
  null
);

// Hook to use the context
export function useMernaResourceContext() {
  const context = useContext(MernaResourceContext);
  if (!context) {
    throw new Error(
      "useMernaResourceContext must be used within a MernaResourceProvider"
    );
  }
  return context;
}

// Provider component
interface MernaResourceProviderProps {
  children: ReactNode;
}

export function MernaResourceProvider({
  children,
}: MernaResourceProviderProps) {
  const { entity } = useEntity();
  const applicationServiceQueryOptions = useApplicationServiceQueryOptions();

  // Extract data from entity using YOUR annotation keys
  const businessAppId =
    entity.metadata?.annotations?.["hub.merna.sf/business-app-id"] || "";
  const name = entity.metadata?.title || entity.metadata?.name || "";
  const envLabel =
    entity.metadata?.labels?.["hub.merna.sf/environment"] || "test";
  const environment = envLabel.toUpperCase();
  const tags = entity.metadata?.tags || [];
  const resourceTag = tags[0]?.toUpperCase() || "SERVICE";

  // Fetch application service data
  const { data: appServiceData, isLoading } = useQuery(
    applicationServiceQueryOptions({
      businessApplicationId: businessAppId,
      name: name,
      environment: environment as any,
    })
  );

  const applicationService = appServiceData?.data?.applicationService;
  const status = applicationService?.status || "";

  // Get permissions from applicationService
  const permissionLevels = applicationService?.permissionLevels || [];
  const permissions = createPermissionChecker(permissionLevels);
  const isOwner = permissions.hasRole("OWNER");

  // Compute status flags
  const isBeingDeprovisioned =
    status === "DEPROVISIONED" || status === "PROVISIONING";
  const allowedStatus = status === "PROVISIONED" || status === "ERROR";
  const canDeprovision =
    !!businessAppId && !isBeingDeprovisioned && allowedStatus && isOwner;

  // Build context value
  const contextValue: MernaResourceContextType = {
    name,
    resourceTag,
    environment,
    businessAppId,
    applicationService,
    status,
    isLoading,
    permissions,
    isOwner,
    isBeingDeprovisioned,
    canDeprovision,
  };

  return (
    <MernaResourceContext.Provider value={contextValue}>
      {children}
    </MernaResourceContext.Provider>
  );
}

export { MernaResourceContext };
