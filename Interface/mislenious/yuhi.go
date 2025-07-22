// Add this comprehensive debugging to getTerraformTool()

func getTerraformTool(cmd *cobra.Command) string {
	core.StdMsg("=== DEBUGGING COMMAND STRUCTURE ===")
	
	// Debug the current command
	core.StdMsg("Current cmd.Name(): '" + cmd.Name() + "'")
	core.StdMsg("Current cmd.CalledAs(): '" + cmd.CalledAs() + "'")
	core.StdMsg("Current cmd.Use: '" + cmd.Use + "'")
	
	// Debug the parent command
	parentCmd := cmd.Parent()
	if parentCmd == nil {
		core.StdMsg("ERROR: No parent command found!")
		return "terraform"
	}
	
	core.StdMsg("Parent cmd.Name(): '" + parentCmd.Name() + "'")
	core.StdMsg("Parent cmd.CalledAs(): '" + parentCmd.CalledAs() + "'")
	core.StdMsg("Parent cmd.Use: '" + parentCmd.Use + "'")
	
	if len(parentCmd.Aliases) > 0 {
		core.StdMsg("Parent aliases: " + strings.Join(parentCmd.Aliases, ", "))
	} else {
		core.StdMsg("Parent has NO aliases!")
	}
	
	// Debug the root command
	rootCmd := cmd.Root()
	core.StdMsg("Root cmd.Name(): '" + rootCmd.Name() + "'")
	core.StdMsg("Root cmd.CalledAs(): '" + rootCmd.CalledAs() + "'")
	
	// Debug os.Args to see what was actually typed
	core.StdMsg("os.Args: " + strings.Join(os.Args, " "))
	
	core.StdMsg("=== END DEBUG ===")
	
	// Get the name that was used - CalledAs() can be empty, so fallback to Name()
	calledAs := parentCmd.CalledAs()
	core.StdMsg("DEBUG calledAs: '" + calledAs + "'")
	
	if calledAs == "" {
		core.StdMsg("DEBUG Inside if statement - calledAs was empty")
		calledAs = parentCmd.Name() // Use the main command name as fallback
		core.StdMsg("DEBUG After fallback, calledAs: '" + calledAs + "'")
	}
	
	// Map aliases to actual tools
	switch calledAs {
	case "terraform", "tf":
		core.StdMsg("DEBUG Selected: terraform")
		return "terraform"
	case "tofu":
		core.StdMsg("DEBUG Selected: tofu")
		return "tofu"
	default:
		core.StdMsg("DEBUG Hit default case with calledAs: '" + calledAs + "'")
		// Default fallback - check which is available
		if isCommandAvailable("tofu") {
			core.StdMsg("DEBUG Default fallback: tofu")
			return "tofu"
		} else if isCommandAvailable("terraform") {
			core.StdMsg("DEBUG Default fallback: terraform")
			return "terraform"
		}
		core.StdMsg("DEBUG Final fallback: terraform")
		return "terraform"
	}
}

>>>>>>>>>>>>>.
After fixing thinking that calledAs not working 

// getTerraformTool detects which tool to use based on os.Args since CalledAs() doesn't work
func getTerraformTool(cmd *cobra.Command) string {
	// Since CalledAs() is not working properly, parse os.Args directly
	if len(os.Args) >= 2 {
		// os.Args[0] = binary path
		// os.Args[1] = terraform command or alias (terraform, tf, tofu)
		// os.Args[2] = subcommand (lock)
		
		terraformCommand := os.Args[1]
		core.StdMsg("DEBUG - Detected command from os.Args[1]: '" + terraformCommand + "'")
		
		switch terraformCommand {
		case "terraform", "tf":
			core.StdMsg("DEBUG Selected: terraform")
			return "terraform"
		case "tofu":
			core.StdMsg("DEBUG Selected: tofu")
			return "tofu"
		default:
			core.StdMsg("DEBUG Hit default case with command: '" + terraformCommand + "'")
			// Default fallback - check which is available
			if isCommandAvailable("tofu") {
				core.StdMsg("DEBUG Default fallback: tofu")
				return "tofu"
			} else if isCommandAvailable("terraform") {
				core.StdMsg("DEBUG Default fallback: terraform")
				return "terraform"
			}
			return "terraform"
		}
	}
	
	// Fallback if os.Args parsing fails
	core.StdMsg("DEBUG - Could not parse os.Args, using fallback")
	if isCommandAvailable("tofu") {
		return "tofu"
	}
	return "terraform"
}

// Updated execute function with simpler display logic
func execute(cmd *cobra.Command, flags *Flags) {
	if !terraform.IsLockFileSupported() {
		core.ErrorMsg("Terraform lock file generation requires Terraform 0.14+ or OpenTofu")
		return
	}

	// Get the tool that user intended to use
	tool := getTerraformTool(cmd)
	
	// Get the command name from os.Args for display
	commandUsed := "unknown"
	if len(os.Args) >= 2 {
		commandUsed = os.Args[1]
	}
	
	core.StdMsg("Using " + tool + " (detected from command " + commandUsed + ")")

	if flags.reset {
		core.WarnMsg("Cleaning existing generated terraform files...")
		terraform.CleanTerraform()
	}

	core.WarnMsg("Removing existing lock file...")
	err := removeLockFile()
	if err != nil {
		core.StdMsg("Could not remove existing lock file: " + err.Error())
	}

	// Step 1. Initial init with -backend=false
	err = terraform.RunInitWithTool(tool)
	core.ExitIfError(err)

	// Step 2. Generate multi-platform lock file
	core.WarnMsg("Generating new lock file for multiple platforms...")
	err = terraform.GenerateIacLockWithTool(tool)
	core.ExitIfError(err)

	// Step 3. Final init to validate
	core.WarnMsg("Finalizing initialization with new lock file...")
	err = terraform.RunInitWithTool(tool)
	core.ExitIfError(err)

	core.OkayMsg("Successfully created terraform lock file.")
}