package appservices

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/table"
	"github.com/spf13/cobra"
	"sfgitlab.opr.statefarm.org/sf/statefarm/cmd/merna/create"
	"sfgitlab.opr.statefarm.org/sf/statefarm/cmd/merna/del"
	"sfgitlab.opr.statefarm.org/sf/statefarm/cmd/merna/get"
	"sfgitlab.opr.statefarm.org/sf/statefarm/cmd/merna/update"
	"sfgitlab.opr.statefarm.org/sf/statefarm/pkg/core"
	"sfgitlab.opr.statefarm.org/sf/statefarm/pkg/merna"
	"sfgitlab.opr.statefarm.org/sf/statefarm/pkg/output"
	tableui "sfgitlab.opr.statefarm.org/sf/statefarm/pkg/table" // Import the table package
)

type Flags struct {
	output.Flags
	id     string
	tui    bool // Add TUI flag
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

	flags.output.Bind(cmd, output.TypeJSON, output.TypeYaml, output.TypeTable)
	flags.output.SetDefaultFormat(output.TypeTable)
	// default query output to "." for jq
	flags.output.QueryString = "."

	// Add the TUI flag
	cmd.Flags().BoolVar(&flags.tui, "tui", false, "Display results in interactive table UI")
	cmd.Flags().StringVarP(&flags.id, "id", "i", "", "The SOLID ID of the business application")

	return cmd
}

func execute(flags *Flags) {
	id, err := merna.PromptSolmaID(flags.id)
	core.ExitIfError(err)

	var applicationServices []merna.ApplicationServices
	var cursor *string
	hasNext := true

	// Collect all app services (pagination logic remains the same)
	for hasNext {
		resp, err := merna.GetAppServices(id, cursor)
		core.ExitIfError(err)

		// Check for errors using the common error handling function from merna
		errMessages := merna.HandleErrors(resp.Errors)
		if len(errMessages) > 0 {
			core.ErrorMsg(strings.Join(errMessages, "\n"))
			return
		}

		applicationServices = append(applicationServices, resp.Data.PaginatedApplicationServices...)

		// Check if there are more app services
		hasNext = resp.Data.PaginatedApplicationServices.HasNext
		if hasNext {
			cursor = &resp.Data.PaginatedApplicationServices.Cursor
		}
	}

	// If TUI flag is set, display in table UI
	if flags.tui {
		displayTableUI(applicationServices)
		return
	}

	// Otherwise, use the existing output format
	core.StdMsg(fmt.Sprintf("\nTotal technical services: %d", len(applicationServices)))
	flags.output.Print(applicationServices)
}

// displayTableUI shows the app services in an interactive table
func displayTableUI(services []merna.ApplicationServices) {
	if len(services) == 0 {
		fmt.Println("No application services found")
		return
	}

	// Define table columns
	columns := []table.Column{
		{Title: "Name", Width: 30},
		{Title: "ID", Width: 15},
		{Title: "Type", Width: 20},
		{Title: "Status", Width: 15},
		{Title: "Environment", Width: 15},
	}

	// Convert services to table rows
	rows := make([]table.Row, 0, len(services))
	for _, svc := range services {
		// Extract relevant fields - adjust based on your ApplicationServices struct
		// This is an example - modify based on actual fields in your struct
		row := table.Row{
			getFieldValue(svc, "Name"),
			getFieldValue(svc, "ID"),
			getFieldValue(svc, "Type"),
			getFieldValue(svc, "Status"),
			getFieldValue(svc, "Environment"),
		}
		rows = append(rows, row)
	}

	// Create and show the table
	config := tableui.TableConfig{
		Title:   fmt.Sprintf("Application Services (Total: %d)", len(services)),
		Columns: columns,
		Rows:    rows,
		Width:   100,
		Height:  20,
	}

	if err := tableui.ShowTable(config); err != nil {
		core.ExitIfError(err)
	}
}

// Helper function to safely extract field values
// Modify this based on your actual ApplicationServices struct
func getFieldValue(svc merna.ApplicationServices, field string) string {
	// This is a placeholder - replace with actual field access
	// For example:
	// switch field {
	// case "Name":
	//     return svc.Name
	// case "ID":
	//     return svc.ID
	// default:
	//     return ""
	// }
	
	// For now, returning a placeholder
	return fmt.Sprintf("%s-value", field)
}