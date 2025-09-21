package model

import "time"

// FileItem represents a file or folder in the virtual file system
type FileItem struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Type         string    `json:"type"` // "file" or "folder"
	FileType     string    `json:"fileType,omitempty"` // "markdown", "database", "canvas", "html", "code"
	Path         string    `json:"path"`
	ParentID     string    `json:"parentId,omitempty"`
	Children     []string  `json:"children,omitempty"`
	IsExpanded   bool      `json:"isExpanded,omitempty"`
	Content      string    `json:"content,omitempty"`
	IsDirty      bool      `json:"isDirty,omitempty"`
	LastModified time.Time `json:"lastModified,omitempty"`
}

// WebSocketMessage represents the structure of WebSocket messages
type WebSocketMessage struct {
	Type  string      `json:"type"`
	ID    string      `json:"id,omitempty"`
	Data  interface{} `json:"data,omitempty"`
	Error string      `json:"error,omitempty"`
}

// FileOperationMessage represents file operation requests
type FileOperationMessage struct {
	Type      string    `json:"type"`
	ID        string    `json:"id,omitempty"`
	Operation string    `json:"operation"` // "create", "delete", "rename", "move", "update-content"
	File      *FileItem `json:"file,omitempty"`
	Path      string    `json:"path,omitempty"`
	Content   string    `json:"content,omitempty"`
	OldPath   string    `json:"oldPath,omitempty"`
	NewPath   string    `json:"newPath,omitempty"`
}

// FileWatchMessage represents file system change notifications
type FileWatchMessage struct {
	Type    string `json:"type"`
	Event   string `json:"event"` // "created", "deleted", "modified", "renamed", "moved"
	Path    string `json:"path"`
	OldPath string `json:"oldPath,omitempty"`
	Content string `json:"content,omitempty"`
}

// FileSystemTree represents the complete file system structure
type FileSystemTree struct {
	Files     map[string]*FileItem `json:"files"`
	RootItems []string             `json:"rootItems"`
}

// CreateFileRequest represents a file creation request
type CreateFileRequest struct {
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required,oneof=file folder"`
	FileType string `json:"fileType,omitempty"`
	ParentID string `json:"parentId,omitempty"`
	Content  string `json:"content,omitempty"`
}

// UpdateFileRequest represents a file update request
type UpdateFileRequest struct {
	Name    string `json:"name,omitempty"`
	Content string `json:"content,omitempty"`
}

// MoveFileRequest represents a file move request
type MoveFileRequest struct {
	NewParentID string `json:"newParentId,omitempty"`
	NewPath     string `json:"newPath" binding:"required"`
}