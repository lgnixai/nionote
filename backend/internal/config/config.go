package config

import (
	"os"
	"strconv"
)

// Config holds the application configuration
type Config struct {
	Port         string
	Host         string
	WorkspaceDir string
	CORSOrigins  []string
	Debug        bool
}

// Load loads configuration from environment variables with defaults
func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "8080"),
		Host:         getEnv("HOST", "localhost"),
		WorkspaceDir: getEnv("WORKSPACE_DIR", "./workspace"),
		CORSOrigins:  []string{getEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")},
		Debug:        getEnvBool("DEBUG", true),
	}
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvBool gets a boolean environment variable with a default value
func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}