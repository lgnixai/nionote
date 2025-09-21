package main

import (
	"log"
	"obsidian-backend/internal/config"
	"obsidian-backend/internal/handler"
	"obsidian-backend/internal/middleware"
	"obsidian-backend/internal/service"
	"obsidian-backend/pkg/filesystem"
	"obsidian-backend/pkg/websocket"
	"strings"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg := config.Load()
	
	// Set Gin mode
	if !cfg.Debug {
		gin.SetMode(gin.ReleaseMode)
	}
	
	// Initialize file system
	fs := filesystem.NewAferoFileSystem(cfg.WorkspaceDir)
	if err := fs.LoadTree(); err != nil {
		log.Printf("Warning: Failed to load existing tree: %v", err)
	}
	
	// Initialize WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()
	
	// Initialize services
	fileService := service.NewFileService(fs, hub)
	
	// Initialize handlers
	fileHandler := handler.NewFileHandler(fileService)
	wsHandler := handler.NewWebSocketHandler(hub, fileService)
	
	// Initialize Gin router
	router := gin.New()
	
	// Add middleware
	router.Use(gin.Recovery())
	if cfg.Debug {
		router.Use(middleware.LoggingMiddleware())
	}
	
	// Parse CORS origins
	corsOrigins := strings.Split(cfg.CORSOrigins[0], ",")
	router.Use(middleware.CORSMiddleware(corsOrigins))
	
	// WebSocket endpoint
	router.GET("/ws", wsHandler.HandleWebSocket)
	
	// API routes
	api := router.Group("/api/v1")
	{
		// File operations
		files := api.Group("/files")
		{
			files.GET("/tree", fileHandler.GetTree)
			files.POST("", fileHandler.CreateFile)
			files.PUT("/:id", fileHandler.UpdateFile)
			files.DELETE("/:id", fileHandler.DeleteFile)
			files.POST("/:id/move", fileHandler.MoveFile)
			files.GET("/:id/content", fileHandler.GetFileContent)
		}
	}
	
	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "healthy",
			"clients": hub.GetClientCount(),
		})
	})
	
	// Start server
	address := cfg.Host + ":" + cfg.Port
	log.Printf("Starting Obsidian Backend Server on %s", address)
	log.Printf("WebSocket endpoint: ws://%s/ws", address)
	log.Printf("API endpoint: http://%s/api/v1", address)
	log.Printf("Workspace directory: %s", cfg.WorkspaceDir)
	
	if err := router.Run(address); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}