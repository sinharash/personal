import { createTemplateAction } from "@backstage/plugin-scaffolder-node";
import {
  Environment,
  ExperienceOrchestrationSdk,
} from "@backstage/plugin/cloud-experience-common";

type CreateComputeActionOptions = {
  sdk: ExperienceOrchestrationSdk;
};

function createCompute(options: CreateComputeActionOptions) {
  const { sdk } = options;

  return createTemplateAction({
    id: "cloud-experience:compute:create",
    supportsDryRun: true,
    schema: {
      input: {
        businessApplicationId: (z) => z.string(),
        name: (z) => z.string(),
        token: (z) => z.string(),
        // Optional fields
        sourceRepoId: (z) => z.string().optional(),
        java: (z) => z.boolean().optional(),
        createConfigMap: (z) => z.boolean().optional(),
        internetEnabled: (z) => z.boolean().optional(),
        existingSourceBranchName: (z) => z.string().optional(),
        skipExistingFileUpdates: (z) => z.boolean().optional(),
      },
      output: {
        name: (z) => z.string(),
        environment: (z) => z.string(),
        repoUrl: (z) => z.string().optional(),
      },
    },

    handler: async (ctx) => {
      if (ctx.isDryRun) {
        ctx.logger.info("🏃 This is a dry run, no action will be taken...");
        return;
      }

      ctx.logger.info(
        `📋 ${ctx.user?.entity?.spec?.profile?.displayName} (${ctx.user?.entity?.metadata?.annotations?.["solms-id"]}) is requesting to provision compute...`
      );

      // Build the capability object
      const capability = {
        compute: {
          rosApp: {} as any, // Type assertion to allow dynamic properties
        },
      };

      // Add existingSourceRepo if sourceRepoId is provided
      if (ctx.input.sourceRepoId && ctx.input.sourceRepoId.trim() !== "") {
        capability.compute.rosApp.existingSourceRepo = Number(
          ctx.input.sourceRepoId
        );
      }

      // Add configuration options to rosApp
      if (ctx.input.java) {
        capability.compute.rosApp.appType = "java";
      }

      if (ctx.input.createConfigMap) {
        capability.compute.rosApp.createConfigMap = true;
      }

      if (ctx.input.internetEnabled) {
        capability.compute.rosApp.internetEnabled = true;
      }

      // Add GitLab automation fields if provided (only when sourceRepoId exists)
      if (ctx.input.sourceRepoId && ctx.input.sourceRepoId.trim() !== "") {
        if (
          ctx.input.existingSourceBranchName &&
          ctx.input.existingSourceBranchName.trim() !== ""
        ) {
          capability.compute.rosApp.existingSourceBranchName =
            ctx.input.existingSourceBranchName;
        }

        if (ctx.input.skipExistingFileUpdates) {
          capability.compute.rosApp.skipExistingFileUpdates = true;
        }
      }

      const call = await sdk.mutate.createCompute.send({
        businessApplicationId: ctx.input.businessApplicationId,
        capability,
        environment: Environment.TEST, // Hardcoded to TEST
        name: ctx.input.name,
        token: ctx.input.token,
        dryRun: ctx.isDryRun,
        headers: {
          Authorization: `Bearer ${ctx.input.token}`,
        },
        signal: ctx.signal,
      });

      if (call.errors && Array.isArray(call.errors) && call.errors.length > 0) {
        call.errors.forEach((err: any, idx: number) => {
          const reasons = Array.isArray(err.reason)
            ? err.reason.join("; ")
            : err.reason;
          ctx.logger.error(`GraphQL error [${idx}]: ${reasons}`);
        });
        throw new Error(
          `Request to provision compute failed: ${call.errors
            .map((err: any) =>
              Array.isArray(err.reason) ? err.reason.join("; ") : err.reason
            )
            .join("; ")}`
        );
      }

      ctx.logger.info("✅ Compute creation API call successful");
      ctx.logger.info(
        `Compute creation response: ${JSON.stringify(call.data, null, 2)}`
      );

      if (call.data) {
        ctx.logger.info(
          `🚀 Provisioning compute ${call.data.createApplicationService.capability} has started:`
        );
        ctx.output("name", call.data.createApplicationService.name);
        ctx.output(
          "environment",
          call.data.createApplicationService.environment
        );

        // Output repository URL if available
        if (call.data.createApplicationService.repoUrl) {
          ctx.output("repoUrl", call.data.createApplicationService.repoUrl);
        }
      } else {
        ctx.logger.error("No data returned from compute creation API call.");
      }
    },
  });
}

export { createCompute };

>>>>>>>>>>>>>>>>>>.

import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  Environment,
  ExperienceOrchestrationSdk,
} from '@backstage/plugin/cloud-experience-common';

type CreateComputeActionOptions = {
  sdk: ExperienceOrchestrationSdk;
};

function createCompute(options: CreateComputeActionOptions) {
  const { sdk } = options;

  return createTemplateAction({
    id: 'cloud-experience:compute:create',
    supportsDryRun: true,
    schema: {
      input: {
        name: z => z.string(),
        token: z => z.string(),
        // Optional fields
        sourceRepoId: z => z.string().optional(),
        java: z => z.boolean().optional(),
        createConfigMap: z => z.boolean().optional(),
        internetEnabled: z => z.boolean().optional(),
        existingSourceBranchName: z => z.string().optional(),
        skipExistingFileUpdates: z => z.boolean().optional(),
      },
      output: {
        name: z => z.string(),
        environment: z => z.string(),
        repoUrl: z => z.string().optional(),
      },
    },
    
    handler: async (ctx) => {
      if (ctx.isDryRun) {
        ctx.logger.info('This is a dry run, no action will be taken...');
        return;
      }

      ctx.logger.info(
        `${ctx.user?.entity?.spec?.profile?.displayName} (${ctx.user?.entity?.metadata?.annotations?.['solms-id']}) is requesting to provision compute...`
      );

      const call = await sdk.mutate.createCompute.send({
        name: ctx.input.name,
        environment: Environment.TEST,
        capability: {
          compute: {
            rosApp: {
              // Add existingSourceRepo if sourceRepoId is provided
              ...(ctx.input.sourceRepoId && ctx.input.sourceRepoId.trim() !== '' && {
                existingSourceRepo: Number(ctx.input.sourceRepoId)
              }),
              
              // Add configuration options
              ...(ctx.input.java && { appType: 'java' }),
              ...(ctx.input.createConfigMap && { createConfigMap: true }),
              ...(ctx.input.internetEnabled && { internetEnabled: true }),
              
              // Add GitLab automation fields (only when sourceRepoId exists)
              ...(ctx.input.sourceRepoId && ctx.input.sourceRepoId.trim() !== '' && ctx.input.existingSourceBranchName && {
                existingSourceBranchName: ctx.input.existingSourceBranchName
              }),
              ...(ctx.input.sourceRepoId && ctx.input.sourceRepoId.trim() !== '' && ctx.input.skipExistingFileUpdates && {
                skipExistingFileUpdates: true
              })
            }
          }
        },
        token: ctx.input.token,
        dryRun: ctx.isDryRun,
        headers: {
          Authorization: `Bearer ${ctx.input.token}`,
        },
        signal: ctx.signal,
      });

      if (call.errors && Array.isArray(call.errors) && call.errors.length > 0) {
        call.errors.forEach((err: any, idx: number) => {
          const reasons = Array.isArray(err.reason) ? err.reason.join('; ') : err.reason;
          ctx.logger.error(`GraphQL error [${idx}]: ${reasons}`);
        });
        throw new Error(
          `Request to provision compute failed: ${call.errors
            .map((err: any) => (Array.isArray(err.reason) ? err.reason.join('; ') : err.reason))
            .join('; ')}`
        );
      }

      ctx.logger.info('Compute creation API call successful');
      ctx.logger.info(`Compute creation response: ${JSON.stringify(call.data, null, 2)}`);

      if (call.data) {
        ctx.logger.info(`Provisioning compute ${call.data.createApplicationService.capability} has started:`);
        ctx.output('name', call.data.createApplicationService.name);
        ctx.output('environment', call.data.createApplicationService.environment);
        
        if (call.data.createApplicationService.repoUrl) {
          ctx.output('repoUrl', call.data.createApplicationService.repoUrl);
        }
      } else {
        ctx.logger.error('No data returned from compute creation API call.');
      }
    },
  });
}

export { createCompute };

>>>>>>>>>>>>>>
Thrid


import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  Environment,
  ExperienceOrchestrationSdk,
} from '@backstage/plugin/cloud-experience-common';

type CreateComputeActionOptions = {
  sdk: ExperienceOrchestrationSdk;
};

function createCompute(options: CreateComputeActionOptions) {
  const { sdk } = options;

  return createTemplateAction({
    id: 'cloud-experience:compute:create',
    supportsDryRun: true,
    schema: {
      input: {
        businessApplicationId: z => z.string(),
        name: z => z.string(),
        token: z => z.string(),
        // Optional fields
        sourceRepoId: z => z.string().optional(),
        appType: z => z.boolean().optional(),
        createConfigMap: z => z.boolean().optional(),
        internetEnabled: z => z.boolean().optional(),
        existingSourceBranchName: z => z.string().optional(),
        skipExistingFileUpdates: z => z.boolean().optional(),
      },
      output: {
        name: z => z.string(),
        environment: z => z.string(),
      },
    },
    
    handler: async (ctx) => {
      if (ctx.isDryRun) {
        ctx.logger.info('This is a dry run, no action will be taken...');
        return;
      }

      ctx.logger.info(
        `${ctx.user?.entity?.spec?.profile?.displayName} (${ctx.user?.entity?.metadata?.annotations?.['solms-id']}) is requesting to provision compute...`
      );

      const call = await sdk.mutate.createCompute.send({
        businessApplicationId: ctx.input.businessApplicationId,
        name: ctx.input.name,
        environment: Environment.TEST,
        capability: {
          compute: {
            rosApp: {
              // Add existingSourceRepo if sourceRepoId is provided
              ...(ctx.input.sourceRepoId && ctx.input.sourceRepoId.trim() !== '' && {
                existingSourceRepo: Number(ctx.input.sourceRepoId)
              }),
              
              // Add appType as "JAVA" (caps) when true, null when false
              appType: ctx.input.appType ? "JAVA" : null,
              
              // Add configuration options as booleans/null
              createConfigMap: ctx.input.createConfigMap || null,
              internetEnabled: ctx.input.internetEnabled || null,
              
              // Add GitLab automation fields (only when sourceRepoId exists)
              existingSourceBranch: (ctx.input.sourceRepoId && ctx.input.sourceRepoId.trim() !== '' && ctx.input.existingSourceBranchName) ? ctx.input.existingSourceBranchName : null,
              
              skipFileUpdates: (ctx.input.sourceRepoId && ctx.input.sourceRepoId.trim() !== '' && ctx.input.skipExistingFileUpdates) || null,
              
              sourceId: null
            }
          }
        },
        token: ctx.input.token,
        dryRun: ctx.isDryRun,
        headers: {
          Authorization: `Bearer ${ctx.input.token}`,
        },
        signal: ctx.signal,
      });

      if (call.errors && Array.isArray(call.errors) && call.errors.length > 0) {
        call.errors.forEach((err: any, idx: number) => {
          const reasons = Array.isArray(err.reason) ? err.reason.join('; ') : err.reason;
          ctx.logger.error(`GraphQL error [${idx}]: ${reasons}`);
        });
        throw new Error(
          `Request to provision compute failed: ${call.errors
            .map((err: any) => (Array.isArray(err.reason) ? err.reason.join('; ') : err.reason))
            .join('; ')}`
        );
      }

      ctx.logger.info('Compute creation API call successful');
      ctx.logger.info(`Compute creation response: ${JSON.stringify(call.data, null, 2)}`);

      if (call.data) {
        ctx.logger.info(`Provisioning compute ${call.data.createApplicationService.capability} has started:`);
        ctx.output('name', call.data.createApplicationService.name);
        ctx.output('environment', call.data.createApplicationService.environment);
      } else {
        ctx.logger.error('No data returned from compute creation API call.');
      }
    },
  });
}

export { createCompute };

>>>>>>>

fourth

import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import {
  Environment,
  ExperienceOrchestrationSdk,
} from '@backstage/plugin/cloud-experience-common';

type CreateComputeActionOptions = {
  sdk: ExperienceOrchestrationSdk;
};

function createCompute(options: CreateComputeActionOptions) {
  const { sdk } = options;

  return createTemplateAction({
    id: 'cloud-experience:compute:create',
    supportsDryRun: true,
    schema: {
      input: {
        businessApplicationId: z => z.string(),
        name: z => z.string(),
        token: z => z.string(),
        // Optional fields
        sourceRepoId: z => z.string().optional(),
        appType: z => z.boolean().optional(),
        createConfigMap: z => z.boolean().optional(),
        internetEnabled: z => z.boolean().optional(),
        cidrsToAllowAccessFrom: z => z.string().optional(),
        existingSourceBranchName: z => z.string().optional(),
        skipExistingFileUpdates: z => z.boolean().optional(),
      },
      output: {
        name: z => z.string(),
        environment: z => z.string(),
      },
    },
    
    handler: async (ctx) => {
      if (ctx.isDryRun) {
        ctx.logger.info('This is a dry run, no action will be taken...');
        return;
      }

      ctx.logger.info(
        `${ctx.user?.entity?.spec?.profile?.displayName} (${ctx.user?.entity?.metadata?.annotations?.['solms-id']}) is requesting to provision compute...`
      );

      const call = await sdk.mutate.createCompute.send({
        businessApplicationId: ctx.input.businessApplicationId,
        name: ctx.input.name,
        environment: Environment.TEST,
        capability: {
          compute: {
            rosApp: {
              // Add existingSourceRepo if sourceRepoId is provided
              ...(ctx.input.sourceRepoId && ctx.input.sourceRepoId.trim() !== '' && {
                existingSourceRepo: Number(ctx.input.sourceRepoId)
              }),
              
              // Add appType as "JAVA" (caps) when true, false when false
              appType: ctx.input.appType ? "JAVA" : false,
              
              // Add configuration options as booleans
              createConfigMap: ctx.input.createConfigMap || false,
              internetEnabled: ctx.input.internetEnabled || false,
              
              // Add sourceIp (maps from cidrsToAllowAccessFrom form field)
              sourceIp: ctx.input.cidrsToAllowAccessFrom || null,
              
              // Add GitLab automation fields (only when sourceRepoId exists)
              existingSourceBranch: (ctx.input.sourceRepoId && ctx.input.sourceRepoId.trim() !== '' && ctx.input.existingSourceBranchName) ? ctx.input.existingSourceBranchName : false,
              
              skipFileUpdates: (ctx.input.sourceRepoId && ctx.input.sourceRepoId.trim() !== '' && ctx.input.skipExistingFileUpdates) || false
            }
          }
        },
        token: ctx.input.token,
        dryRun: ctx.isDryRun,
        headers: {
          Authorization: `Bearer ${ctx.input.token}`,
        },
        signal: ctx.signal,
      });

      if (call.errors && Array.isArray(call.errors) && call.errors.length > 0) {
        call.errors.forEach((err: any, idx: number) => {
          const reasons = Array.isArray(err.reason) ? err.reason.join('; ') : err.reason;
          ctx.logger.error(`GraphQL error [${idx}]: ${reasons}`);
        });
        throw new Error(
          `Request to provision compute failed: ${call.errors
            .map((err: any) => (Array.isArray(err.reason) ? err.reason.join('; ') : err.reason))
            .join('; ')}`
        );
      }

      ctx.logger.info('Compute creation API call successful');
      ctx.logger.info(`Compute creation response: ${JSON.stringify(call.data, null, 2)}`);

      if (call.data) {
        ctx.logger.info(`Provisioning compute ${call.data.createApplicationService.capability} has started:`);
        ctx.output('name', call.data.createApplicationService.name);
        ctx.output('environment', call.data.createApplicationService.environment);
      } else {
        ctx.logger.error('No data returned from compute creation API call.');
      }
    },
  });
}

export { createCompute };

>>>>>>>>>>>>
Fifth 

add below 
handler: async (ctx) => {
  // Log all input values immediately when action runs
  ctx.logger.info('=== FORM INPUT VALUES ===');
  ctx.logger.info(`businessApplicationId: ${ctx.input.businessApplicationId}`);
  ctx.logger.info(`name: ${ctx.input.name}`);
  ctx.logger.info(`sourceRepoId: ${ctx.input.sourceRepoId}`);
  ctx.logger.info(`appType: ${ctx.input.appType}`);
  ctx.logger.info(`createConfigMap: ${ctx.input.createConfigMap}`);
  ctx.logger.info(`internetEnabled: ${ctx.input.internetEnabled}`);
  ctx.logger.info(`cidrsToAllowAccessFrom: ${ctx.input.cidrsToAllowAccessFrom}`);
  ctx.logger.info(`existingSourceBranchName: ${ctx.input.existingSourceBranchName}`);
  ctx.logger.info(`skipExistingFileUpdates: ${ctx.input.skipExistingFileUpdates}`);
  ctx.logger.info('=== END INPUT VALUES ===');

  // Your existing code continues...