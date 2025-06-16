// packages/backend/src/plugins/scaffolder/module.ts

import {
  coreServices,
  createBackendModule,
} from "@backstage/backend-plugin-api";
import { scaffolderActionsExtensionPoint } from "@backstage/plugin-scaffolder-node/alpha";
import { dataAuroraClusterCreateAction } from "./actions/dataAuroraClusterCreate";
import { resolveEntityFromDisplayAction } from "./actions/enhancedEntityActions";

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

        // Register the enhanced entity picker action (requires metadata.name)
        scaffolder.addActions(resolveEntityFromDisplayAction());
      },
    });
  },
});

export { cloudExperienceScaffolderModule };

// // packages/backend/src/plugins/scaffolder/module.ts

// import {
//     coreServices,
//     createBackendModule,
//   } from "@backstage/backend-plugin-api";
//   import { scaffolderActionsExtensionPoint } from "@backstage/plugin-scaffolder-node/alpha";
//   import { dataAuroraClusterCreateAction } from "./actions/dataAuroraClusterCreate";
//   import { resolveEntityFromDisplayAction } from "./actions/enhancedEntityActions";

//   const cloudExperienceScaffolderModule = createBackendModule({
//     moduleId: "cloud-experience",
//     pluginId: "scaffolder",
//     register({ registerInit }) {
//       registerInit({
//         deps: {
//           config: coreServices.rootConfig,
//           discovery: coreServices.discovery,
//           scaffolder: scaffolderActionsExtensionPoint,
//         },
//         init: async ({ config, discovery, scaffolder }) => {
//           // Register your existing action
//           scaffolder.addActions(
//             dataAuroraClusterCreateAction({ config, discovery })
//           );

//           // Register the enhanced entity picker action WITH discovery service
//           scaffolder.addActions(resolveEntityFromDisplayAction({ discovery }));
//         },
//       });
//     },
//   });

//   export { cloudExperienceScaffolderModule };
