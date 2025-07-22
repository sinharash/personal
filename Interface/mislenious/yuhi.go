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