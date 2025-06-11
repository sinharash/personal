import { createTemplateAction } from "@backstage/plugin-scaffolder-node";
import { CatalogApi, CatalogClient } from "@backstage/catalog-client";
import { DiscoveryApi, IdentityApi } from "@backstage/core-plugin-api";

// Extract entity reference from the special formatted string
const extractEntityRef = (value: string): string | undefined => {
  const match = value.match(/__entity-ref::([^:]+)::/);
  return match ? match[1] : undefined;
};

export const fetchEntityAction = createTemplateAction<{
  entityRef: string;
  optional?: boolean;
}>({
  id: "catalog:fetch-entity",
  schema: {
    input: {
      required: ["entityRef"],
      type: "object",
      properties: {
        entityRef: {
          type: "string",
          title: "Entity Reference",
          description: "The entity reference string from EnhancedEntityPicker",
        },
        optional: {
          type: "boolean",
          title: "Optional",
          description: "Whether to fail if the entity is not found",
        },
      },
    },
    output: {
      type: "object",
      properties: {
        entity: {
          type: "object",
          title: "Entity",
          description: "The full entity object",
        },
        entityRef: {
          type: "string",
          title: "Entity Reference",
          description: "The entity reference string",
        },
        metadata: {
          type: "object",
          title: "Entity Metadata",
        },
        spec: {
          type: "object",
          title: "Entity Spec",
        },
        // Add any other properties you need direct access to
      },
    },
  },
  async handler(ctx) {
    const { entityRef: entityRefInput, optional = false } = ctx.input;

    // Extract entity reference from the special string format
    const entityRef = extractEntityRef(entityRefInput) || entityRefInput;

    if (!entityRef) {
      if (optional) {
        ctx.output("entity", undefined);
        ctx.output("entityRef", undefined);
        return;
      }
      throw new Error(`Invalid entity reference: ${entityRefInput}`);
    }

    // Create a catalog client
    const discoveryApi = ctx.getServiceFactory("discovery")?.create();
    const identityApi = ctx.getServiceFactory("identity")?.create();

    if (!discoveryApi) {
      throw new Error("Discovery API not available");
    }

    // Create a catalog client
    const catalogClient: CatalogApi = new CatalogClient({
      discoveryApi: discoveryApi as DiscoveryApi,
      identityApi: identityApi as IdentityApi,
    });

    try {
      // Fetch the entity
      const entity = await catalogClient.getEntityByRef(entityRef);

      if (!entity) {
        if (optional) {
          ctx.output("entity", undefined);
          ctx.output("entityRef", entityRef);
          return;
        }
        throw new Error(`Entity not found: ${entityRef}`);
      }

      // Output the full entity and its major parts
      ctx.output("entity", entity);
      ctx.output("entityRef", entityRef);
      ctx.output("metadata", entity.metadata);
      ctx.output("spec", entity.spec);

      // Output common specific fields for convenience
      if (entity.metadata.name) {
        ctx.output("name", entity.metadata.name);
      }

      if (entity.metadata.description) {
        ctx.output("description", entity.metadata.description);
      }

      // Add outputs for common entity-specific fields
      if (entity.kind === "User" && entity.spec) {
        if (entity.spec.profile?.email) {
          ctx.output("email", entity.spec.profile.email);
        }
        if (entity.spec.profile?.displayName) {
          ctx.output("displayName", entity.spec.profile.displayName);
        }
      }
    } catch (error) {
      if (optional) {
        ctx.output("entity", undefined);
        ctx.output("entityRef", entityRef);
        return;
      }
      throw error;
    }
  },
});
