// Package table provides a reusable bubbletea table component
// with borders, mouse support, and pagination
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
	Width          int  // Optional: defaults to 100
	Height         int  // Optional: defaults to 20
	RowsPerPage    int  // Optional: defaults to 10 (0 means no pagination)
	ShowPagination bool // Optional: defaults to true if RowsPerPage > 0
}

// New creates a new table model with the given configuration
func New(config TableConfig) TableModel {
	// Set defaults if not provided
	if config.Width == 0 {
		config.Width = 100
	}
	if config.Height == 0 {
		config.Height = 20
	}
	
	// Setup pagination
	showPagination := config.RowsPerPage > 0
	if config.RowsPerPage == 0 {
		config.RowsPerPage = len(config.Rows) // Show all rows if no pagination
	}
	
	// Calculate table height (leave room for title, borders, and pagination)
	tableHeight := config.Height - 6
	if showPagination {
		tableHeight -= 2
	}
	
	// Get initial page of rows
	displayRows := getPageRows(config.Rows, 0, config.RowsPerPage)

	// Create the table with enhanced styles
	t := table.New(
		table.WithColumns(config.Columns),
		table.WithRows(displayRows),
		table.WithFocused(true),
		table.WithHeight(tableHeight),
		table.WithWidth(config.Width),
	)

	// Apply enhanced styles with borders
	s := table.DefaultStyles()
	
	// Header style with border
	s.Header = s.Header.
		BorderStyle(lipgloss.ThickBorder()).
		BorderForeground(lipgloss.Color("240")).
		BorderBottom(true).
		Foreground(lipgloss.Color("229")).
		Bold(true).
		Align(lipgloss.Center)
	
	// Selected row style
	s.Selected = s.Selected.
		Foreground(lipgloss.Color("229")).
		Background(lipgloss.Color("57")).
		Bold(false)
	
	// Cell style with borders
	s.Cell = s.Cell.
		Padding(0, 1). // Add padding inside cells
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("240"))
	
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

// Init implements tea.Model with mouse support
func (m TableModel) Init() tea.Cmd {
	return tea.EnableMouseCellMotion
}

// Update implements tea.Model with pagination and mouse support
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
	
	case tea.MouseMsg:
		// Handle mouse events for pagination buttons
		if m.showPagination {
			// Check if click is in pagination area (bottom of table)
			if msg.Type == tea.MouseButtonPress {
				// Simple detection for left/right pagination clicks
				// You can refine this based on exact positions
				if msg.Y >= m.height-3 {
					if msg.X < m.width/2 && m.currentPage > 0 {
						// Clicked on left side - previous page
						m.currentPage--
						m.updateTableRows()
					} else if msg.X > m.width/2 && m.hasNextPage() {
						// Clicked on right side - next page
						m.currentPage++
						m.updateTableRows()
					}
				}
			}
		}
		// Pass mouse events to table for row selection
		m.table, cmd = m.table.Update(msg)
		return m, cmd
		
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		tableHeight := msg.Height - 6
		if m.showPagination {
			tableHeight -= 2
		}
		m.table.SetWidth(msg.Width)
		m.table.SetHeight(tableHeight)
	}
	
	m.table, cmd = m.table.Update(msg)
	return m, cmd
}

// View implements tea.Model with bordered table
func (m TableModel) View() string {
	// Define styles
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("229")).
		Width(m.width).
		Align(lipgloss.Center).
		MarginBottom(1)

	// Table container with border
	tableBoxStyle := lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("62")).
		Padding(1, 2).
		Width(m.width)

	// Help text style
	helpStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("241")).
		Width(m.width).
		Align(lipgloss.Center).
		MarginTop(1)

	// Build the view
	var s strings.Builder
	
	// Title
	if m.title != "" {
		s.WriteString(titleStyle.Render(m.title))
		s.WriteString("\n")
	}
	
	// Table with border
	tableContent := m.table.View()
	
	// Add pagination info if enabled
	if m.showPagination {
		tableContent += "\n" + m.renderPagination()
	}
	
	s.WriteString(tableBoxStyle.Render(tableContent))
	
	// Help text
	helpText := "↑/↓: navigate rows • "
	if m.showPagination {
		helpText += "←/→: change page • "
	}
	helpText += "mouse: click to select • q: quit"
	s.WriteString("\n")
	s.WriteString(helpStyle.Render(helpText))
	
	return s.String()
}

// renderPagination creates the pagination controls
func (m TableModel) renderPagination() string {
	// Calculate range
	startRow := m.currentPage*m.rowsPerPage + 1
	endRow := startRow + len(m.table.Rows()) - 1
	
	// Pagination style
	paginationStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("241")).
		Width(m.width - 6). // Account for table padding
		Align(lipgloss.Center)
	
	// Button styles
	activeButtonStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("229")).
		Bold(true).
		Padding(0, 1)
	
	disabledButtonStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("238")).
		Padding(0, 1)
	
	// Create pagination display
	var leftArrow, rightArrow string
	
	if m.currentPage > 0 {
		leftArrow = activeButtonStyle.Render("◀ Previous")
	} else {
		leftArrow = disabledButtonStyle.Render("◀ Previous")
	}
	
	if m.hasNextPage() {
		rightArrow = activeButtonStyle.Render("Next ▶")
	} else {
		rightArrow = disabledButtonStyle.Render("Next ▶")
	}
	
	pageInfo := fmt.Sprintf("  %d-%d of %d  ", startRow, endRow, m.totalRows)
	
	// Center the page info with arrows on sides
	pagination := leftArrow + 
		lipgloss.NewStyle().
			Width(m.width - 30).
			Align(lipgloss.Center).
			Render(pageInfo) + 
		rightArrow
	
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
	// Enable mouse support and use alt screen
	p := tea.NewProgram(
		model, 
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(), // Enable mouse support
	)
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