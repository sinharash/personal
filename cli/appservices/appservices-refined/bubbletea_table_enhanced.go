// Package table provides a reusable bubbletea table component
// with clean borders and pagination
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
	table         table.Model
	title         string
	width         int
	height        int
	allRows       []table.Row  // Store all rows for pagination
	currentPage   int
	rowsPerPage   int
	totalRows     int
	showPagination bool
}

// TableConfig holds configuration for creating a new table
type TableConfig struct {
	Title          string
	Columns        []table.Column
	Rows           []table.Row
	Width          int  // Optional: defaults to auto-calculate based on columns
	Height         int  // Optional: defaults to 20
	RowsPerPage    int  // Optional: defaults to 10 (0 means no pagination)
	ShowPagination bool // Optional: defaults to true if RowsPerPage > 0
}

// New creates a new table model with the given configuration
func New(config TableConfig) TableModel {
	// Calculate total width needed if not provided
	if config.Width == 0 {
		totalWidth := 0
		for _, col := range config.Columns {
			totalWidth += col.Width
		}
		// Add some padding for borders and margins
		config.Width = totalWidth + len(config.Columns) + 10
	}
	
	// Set height default
	if config.Height == 0 {
		config.Height = 20
	}
	
	// Setup pagination
	showPagination := config.RowsPerPage > 0
	if config.RowsPerPage == 0 {
		config.RowsPerPage = len(config.Rows) // Show all rows if no pagination
	}
	
	// Calculate table height (leave room for title, borders, and pagination)
	tableHeight := config.Height - 4
	if showPagination {
		tableHeight -= 3
	}
	
	// Get initial page of rows
	displayRows := getPageRows(config.Rows, 0, config.RowsPerPage)

	// Create the table with clean styles
	t := table.New(
		table.WithColumns(config.Columns),
		table.WithRows(displayRows),
		table.WithFocused(true),
		table.WithHeight(tableHeight),
	)

	// Apply clean table styles - no individual cell borders
	s := table.DefaultStyles()
	
	// Header style - bold with bottom border only
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("240")).
		BorderBottom(true).
		BorderTop(false).
		BorderLeft(false).
		BorderRight(false).
		Foreground(lipgloss.Color("229")).
		Bold(true)
	
	// Selected row style - highlight entire row
	s.Selected = s.Selected.
		Foreground(lipgloss.Color("229")).
		Background(lipgloss.Color("57")).
		Bold(false)
	
	t.SetStyles(s)

	return TableModel{
		table:          t,
		title:          config.Title,
		width:          config.Width,
		height:         config.Height,
		allRows:        config.Rows,
		currentPage:    0,
		rowsPerPage:    config.RowsPerPage,
		totalRows:      len(config.Rows),
		showPagination: showPagination,
	}
}

// Init implements tea.Model
func (m TableModel) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model with pagination support
func (m TableModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c", "esc":
			return m, tea.Quit
		case "left", "h", "pgup":
			// Previous page
			if m.showPagination && m.currentPage > 0 {
				m.currentPage--
				m.updateTableRows()
			}
		case "right", "l", "pgdown":
			// Next page
			if m.showPagination && m.hasNextPage() {
				m.currentPage++
				m.updateTableRows()
			}
		}
		
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		tableHeight := msg.Height - 4
		if m.showPagination {
			tableHeight -= 3
		}
		m.table.SetHeight(tableHeight)
	}
	
	m.table, cmd = m.table.Update(msg)
	return m, cmd
}

// View implements tea.Model with clean bordered table
func (m TableModel) View() string {
	// Define styles
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("229")).
		Width(m.width).
		Align(lipgloss.Center).
		MarginBottom(1)

	// Simple border style for the entire table
	tableBorderStyle := lipgloss.NewStyle().
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("240")).
		Width(m.width)

	// Help text style
	helpStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("241")).
		Width(m.width).
		Align(lipgloss.Center).
		MarginTop(1)

	// Build the view
	var content strings.Builder
	
	// Title
	if m.title != "" {
		content.WriteString(titleStyle.Render(m.title))
		content.WriteString("\n")
	}
	
	// Table content
	tableView := m.table.View()
	
	// Add pagination if enabled
	if m.showPagination {
		paginationView := m.renderPagination()
		// Combine table and pagination in the bordered box
		tableWithPagination := tableView + "\n\n" + paginationView
		content.WriteString(tableBorderStyle.Render(tableWithPagination))
	} else {
		// Just the table in the bordered box
		content.WriteString(tableBorderStyle.Render(tableView))
	}
	
	// Help text
	helpText := "↑/↓: navigate rows • "
	if m.showPagination {
		helpText += "←/→: change page • "
	}
	helpText += "q: quit"
	content.WriteString("\n")
	content.WriteString(helpStyle.Render(helpText))
	
	return content.String()
}

// renderPagination creates the pagination controls
func (m TableModel) renderPagination() string {
	// Calculate range
	startRow := m.currentPage*m.rowsPerPage + 1
	endRow := startRow + len(m.table.Rows()) - 1
	
	// Button styles
	activeButtonStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("229")).
		Bold(true)
	
	disabledButtonStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("238"))
	
	// Create pagination display
	var leftArrow, rightArrow, pageInfo string
	
	if m.currentPage > 0 {
		leftArrow = activeButtonStyle.Render("◄ Previous")
	} else {
		leftArrow = disabledButtonStyle.Render("◄ Previous")
	}
	
	if m.hasNextPage() {
		rightArrow = activeButtonStyle.Render("Next ►")
	} else {
		rightArrow = disabledButtonStyle.Render("Next ►")
	}
	
	pageInfo = fmt.Sprintf("%d-%d of %d", startRow, endRow, m.totalRows)
	
	// Create centered pagination with proper spacing
	paginationStyle := lipgloss.NewStyle().
		Width(m.width - 4).
		Align(lipgloss.Center)
	
	// Build pagination line with proper spacing
	pagination := fmt.Sprintf("%s          %s          %s", leftArrow, pageInfo, rightArrow)
	
	return paginationStyle.Render(pagination)
}

// Helper methods for pagination
func (m *TableModel) hasNextPage() bool {
	return (m.currentPage+1)*m.rowsPerPage < m.totalRows
}

func (m *TableModel) updateTableRows() {
	displayRows := getPageRows(m.allRows, m.currentPage, m.rowsPerPage)
	m.table.SetRows(displayRows)
	m.table.SetCursor(0) // Reset cursor to top of new page
}

// getPageRows returns the rows for a specific page
func getPageRows(allRows []table.Row, page, rowsPerPage int) []table.Row {
	start := page * rowsPerPage
	end := start + rowsPerPage
	
	if start >= len(allRows) {
		return []table.Row{}
	}
	
	if end > len(allRows) {
		end = len(allRows)
	}
	
	return allRows[start:end]
}

// ShowTable is a convenience function to display a table and wait for user interaction
func ShowTable(config TableConfig) error {
	model := New(config)
	// Use alt screen for clean display
	p := tea.NewProgram(model, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		return fmt.Errorf("error running table: %w", err)
	}
	return nil
}

// Helper function to convert any data to table rows
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

// CreateColumns is a helper to quickly create columns with consistent width
func CreateColumns(names []string, width int) []table.Column {
	columns := make([]table.Column, len(names))
	for i, name := range names {
		columns[i] = table.Column{
			Title: name,
			Width: width,
		}
	}
	return columns
}