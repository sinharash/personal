// Example of how to use the table component in other commands
// This could be in any of your other command files

package example

import (
	"fmt"
	
	"github.com/charmbracelet/bubbles/table"
	tableui "sfgitlab.opr.statefarm.org/sf/statefarm/pkg/table"
)

// Example 1: Simple usage with string data
func ShowUsersTable(users []User) error {
	// Define columns
	columns := []table.Column{
		{Title: "ID", Width: 10},
		{Title: "Name", Width: 20},
		{Title: "Email", Width: 30},
		{Title: "Role", Width: 15},
	}

	// Convert data to rows
	rows := make([]table.Row, len(users))
	for i, user := range users {
		rows[i] = table.Row{
			user.ID,
			user.Name,
			user.Email,
			user.Role,
		}
	}

	// Show table
	return tableui.ShowTable(tableui.TableConfig{
		Title:   "User List",
		Columns: columns,
		Rows:    rows,
	})
}

// Example 2: Using the helper function for map data
func ShowGenericData(data []map[string]string) error {
	// Define column names
	columnNames := []string{"id", "name", "status", "created"}
	
	// Create column definitions
	columns := make([]table.Column, len(columnNames))
	for i, name := range columnNames {
		columns[i] = table.Column{
			Title: name,
			Width: 20,
		}
	}

	// Use the helper function to convert data
	rows := tableui.DataToRows(data, columnNames)

	// Show table
	return tableui.ShowTable(tableui.TableConfig{
		Title:   fmt.Sprintf("Results (%d items)", len(data)),
		Columns: columns,
		Rows:    rows,
		Width:   90,
		Height:  25,
	})
}

// Example 3: Integrating with existing command flags
func ExecuteWithTableOption(tuiFlag bool, data interface{}) {
	if tuiFlag {
		// Show as table UI
		showAsTable(data)
	} else {
		// Use existing output format
		printNormal(data)
	}
}

// Type definitions for examples
type User struct {
	ID    string
	Name  string
	Email string
	Role  string
}