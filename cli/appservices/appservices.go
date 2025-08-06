// In your existing appservices.go file, add these changes:

package appservices

import (
	// ... your existing imports ...
	"github.com/spf13/cobra"
	// Add this import for the table
	tea "github.com/charmbracelet/bubbletea"
)

// Add a new flag to your Flags struct
type Flags struct {
	// ... your existing flags ...
	output  output.Flags
	id      string
	name    string
	env     string
	verbose bool
	tui     bool  // ADD THIS NEW FLAG
}

func Cmd() *cobra.Command {
	flags := &Flags{}
	cmd := &cobra.Command{
		Use:   "app-services",
		Short: "Gets all app services given a business app",
		Run: func(_ *cobra.Command, _ []string) {
			execute(flags)
		},
	}
	
	// ... existing flag definitions ...
	
	// ADD THIS NEW FLAG
	cmd.Flags().BoolVar(&flags.tui, "tui", false, "Show interactive table UI")
	
	return cmd
}

func execute(flags *Flags) {
	// ... your existing code to get app services ...
	
	// Get the services (this is your existing code)
	id, err := merna.PromptSoleID(flags.id)
	core.ExitIfError(err)
	
	var applicationServices []merna.ApplicationServices
	var cursor *string
	hasNext := true
	
	for hasNext {
		resp, err := merna.GetAppServices(id, cursor)
		core.ExitIfError(err)
		
		// ... error handling ...
		
		if len(errMessages) > 0 {
			core.ErrorMsg(strings.Join(errMessages, "\n"))
		} else {
			okMsg := fmt.Sprintf("Cache successfully created with name \"%s\"", resp.Data.CreateApplicationService.Name)
			core.OkayMsg(okMsg)
		}
		
		applicationServices = append(applicationServices, resp.Data.PaginatedApplicationServices.Results...)
		
		if hasNext {
			cursor = &resp.Data.PaginatedApplicationServices.Cursor
		}
	}
	
	// MODIFIED SECTION: Check if TUI flag is set
	if flags.tui {
		// Use the new Bubble Tea table
		err := ShowInteractiveTable(applicationServices)
		if err != nil {
			core.ExitIfError(err)
		}
	} else {
		// Use your existing table output (unchanged)
		core.StdMsg(fmt.Sprintf("\nTotal technical services: %d", len(applicationServices)))
		flags.output.Print(applicationServices)
	}
}