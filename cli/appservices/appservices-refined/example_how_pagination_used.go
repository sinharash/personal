// Test file to verify the table displays correctly
package main

import (
	"fmt"
	"log"
	
	"github.com/charmbracelet/bubbles/table"
	tableui "sfgitlab.opr.statefarm.org/sf/statefarm/pkg/table"
)

func main() {
	testAppServicesTable()
}

func testAppServicesTable() {
	// Match the exact structure from your appservices
	columns := []table.Column{
		{Title: "Name", Width: 30},
		{Title: "Type", Width: 15},
		{Title: "Capability", Width: 15},
		{Title: "Status", Width: 12},
		{Title: "Environment", Width: 12},
		{Title: "Created By", Width: 15},
	}
	
	// Sample data matching your ApplicationServices structure
	rows := []table.Row{
		{"cloud-experience-t-asdfasd", "ELASTICACHE", "CACHE", "PROVISIONING", "TEST", "XB39"},
		{"cloud-experience-t-rash-cache", "ELASTICACHE", "CACHE", "PROVISIONING", "TEST", "FFN7"},
		{"cloud-experience-t-rash-cache1", "ELASTICACHE", "CACHE", "PROVISIONING", "TEST", "FFN7"},
		{"cloud-experience-t-test", "CACHE", "ELASTICACHE", "DEPROVISIONED", "TEST", "XB39"},
		{"cloud-experience-t-userApi123", "CACHE", "ELASTICACHE", "PROVISIONING", "TEST", "FFN7"},
		{"dillon-f2c2", "SECRET", "API_KEY", "INVOCATION_ERROR", "TEST", "F2C2"},
		{"r322-api", "SECRET", "API_KEY", "PROVISIONING", "TEST", "FFN7"},
		{"tannertest1", "COMPUTE", "BODA_APP", "PROVISIONING", "TEST", "XB39"},
		{"tannertest2", "SECRET", "ACCESS_TOKEN", "DEPROVISIONED", "TEST", "XB39"},
		{"test", "SECRET", "ACCESS_TOKEN", "DEPROVISIONED", "TEST", "XB39"},
		{"testapp", "COMPUTE", "BODA_APP", "PROVISIONED", "TEST", "XB39"},
		{"test-service-alpha", "CACHE", "REDIS", "ACTIVE", "PROD", "ABC1"},
		{"test-service-beta", "DATABASE", "POSTGRES", "ACTIVE", "PROD", "DEF2"},
		{"test-service-gamma", "COMPUTE", "LAMBDA", "INACTIVE", "DEV", "GHI3"},
		{"test-service-delta", "STORAGE", "S3", "ACTIVE", "STAGING", "JKL4"},
	}
	
	// Display with pagination (10 rows per page, so will show page controls)
	err := tableui.ShowTable(tableui.TableConfig{
		Title:          fmt.Sprintf("Total technical services: %d", len(rows)),
		Columns:        columns,
		Rows:           rows,
		RowsPerPage:    10,
		ShowPagination: true,
	})
	
	if err != nil {
		log.Fatal(err)
	}
}

// Alternative test with simpler data
func testSimpleTable() {
	columns := []table.Column{
		{Title: "ID", Width: 10},
		{Title: "Service", Width: 25},
		{Title: "Status", Width: 12},
		{Title: "Type", Width: 15},
	}
	
	rows := []table.Row{
		{"001", "authentication-service", "Active", "REST API"},
		{"002", "user-management", "Active", "gRPC"},
		{"003", "payment-gateway", "Active", "REST API"},
		{"004", "notification-service", "Inactive", "WebSocket"},
		{"005", "analytics-engine", "Active", "Batch"},
		{"006", "report-generator", "Active", "Batch"},
		{"007", "cache-service", "Active", "Redis"},
	}
	
	// Display without pagination for small dataset
	err := tableui.ShowTable(tableui.TableConfig{
		Title:          "Service Overview",
		Columns:        columns,
		Rows:           rows,
		RowsPerPage:    0, // No pagination
		ShowPagination: false,
	})
	
	if err != nil {
		log.Fatal(err)
	}
}