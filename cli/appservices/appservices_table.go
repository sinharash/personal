// appservices_table.go - Put this in cmd/merna/get/appservices/ folder
package appservices

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/lipgloss"
)

// Table styles
var (
	// Base table style
	baseStyle = lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("240"))

	// Title style
	titleStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("86")).
		MarginLeft(1).
		MarginBottom(1)

	// Selected row style
	selectedStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("229")).
		Background(lipgloss.Color("57")).
		Bold(true)

	// Header style
	headerStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("86")).
		Bold(true).
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("240")).
		BorderBottom(true)

	// Cell style
	cellStyle = lipgloss.NewStyle().
		Padding(0, 1)

	// Help style
	helpStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("241")).
		MarginTop(1)

	// Info style for showing selected item details
	infoStyle = lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("62")).
		Padding(1).
		MarginTop(1)
)

type appServiceTableModel struct {
	table        table.Model
	services     []merna.ApplicationServices  // Your app services data
	width        int
	height       int
	showDetails  bool
}

// Initialize the table model with app services data
func NewAppServiceTable(services []merna.ApplicationServices) appServiceTableModel {
	// Define columns
	columns := []table.Column{
		{Title: "TYPE", Width: 15},
		{Title: "NAME", Width: 30},
		{Title: "ID", Width: 15},
		{Title: "ENV", Width: 10},
		{Title: "CURSOR", Width: 20},
	}

	// Convert services to rows
	rows := []table.Row{}
	for _, service := range services {
		cursor := service.Cursor
		if cursor == "" {
			cursor = "-"
		}
		
		env := strings.ToUpper(service.Env)
		serviceType := getServiceType(service)  // You'll need to implement this based on your logic
		
		row := table.Row{
			serviceType,
			service.Name,
			fmt.Sprintf("%d", service.ID),
			env,
			cursor,
		}
		rows = append(rows, row)
	}

	// Create the table
	t := table.New(
		table.WithColumns(columns),
		table.WithRows(rows),
		table.WithFocused(true),
		table.WithHeight(15),
	)

	// Style the table
	s := table.DefaultStyles()
	s.Header = headerStyle
	s.Selected = selectedStyle
	s.Cell = cellStyle
	t.SetStyles(s)

	return appServiceTableModel{
		table:    t,
		services: services,
	}
}

func (m appServiceTableModel) Init() tea.Cmd {
	return nil
}

func (m appServiceTableModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.table.SetHeight(msg.Height - 10) // Leave room for title and help
		
	case tea.KeyMsg:
		switch msg.String() {
		case "esc", "q", "ctrl+c":
			return m, tea.Quit
		case "enter", " ":
			m.showDetails = !m.showDetails
		case "?":
			// Toggle help
		}
	}
	
	m.table, cmd = m.table.Update(msg)
	return m, cmd
}

func (m appServiceTableModel) View() string {
	var s strings.Builder
	
	// Title
	title := titleStyle.Render("🚀 Application Services")
	s.WriteString(title + "\n\n")
	
	// Table
	tableView := baseStyle.Render(m.table.View())
	s.WriteString(tableView + "\n")
	
	// Show details of selected row if enabled
	if m.showDetails && m.table.Cursor() < len(m.services) {
		selected := m.services[m.table.Cursor()]
		details := m.renderDetails(selected)
		s.WriteString(details + "\n")
	}
	
	// Help
	help := helpStyle.Render("↑↓ navigate • ↵ toggle details • q quit • ? help")
	s.WriteString(help)
	
	return s.String()
}

func (m appServiceTableModel) renderDetails(service merna.ApplicationServices) string {
	var details strings.Builder
	
	details.WriteString(lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("86")).Render("📋 Service Details") + "\n\n")
	
	details.WriteString(fmt.Sprintf("  %s %s\n", 
		lipgloss.NewStyle().Bold(true).Render("Name:"), 
		service.Name))
	
	details.WriteString(fmt.Sprintf("  %s %d\n", 
		lipgloss.NewStyle().Bold(true).Render("ID:"), 
		service.ID))
		
	details.WriteString(fmt.Sprintf("  %s %s\n", 
		lipgloss.NewStyle().Bold(true).Render("Environment:"), 
		strings.ToUpper(service.Env)))
	
	if service.Cursor != "" {
		details.WriteString(fmt.Sprintf("  %s %s\n", 
			lipgloss.NewStyle().Bold(true).Render("Cursor:"), 
			service.Cursor))
	}
	
	if service.HasNext {
		details.WriteString(fmt.Sprintf("  %s %s\n", 
			lipgloss.NewStyle().Bold(true).Render("Has More:"), 
			lipgloss.NewStyle().Foreground(lipgloss.Color("42")).Render("Yes")))
	}
	
	return infoStyle.Render(details.String())
}

// Helper function to determine service type
func getServiceType(service merna.ApplicationServices) string {
	// Implement your logic here based on how you determine the type
	// This is just a placeholder
	return "Service"
}

// ShowInteractiveTable - Call this from your command when --tui flag is set
func ShowInteractiveTable(services []merna.ApplicationServices) error {
	model := NewAppServiceTable(services)
	p := tea.NewProgram(model, tea.WithAltScreen())
	
	_, err := p.Run()
	return err
}