package appservices

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/table"
	"github.com/spf13/cobra"
	
	tableui "/pkg/table" // Import the table package
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

	// Define table columns with appropriate widths
	columns := []table.Column{
		{Title: "Name", Width: 30},
		{Title: "Type", Width: 15},
		{Title: "Capability", Width: 15},
		{Title: "Status", Width: 12},
		{Title: "Environment", Width: 12},
		{Title: "Created By", Width: 15},
	}

	// Convert services to table rows
	rows := make([]table.Row, 0, len(services))
	for _, svc := range services {
		row := table.Row{
			truncateString(svc.Name, 30),
			truncateString(svc.Type, 15),
			truncateString(svc.Capability, 15),
			truncateString(svc.Status, 12),
			truncateString(svc.Environment, 12),
			truncateString(svc.CreatedBy, 15),
		}
		rows = append(rows, row)
	}

	// Create and show the table with pagination
	config := tableui.TableConfig{
		Title:          fmt.Sprintf("Application Services (Total: %d)", len(services)),
		Columns:        columns,
		Rows:           rows,
		// Width auto-calculates based on column widths
		Height:         25,
		RowsPerPage:    10,  // Show 10 rows per page
		ShowPagination: true,
	}

	if err := tableui.ShowTable(config); err != nil {
		core.ExitIfError(err)
	}
}

// Helper function to truncate long strings for table display
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}