// packages/backend/src/plugins/scaffolder/module.ts

import {
  coreServices,
  createBackendModule,
} from "@backstage/backend-plugin-api";
import { scaffolderActionsExtensionPoint } from "@backstage/plugin-scaffolder-node/alpha";
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
        scaffolder: scaffolderActionsExtensionPoint,
      },
      init: async ({ config, discovery, scaffolder }) => {
        // Register your existing action
        scaffolder.addActions(
          dataAuroraClusterCreateAction({ config, discovery })
        );

        // Register the new enhanced entity picker actions with discovery API
        scaffolder.addActions(
          resolveEntityFromDisplayAction({ discovery }),
          debugEntityPropertiesAction(),
          extractEntityRefAction({ discovery }),
          extractEmailFromDisplayAction()
        );
      },
    });
  },
});

export { cloudExperienceScaffolderModule };
