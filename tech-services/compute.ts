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
