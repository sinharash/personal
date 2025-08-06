package merna

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/lipgloss"
)

// Styles using lipgloss
var (
	// Title/prompt style with nice padding
	promptStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("86")).
		Bold(true).
		MarginBottom(1)
	
	// Container style with rounded border
	containerStyle = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("62")).
		Padding(1, 2).
		MarginTop(1).
		MarginBottom(1)
	
	// Active input container (when focused)
	activeContainerStyle = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("86")).
		Padding(1, 2).
		MarginTop(1).
		MarginBottom(1)
	
	// Error style with icon
	errorStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("196")).
		Bold(true).
		PaddingLeft(1)
	
	// Success style
	successStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("42")).
		Bold(true)
	
	// Help text style
	helpStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("241")).
		Italic(true)
	
	// Selected item style
	selectedStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("86")).
		Bold(true)
	
	// Checkbox styles
	checkboxStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("86"))
	
	// Requirements box style
	requirementsStyle = lipgloss.NewStyle().
		Border(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("239")).
		Padding(0, 1).
		MarginBottom(1)
)

// textInputModel for simple text input prompts
type textInputModel struct {
	textInput textinput.Model
	label     string
	err       error
	done      bool
	value     string
}

// Initialize text input model
func newTextInputModel(label string, defaultValue string) textInputModel {
	ti := textinput.New()
	if defaultValue != "" {
		ti.SetValue(defaultValue)
	}
	ti.Focus()
	ti.CharLimit = 156
	ti.Width = 50

	return textInputModel{
		textInput: ti,
		label:     label,
	}
}

func (m textInputModel) Init() tea.Cmd {
	return textinput.Blink
}

func (m textInputModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyEnter:
			m.value = m.textInput.Value()
			m.done = true
			return m, tea.Quit
			
		case tea.KeyCtrlC, tea.KeyEsc:
			m.done = true
			return m, tea.Quit
		}
	}

	m.textInput, cmd = m.textInput.Update(msg)
	return m, cmd
}

func (m textInputModel) View() string {
	if m.done {
		return ""
	}

	var s strings.Builder
	
	// Title
	s.WriteString(promptStyle.Render("📝 " + m.label) + "\n")
	
	// Input field in a bordered container
	inputContent := m.textInput.View()
	s.WriteString(activeContainerStyle.Render(inputContent) + "\n")
	
	// Error message if any
	if m.err != nil {
		s.WriteString(errorStyle.Render("✗ " + m.err.Error()) + "\n\n")
	}
	
	// Help text
	s.WriteString(helpStyle.Render("↵ confirm • esc cancel") + "\n")
	
	return s.String()
}

// PromptSoleID - matches your current function signature
// Takes the id from flags as parameter
func PromptSoleID(id string) (string, error) {
	prompt := "Enter the sole ID of business application:"
	
	model := newTextInputModel(prompt, id)
	
	p := tea.NewProgram(model)
	finalModel, err := p.Run()
	if err != nil {
		return "", err
	}
	
	m := finalModel.(textInputModel)
	if !m.done || m.value == "" {
		return "", fmt.Errorf("cancelled")
	}
	
	// Here you would add your validation logic
	// For example, checking if the sole ID exists
	
	return m.value, nil
}

// selectModel for selection prompts
type selectModel struct {
	choices  []string
	cursor   int
	selected string
	label    string
	done     bool
}

func newSelectModel(label string, choices []string, defaultChoice string) selectModel {
	cursor := 0
	// Set cursor to default choice if provided
	for i, choice := range choices {
		if choice == defaultChoice {
			cursor = i
			break
		}
	}
	
	return selectModel{
		label:   label,
		choices: choices,
		cursor:  cursor,
	}
}

func (m selectModel) Init() tea.Cmd {
	return nil
}

func (m selectModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.choices)-1 {
				m.cursor++
			}
		case "enter", " ":
			m.selected = m.choices[m.cursor]
			m.done = true
			return m, tea.Quit
		case "q", "esc", "ctrl+c":
			m.done = true
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m selectModel) View() string {
	if m.done {
		return ""
	}

	var s strings.Builder
	
	// Title with icon
	s.WriteString(promptStyle.Render("🔹 " + m.label) + "\n")
	
	// Build choices list
	var choices strings.Builder
	for i, choice := range m.choices {
		cursor := "  "
		choiceText := choice
		
		if m.cursor == i {
			cursor = lipgloss.NewStyle().Foreground(lipgloss.Color("86")).Render("▶ ")
			choiceText = selectedStyle.Render(choice)
		} else {
			choiceText = lipgloss.NewStyle().Foreground(lipgloss.Color("252")).Render(choice)
		}
		
		choices.WriteString(cursor + choiceText)
		if i < len(m.choices)-1 {
			choices.WriteString("\n")
		}
	}
	
	// Render choices in a bordered container
	s.WriteString(activeContainerStyle.Render(choices.String()) + "\n")
	
	// Help text
	s.WriteString(helpStyle.Render("↑↓ navigate • ↵ select • esc cancel") + "\n")
	
	return s.String()
}

// PromptEnv - matches your current function signature
func PromptEnv(env string) (string, error) {
	prompt := "Enter the environment of the resource:"
	
	// You would fetch these from your actual environment list
	// This is just example data
	environments := []string{"test", "prod"}
	
	model := newSelectModel(prompt, environments, env)
	
	p := tea.NewProgram(model)
	finalModel, err := p.Run()
	if err != nil {
		return "", err
	}
	
	m := finalModel.(selectModel)
	if !m.done || m.selected == "" {
		return "", fmt.Errorf("cancelled")
	}
	
	// Convert to uppercase as per original implementation
	return strings.ToUpper(m.selected), nil
}

// Type definition to match your existing code
type NameValidator func(string) bool

// PromptName - matches your signature with bool validator
func PromptName(name string, requirements []string, isNameValid NameValidator) (string, error) {
	prompt := "Enter the name of the cache:"
	
	// Create a custom model with validation
	model := newNameInputModel(prompt, name, requirements, isNameValid)
	
	p := tea.NewProgram(model)
	finalModel, err := p.Run()
	if err != nil {
		return "", err
	}
	
	m := finalModel.(nameInputModel)
	if !m.done || m.value == "" {
		return "", fmt.Errorf("cancelled")
	}
	
	return m.value, nil
}

// nameInputModel with validation support
type nameInputModel struct {
	textInput    textinput.Model
	label        string
	requirements []string
	validator    NameValidator  // Changed to NameValidator type
	err          error
	done         bool
	value        string
}

func newNameInputModel(label, defaultValue string, requirements []string, validator NameValidator) nameInputModel {
	ti := textinput.New()
	if defaultValue != "" {
		ti.SetValue(defaultValue)
	}
	ti.Focus()
	ti.CharLimit = 156
	ti.Width = 50

	return nameInputModel{
		textInput:    ti,
		label:        label,
		requirements: requirements,
		validator:    validator,
	}
}

func (m nameInputModel) Init() tea.Cmd {
	return textinput.Blink
}

func (m nameInputModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyEnter:
			value := m.textInput.Value()
			
			// Run validation - validator returns bool
			if m.validator != nil {
				if !m.validator(value) {
					m.err = fmt.Errorf("invalid name format")
					return m, nil
				}
			}
			
			m.value = value
			m.done = true
			return m, tea.Quit
			
		case tea.KeyCtrlC, tea.KeyEsc:
			m.done = true
			return m, tea.Quit
		}
	}

	m.textInput, cmd = m.textInput.Update(msg)
	
	// Clear error when user types
	if m.err != nil {
		m.err = nil
	}
	
	return m, cmd
}

func (m nameInputModel) View() string {
	if m.done {
		return ""
	}

	var s strings.Builder
	
	// Title with icon
	s.WriteString(promptStyle.Render("✏️  " + m.label) + "\n")
	
	// Requirements in a bordered box
	if len(m.requirements) > 0 {
		var reqText strings.Builder
		reqText.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("243")).Bold(true).Render("Requirements:") + "\n")
		for i, req := range m.requirements {
			reqText.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("250")).Render("  • " + req))
			if i < len(m.requirements)-1 {
				reqText.WriteString("\n")
			}
		}
		s.WriteString(requirementsStyle.Render(reqText.String()) + "\n")
	}
	
	// Input field in a bordered container
	inputContent := m.textInput.View()
	if m.err != nil {
		s.WriteString(containerStyle.Copy().BorderForeground(lipgloss.Color("196")).Render(inputContent) + "\n")
		s.WriteString(errorStyle.Render("✗ " + m.err.Error()) + "\n\n")
	} else {
		s.WriteString(activeContainerStyle.Render(inputContent) + "\n")
	}
	
	// Help text
	s.WriteString(helpStyle.Render("↵ confirm • esc cancel") + "\n")
	
	return s.String()
}

// PromptForCacheRegions - for multi-select of regions
func PromptForCacheRegions() ([]string, error) {
	regions := []string{"us-east-1", "us-west-2"}
	model := newMultiSelectModel("Select the cache region(s):", regions)
	
	p := tea.NewProgram(model)
	finalModel, err := p.Run()
	if err != nil {
		return nil, err
	}
	
	m := finalModel.(multiSelectModel)
	if !m.done {
		return nil, fmt.Errorf("cancelled")
	}
	
	selected := m.getSelected()
	if len(selected) == 0 {
		return nil, fmt.Errorf("at least one region must be selected")
	}
	
	return selected, nil
}

// multiSelectModel for selecting multiple options
type multiSelectModel struct {
	choices  []string
	selected map[int]bool
	cursor   int
	label    string
	done     bool
}

func newMultiSelectModel(label string, choices []string) multiSelectModel {
	return multiSelectModel{
		label:    label,
		choices:  choices,
		selected: make(map[int]bool),
	}
}

func (m multiSelectModel) Init() tea.Cmd {
	return nil
}

func (m multiSelectModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.choices)-1 {
				m.cursor++
			}
		case " ", "x":
			// Toggle selection
			if m.selected[m.cursor] {
				delete(m.selected, m.cursor)
			} else {
				m.selected[m.cursor] = true
			}
		case "enter":
			m.done = true
			return m, tea.Quit
		case "q", "esc", "ctrl+c":
			m.done = true
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m multiSelectModel) View() string {
	if m.done {
		return ""
	}

	var s strings.Builder
	
	// Title with icon
	s.WriteString(promptStyle.Render("📋 " + m.label + " (Multi-select)") + "\n")
	
	// Build choices list with checkboxes
	var choices strings.Builder
	for i, choice := range m.choices {
		cursor := "  "
		checkbox := "☐"
		choiceStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("252"))
		
		if m.selected[i] {
			checkbox = checkboxStyle.Render("☑")
			choiceStyle = successStyle  // Make selected items green
		} else {
			checkbox = lipgloss.NewStyle().Foreground(lipgloss.Color("239")).Render("☐")
		}
		
		if m.cursor == i {
			cursor = lipgloss.NewStyle().Foreground(lipgloss.Color("86")).Bold(true).Render("▶ ")
			if !m.selected[i] {
				choiceStyle = selectedStyle  // Only use selected style if not already selected
			}
		}
		
		choices.WriteString(fmt.Sprintf("%s%s %s", cursor, checkbox, choiceStyle.Render(choice)))
		if i < len(m.choices)-1 {
			choices.WriteString("\n")
		}
	}
	
	// Render choices in a bordered container
	s.WriteString(activeContainerStyle.Render(choices.String()) + "\n")
	
	// Show selected count
	selectedCount := len(m.getSelected())
	if selectedCount > 0 {
		s.WriteString(successStyle.Render(fmt.Sprintf("✓ %d selected", selectedCount)) + "\n\n")
	} else {
		s.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("214")).Render("⚠️  No items selected") + "\n\n")
	}
	
	// Help text
	if selectedCount == 0 {
		s.WriteString(helpStyle.Render("⚠️  Press SPACE to select items, then ENTER to confirm") + "\n")
	} else {
		s.WriteString(helpStyle.Render("SPACE toggle • ↑↓ navigate • ENTER confirm selection • ESC cancel") + "\n")
	}
	
	return s.String()
}

func (m multiSelectModel) getSelected() []string {
	var result []string
	for i, choice := range m.choices {
		if m.selected[i] {
			result = append(result, choice)
		}
	}
	return result
}