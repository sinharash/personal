// packages/backend/src/plugins/scaffolder/module.ts

import {
  coreServices,
  createBackendModule,
} from "@backstage/backend-plugin-api";
import { scaffolderActionsExtensionPoint } from "@backstage/plugin-scaffolder-node/alpha";
import { dataAuroraClusterCreateAction } from "./actions/dataAuroraClusterCreate";
import {
  resolveEntityFromDisplayAction,
  resolveEntityUsingCatalogFetchAction,
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
        scaffolder: scaffolderActionsExtensionPoint,
      },
      init: async ({ config, discovery, scaffolder }) => {
        // Register your existing action
        scaffolder.addActions(
          dataAuroraClusterCreateAction({ config, discovery })
        );

        // Register the enhanced entity picker actions with extensive debugging
        scaffolder.addActions(
          resolveEntityFromDisplayAction({ discovery }), // Original with debug logs
          resolveEntityUsingCatalogFetchAction(), // Alternative approach
          debugEntityPropertiesAction(),
          extractEntityRefAction(), // Simplified without HTTP calls
          extractEmailFromDisplayAction()
        );
      },
    });
  },
});

export { cloudExperienceScaffolderModule };
