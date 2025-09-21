package service

import (
	"fmt"
	"obsidian-backend/internal/model"
	"obsidian-backend/pkg/filesystem"
	"obsidian-backend/pkg/websocket"
	"path/filepath"
	"time"
)

// FileService handles file operations and business logic
type FileService struct {
	fs  *filesystem.AferoFileSystem
	hub *websocket.Hub
}

// NewFileService creates a new FileService instance
func NewFileService(fs *filesystem.AferoFileSystem, hub *websocket.Hub) *FileService {
	return &FileService{
		fs:  fs,
		hub: hub,
	}
}

// GetFileTree returns the complete file system tree
func (s *FileService) GetFileTree() *model.FileSystemTree {
	return s.fs.GetTree()
}

// CreateFile creates a new file or folder
func (s *FileService) CreateFile(req *model.CreateFileRequest) (*model.FileItem, error) {
	// Generate unique ID
	id := fmt.Sprintf("%d", time.Now().UnixNano())
	
	// Determine path
	var path string
	if req.ParentID != "" {
		parent := s.fs.GetTree().Files[req.ParentID]
		if parent == nil {
			return nil, fmt.Errorf("parent not found: %s", req.ParentID)
		}
		path = filepath.Join(parent.Path, req.Name)
	} else {
		path = "/" + req.Name
	}
	
	// Create file item
	file := &model.FileItem{
		ID:           id,
		Name:         req.Name,
		Type:         req.Type,
		FileType:     req.FileType,
		Path:         path,
		ParentID:     req.ParentID,
		Content:      req.Content,
		LastModified: time.Now(),
	}
	
	if req.Type == "folder" {
		file.Children = make([]string, 0)
		file.IsExpanded = true
	}
	
	// Create in file system
	if err := s.fs.CreateFile(file); err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	
	// Broadcast file creation to all clients
	s.hub.Broadcast(model.FileWatchMessage{
		Type:  "file-watch",
		Event: "created",
		Path:  file.Path,
	})
	
	return file, nil
}

// DeleteFile deletes a file or folder
func (s *FileService) DeleteFile(fileID string) error {
	tree := s.fs.GetTree()
	file := tree.Files[fileID]
	if file == nil {
		return fmt.Errorf("file not found: %s", fileID)
	}
	
	filePath := file.Path
	
	// Delete from file system
	if err := s.fs.DeleteFile(fileID); err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	
	// Broadcast file deletion to all clients
	s.hub.Broadcast(model.FileWatchMessage{
		Type:  "file-watch",
		Event: "deleted",
		Path:  filePath,
	})
	
	return nil
}

// UpdateFile updates a file's metadata or content
func (s *FileService) UpdateFile(fileID string, req *model.UpdateFileRequest) (*model.FileItem, error) {
	tree := s.fs.GetTree()
	file := tree.Files[fileID]
	if file == nil {
		return nil, fmt.Errorf("file not found: %s", fileID)
	}
	
	updates := make(map[string]interface{})
	
	if req.Name != "" && req.Name != file.Name {
		updates["name"] = req.Name
	}
	
	if req.Content != "" && req.Content != file.Content {
		updates["content"] = req.Content
	}
	
	// Update in file system
	if err := s.fs.UpdateFile(fileID, updates); err != nil {
		return nil, fmt.Errorf("failed to update file: %w", err)
	}
	
	// Get updated file
	updatedFile := tree.Files[fileID]
	
	// Broadcast file modification to all clients
	if req.Content != "" {
		s.hub.Broadcast(model.FileWatchMessage{
			Type:    "file-watch",
			Event:   "modified",
			Path:    updatedFile.Path,
			Content: updatedFile.Content,
		})
	}
	
	if req.Name != "" && req.Name != file.Name {
		s.hub.Broadcast(model.FileWatchMessage{
			Type:    "file-watch",
			Event:   "renamed",
			Path:    updatedFile.Path,
			OldPath: file.Path,
		})
	}
	
	return updatedFile, nil
}

// MoveFile moves a file to a new location
func (s *FileService) MoveFile(fileID string, req *model.MoveFileRequest) (*model.FileItem, error) {
	tree := s.fs.GetTree()
	file := tree.Files[fileID]
	if file == nil {
		return nil, fmt.Errorf("file not found: %s", fileID)
	}
	
	oldPath := file.Path
	
	// Move in file system
	if err := s.fs.MoveFile(fileID, req.NewParentID, req.NewPath); err != nil {
		return nil, fmt.Errorf("failed to move file: %w", err)
	}
	
	// Get updated file
	updatedFile := tree.Files[fileID]
	
	// Broadcast file move to all clients
	s.hub.Broadcast(model.FileWatchMessage{
		Type:    "file-watch",
		Event:   "moved",
		Path:    updatedFile.Path,
		OldPath: oldPath,
	})
	
	return updatedFile, nil
}

// ReadFileContent reads the content of a file
func (s *FileService) ReadFileContent(fileID string) (string, error) {
	tree := s.fs.GetTree()
	file := tree.Files[fileID]
	if file == nil {
		return "", fmt.Errorf("file not found: %s", fileID)
	}
	
	if file.Type != "file" {
		return "", fmt.Errorf("cannot read content of folder: %s", fileID)
	}
	
	// Read from file system
	content, err := s.fs.ReadFileContent(file.Path)
	if err != nil {
		return "", fmt.Errorf("failed to read file content: %w", err)
	}
	
	return content, nil
}

// SaveTree saves the file system tree to disk
func (s *FileService) SaveTree() error {
	return s.fs.SaveTree()
}

// LoadTree loads the file system tree from disk
func (s *FileService) LoadTree() error {
	return s.fs.LoadTree()
}