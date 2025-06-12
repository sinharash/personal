// packages/backend/src/plugins/scaffolder/module.ts

import {
  coreServices,
  createBackendModule,
} from "@backstage/backend-plugin-api";
import { scaffolderActionsExtensionPoint } from "@backstage/plugin-scaffolder-node/alpha";
import { catalogServiceRef } from "@backstage/plugin-catalog-node/alpha";
import { dataAuroraClusterCreateAction } from "./actions/dataAuroraClusterCreate";
import {
  resolveEntityFromDisplayAction,
  debugEntityPropertiesAction,
  extractEntityRefAction,
  extractEmailFromDisplayAction,
} from "./actions/enhancedEntityActions";

const cloudExperienceScaffolderModule = createBackendModule({
  moduleId: "cloud-experience",
  pluginId: "scaffolder",
  register({ registerInit }) {
    registerInit({
      deps: {
        config: coreServices.rootConfig,
        discovery: coreServices.discovery,
        catalog: catalogServiceRef, // Add catalog service dependency
        scaffolder: scaffolderActionsExtensionPoint,
      },
      init: async ({ config, discovery, catalog, scaffolder }) => {
        // Register your existing action
        scaffolder.addActions(
          dataAuroraClusterCreateAction({ config, discovery })
        );

        // Register the new enhanced entity picker actions with catalog service
        scaffolder.addActions(
          resolveEntityFromDisplayAction({ catalogApi: catalog }),
          debugEntityPropertiesAction(),
          extractEntityRefAction({ catalogApi: catalog }),
          extractEmailFromDisplayAction()
        );
      },
    });
  },
});

export { cloudExperienceScaffolderModule };
