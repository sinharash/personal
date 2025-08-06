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
	promptStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("86")).
		Bold(true)
	
	errorStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("196"))
	
	helpStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("241"))
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
	
	// Label/prompt
	s.WriteString(promptStyle.Render(m.label) + "\n")
	
	// Input field
	s.WriteString(m.textInput.View() + "\n\n")
	
	// Error message if any
	if m.err != nil {
		s.WriteString(errorStyle.Render("✗ " + m.err.Error()) + "\n\n")
	}
	
	// Help text
	s.WriteString(helpStyle.Render("enter: confirm • esc: cancel"))
	
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

	s := promptStyle.Render(m.label) + "\n\n"
	
	for i, choice := range m.choices {
		cursor := "  "
		if m.cursor == i {
			cursor = "> "
			choice = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("86")).Render(choice)
		}
		s += cursor + choice + "\n"
	}
	
	s += "\n" + helpStyle.Render("↑/↓: navigate • enter: select • esc: cancel")
	
	return s
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
	
	// Label/prompt
	s.WriteString(promptStyle.Render(m.label) + "\n")
	
	// Requirements
	if len(m.requirements) > 0 {
		s.WriteString(helpStyle.Render("Requirements:") + "\n")
		for _, req := range m.requirements {
			s.WriteString(helpStyle.Render("  • " + req) + "\n")
		}
		s.WriteString("\n")
	}
	
	// Input field
	s.WriteString(m.textInput.View() + "\n\n")
	
	// Error message if any
	if m.err != nil {
		s.WriteString(errorStyle.Render("✗ " + m.err.Error()) + "\n\n")
	}
	
	// Help text
	s.WriteString(helpStyle.Render("enter: confirm • esc: cancel"))
	
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

	s := promptStyle.Render(m.label) + "\n\n"
	
	for i, choice := range m.choices {
		cursor := "  "
		checked := "[ ]"
		
		if m.selected[i] {
			checked = "[✓]"
		}
		
		if m.cursor == i {
			cursor = "> "
			choice = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("86")).Render(choice)
		}
		
		s += fmt.Sprintf("%s%s %s\n", cursor, checked, choice)
	}
	
	s += "\n" + helpStyle.Render("space: toggle • ↑/↓: navigate • enter: confirm • esc: cancel")
	
	return s
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