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

// textInputModel is our bubble tea model for text input
type textInputModel struct {
	textInput textinput.Model
	prompt    string
	alias     string
	err       error
	done      bool
	value     string
}

// Initialize the model
func newTextInputModel(prompt, alias string) textInputModel {
	ti := textinput.New()
	ti.Placeholder = alias
	ti.Focus()
	ti.CharLimit = 156
	ti.Width = 50

	return textInputModel{
		textInput: ti,
		prompt:    prompt,
		alias:     alias,
	}
}

// Init is called once when the program starts
func (m textInputModel) Init() tea.Cmd {
	return textinput.Blink
}

// Update handles all input and updates the model
func (m textInputModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyEnter:
			value := m.textInput.Value()
			if value == "" {
				value = m.alias
			}
			
			// Validation
			err := survey.AskOne(&prompt, &value)
			if err != nil {
				m.err = err
				return m, nil
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
	return m, cmd
}

// View renders the UI
func (m textInputModel) View() string {
	if m.done {
		return ""
	}

	var s strings.Builder
	
	// Prompt
	s.WriteString(promptStyle.Render(m.prompt) + "\n")
	
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

// PromptSoleID - Drop-in replacement for the survey version
func PromptSoleID(prompt string, alias string) (string, error) {
	model := newTextInputModel(prompt, alias)
	
	p := tea.NewProgram(model)
	finalModel, err := p.Run()
	if err != nil {
		return "", err
	}
	
	m := finalModel.(textInputModel)
	if m.value == "" {
		return "", fmt.Errorf("cancelled")
	}
	
	return m.value, nil
}

// For PromptEnv with selection, here's a simple select model
type selectModel struct {
	choices  []string
	cursor   int
	selected string
	prompt   string
	done     bool
}

func newSelectModel(prompt string, choices []string) selectModel {
	return selectModel{
		prompt:  prompt,
		choices: choices,
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

	s := promptStyle.Render(m.prompt) + "\n\n"
	
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

// PromptEnv - Drop-in replacement for environment selection
func PromptEnv(prompt string) (string, error) {
	// Get environments from your survey.Select call
	envs := []string{"test", "prod"}  // You'd fetch these as before
	
	model := newSelectModel(prompt, envs)
	
	p := tea.NewProgram(model)
	finalModel, err := p.Run()
	if err != nil {
		return "", err
	}
	
	m := finalModel.(selectModel)
	if m.selected == "" {
		return "", fmt.Errorf("cancelled")
	}
	
	return m.selected, nil
}