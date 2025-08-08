// Example showing all enhanced table features
package main

import (
	"fmt"
	"log"
	
	"github.com/charmbracelet/bubbles/table"
	tableui "sfgitlab.opr.statefarm.org/sf/statefarm/pkg/table"
)

func main() {
	// Example 1: Simple table with pagination
	showBasicTableWithPagination()
	
	// Example 2: Large dataset with mouse support
	// showLargeDataset()
}

func showBasicTableWithPagination() {
	// Define columns with proper widths
	columns := []table.Column{
		{Title: "Service Name", Width: 30},
		{Title: "Type", Width: 15},
		{Title: "Status", Width: 12},
		{Title: "Environment", Width: 12},
		{Title: "Port", Width: 8},
		{Title: "Health", Width: 10},
	}
	
	// Create sample data (15 rows to demonstrate pagination)
	rows := []table.Row{
		{"auth-service-v2", "REST API", "✓ Active", "Production", "8080", "Healthy"},
		{"user-management", "gRPC", "✓ Active", "Production", "9090", "Healthy"},
		{"payment-gateway", "REST API", "✓ Active", "Production", "8081", "Healthy"},
		{"notification-service", "WebSocket", "✓ Active", "Production", "8082", "Healthy"},
		{"analytics-engine", "Batch", "⚠ Idle", "Production", "8083", "Warning"},
		{"report-generator", "Batch", "✓ Active", "Production", "8084", "Healthy"},
		{"cache-service", "Redis", "✓ Active", "Production", "6379", "Healthy"},
		{"search-indexer", "ElasticSearch", "✓ Active", "Production", "9200", "Healthy"},
		{"file-storage", "S3", "✓ Active", "Production", "8085", "Healthy"},
		{"email-sender", "SMTP", "✓ Active", "Production", "587", "Healthy"},
		{"audit-logger", "Kafka", "✓ Active", "Production", "9092", "Healthy"},
		{"session-manager", "Redis", "✓ Active", "Production", "6380", "Healthy"},
		{"rate-limiter", "In-Memory", "✓ Active", "Production", "8086", "Healthy"},
		{"image-processor", "Worker", "✗ Stopped", "Staging", "8087", "Down"},
		{"backup-service", "Cron", "⚠ Idle", "Production", "8088", "Warning"},
	}
	
	// Show table with pagination (10 rows per page)
	err := tableui.ShowTable(tableui.TableConfig{
		Title:          "Microservices Dashboard",
		Columns:        columns,
		Rows:           rows,
		Width:          100,
		Height:         20,
		RowsPerPage:    10, // Will show "1-10 of 15" with navigation
		ShowPagination: true,
	})
	
	if err != nil {
		log.Fatal(err)
	}
}

func showLargeDataset() {
	// Example with more data
	columns := tableui.CreateColumns(
		[]string{"ID", "Name", "Department", "Role", "Status"}, 
		18, // uniform width
	)
	
	// Generate 50 rows of sample data
	var rows []table.Row
	departments := []string{"Engineering", "Sales", "Marketing", "Support", "DevOps"}
	roles := []string{"Senior", "Junior", "Lead", "Manager", "Intern"}
	statuses := []string{"Active", "On Leave", "Remote", "In Office"}
	
	for i := 1; i <= 50; i++ {
		row := table.Row{
			fmt.Sprintf("EMP%04d", i),
			fmt.Sprintf("Employee %d", i),
			departments[i%5],
			roles[i%5],
			statuses[i%4],
		}
		rows = append(rows, row)
	}
	
	// Display with pagination
	err := tableui.ShowTable(tableui.TableConfig{
		Title:          fmt.Sprintf("Employee Directory (%d total)", len(rows)),
		Columns:        columns,
		Rows:           rows,
		Width:          100,
		Height:         25,
		RowsPerPage:    15, // Show 15 at a time
		ShowPagination: true,
	})
	
	if err != nil {
		log.Fatal(err)
	}
}

// Example: Table without pagination for small datasets
func showCompactTable() {
	columns := []table.Column{
		{Title: "Metric", Width: 20},
		{Title: "Value", Width: 15},
		{Title: "Change", Width: 12},
	}
	
	rows := []table.Row{
		{"CPU Usage", "45%", "↑ +5%"},
		{"Memory", "2.3 GB", "↓ -100MB"},
		{"Disk I/O", "120 MB/s", "→ 0%"},
		{"Network", "50 Mbps", "↑ +10%"},
	}
	
	// No pagination for small datasets
	err := tableui.ShowTable(tableui.TableConfig{
		Title:       "System Metrics",
		Columns:     columns,
		Rows:        rows,
		Width:       60,
		Height:      15,
		RowsPerPage: 0, // 0 means show all rows, no pagination
	})
	
	if err != nil {
		log.Fatal(err)
	}
}