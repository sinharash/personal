// Package table provides a reusable bubbletea table component
// for displaying tabular data in the terminal with TUI support
package table

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// TableModel wraps the bubbles table with additional functionality
type TableModel struct {
	table  table.Model
	title  string
	width  int
	height int
}

// TableConfig holds configuration for creating a new table
type TableConfig struct {
	Title   string
	Columns []table.Column
	Rows    []table.Row
	Width   int    // Optional: defaults to 80
	Height  int    // Optional: defaults to 20
}

// New creates a new table model with the given configuration
func New(config TableConfig) TableModel {
	// Set defaults if not provided
	if config.Width == 0 {
		config.Width = 80
	}
	if config.Height == 0 {
		config.Height = 20
	}

	// Create the table with default lipgloss styles
	t := table.New(
		table.WithColumns(config.Columns),
		table.WithRows(config.Rows),
		table.WithFocused(true),
		table.WithHeight(config.Height),
		table.WithWidth(config.Width),
	)

	// Apply default lipgloss styles
	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("240")).
		BorderBottom(true).
		Bold(false)
	s.Selected = s.Selected.
		Foreground(lipgloss.Color("229")).
		Background(lipgloss.Color("57")).
		Bold(false)
	t.SetStyles(s)

	return TableModel{
		table:  t,
		title:  config.Title,
		width:  config.Width,
		height: config.Height,
	}
}

// Init implements tea.Model
func (m TableModel) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model
func (m TableModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c", "esc":
			return m, tea.Quit
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.table.SetWidth(msg.Width)
		m.table.SetHeight(msg.Height - 4) // Leave room for title and help
	}
	m.table, cmd = m.table.Update(msg)
	return m, cmd
}

// View implements tea.Model
func (m TableModel) View() string {
	// Title style using lipgloss defaults
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("229")).
		MarginBottom(1)

	// Help text style
	helpStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("241")).
		MarginTop(1)

	// Build the view
	var s strings.Builder
	if m.title != "" {
		s.WriteString(titleStyle.Render(m.title))
		s.WriteString("\n")
	}
	s.WriteString(m.table.View())
	s.WriteString("\n")
	s.WriteString(helpStyle.Render("↑/↓: navigate • q: quit"))
	
	return s.String()
}

// ShowTable is a convenience function to display a table and wait for user interaction
// Returns an error if the table cannot be displayed
func ShowTable(config TableConfig) error {
	model := New(config)
	p := tea.NewProgram(model, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		return fmt.Errorf("error running table: %w", err)
	}
	return nil
}

// Helper function to convert any data to table rows
// This is useful for consistent formatting across different commands
func DataToRows(data []map[string]string, columns []string) []table.Row {
	rows := make([]table.Row, 0, len(data))
	for _, item := range data {
		row := make(table.Row, len(columns))
		for i, col := range columns {
			if val, ok := item[col]; ok {
				row[i] = val
			} else {
				row[i] = ""
			}
		}
		rows = append(rows, row)
	}
	return rows
}