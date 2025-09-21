package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"obsidian-backend/internal/model"
	"obsidian-backend/internal/service"
	"obsidian-backend/pkg/websocket"

	"github.com/gin-gonic/gin"
)

// WebSocketHandler handles WebSocket connections and messages
type WebSocketHandler struct {
	hub         *websocket.Hub
	fileService *service.FileService
}

// NewWebSocketHandler creates a new WebSocketHandler
func NewWebSocketHandler(hub *websocket.Hub, fileService *service.FileService) *WebSocketHandler {
	return &WebSocketHandler{
		hub:         hub,
		fileService: fileService,
	}
}

// HandleWebSocket handles WebSocket upgrade and connection
func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	// Generate client ID (in production, you might want to use authentication)
	clientID := fmt.Sprintf("client_%d", h.hub.GetClientCount()+1)
	
	h.hub.HandleWebSocket(c.Writer, c.Request, clientID, h.handleMessage)
}

// handleMessage processes incoming WebSocket messages
func (h *WebSocketHandler) handleMessage(client *websocket.Client, message *model.WebSocketMessage) {
	log.Printf("Received message from client %s: %s", client.ID, message.Type)
	
	switch message.Type {
	case "file-operation":
		h.handleFileOperation(client, message)
	case "get-tree":
		h.handleGetTree(client, message)
	case "ping":
		h.handlePing(client, message)
	default:
		client.SendError(fmt.Sprintf("Unknown message type: %s", message.Type))
	}
}

// handleFileOperation processes file operation messages
func (h *WebSocketHandler) handleFileOperation(client *websocket.Client, message *model.WebSocketMessage) {
	var fileOp model.FileOperationMessage
	
	// Convert message data to FileOperationMessage
	if data, ok := message.Data.(map[string]interface{}); ok {
		jsonData, err := json.Marshal(data)
		if err != nil {
			client.SendError("Failed to parse file operation data")
			return
		}
		
		if err := json.Unmarshal(jsonData, &fileOp); err != nil {
			client.SendError("Failed to parse file operation data")
			return
		}
	} else {
		client.SendError("Invalid file operation data format")
		return
	}
	
	switch fileOp.Operation {
	case "create":
		h.handleCreateFile(client, message.ID, &fileOp)
	case "delete":
		h.handleDeleteFile(client, message.ID, &fileOp)
	case "rename":
		h.handleRenameFile(client, message.ID, &fileOp)
	case "move":
		h.handleMoveFile(client, message.ID, &fileOp)
	case "update-content":
		h.handleUpdateContent(client, message.ID, &fileOp)
	default:
		client.SendError(fmt.Sprintf("Unknown file operation: %s", fileOp.Operation))
	}
}

// handleCreateFile handles file creation
func (h *WebSocketHandler) handleCreateFile(client *websocket.Client, messageID string, fileOp *model.FileOperationMessage) {
	if fileOp.File == nil {
		client.SendError("File data is required for create operation")
		return
	}
	
	req := &model.CreateFileRequest{
		Name:     fileOp.File.Name,
		Type:     fileOp.File.Type,
		FileType: fileOp.File.FileType,
		ParentID: fileOp.File.ParentID,
		Content:  fileOp.File.Content,
	}
	
	createdFile, err := h.fileService.CreateFile(req)
	if err != nil {
		client.SendMessage(model.WebSocketMessage{
			Type:  "file-operation-response",
			ID:    messageID,
			Error: err.Error(),
		})
		return
	}
	
	client.SendMessage(model.WebSocketMessage{
		Type: "file-operation-response",
		ID:   messageID,
		Data: map[string]interface{}{
			"operation": "create",
			"file":      createdFile,
		},
	})
}

// handleDeleteFile handles file deletion
func (h *WebSocketHandler) handleDeleteFile(client *websocket.Client, messageID string, fileOp *model.FileOperationMessage) {
	if fileOp.Path == "" {
		client.SendError("File path is required for delete operation")
		return
	}
	
	// Find file by path
	var fileID string
	tree := h.fileService.GetFileTree()
	for id, file := range tree.Files {
		if file.Path == fileOp.Path {
			fileID = id
			break
		}
	}
	
	if fileID == "" {
		client.SendMessage(model.WebSocketMessage{
			Type:  "file-operation-response",
			ID:    messageID,
			Error: "File not found",
		})
		return
	}
	
	if err := h.fileService.DeleteFile(fileID); err != nil {
		client.SendMessage(model.WebSocketMessage{
			Type:  "file-operation-response",
			ID:    messageID,
			Error: err.Error(),
		})
		return
	}
	
	client.SendMessage(model.WebSocketMessage{
		Type: "file-operation-response",
		ID:   messageID,
		Data: map[string]interface{}{
			"operation": "delete",
			"path":      fileOp.Path,
		},
	})
}

// handleRenameFile handles file renaming
func (h *WebSocketHandler) handleRenameFile(client *websocket.Client, messageID string, fileOp *model.FileOperationMessage) {
	if fileOp.OldPath == "" || fileOp.NewPath == "" {
		client.SendError("Both old path and new path are required for rename operation")
		return
	}
	
	// Find file by old path
	var fileID string
	tree := h.fileService.GetFileTree()
	for id, file := range tree.Files {
		if file.Path == fileOp.OldPath {
			fileID = id
			break
		}
	}
	
	if fileID == "" {
		client.SendMessage(model.WebSocketMessage{
			Type:  "file-operation-response",
			ID:    messageID,
			Error: "File not found",
		})
		return
	}
	
	// Extract new name from new path
	newName := fileOp.NewPath[len(fileOp.NewPath)-1:]
	for i := len(fileOp.NewPath) - 1; i >= 0; i-- {
		if fileOp.NewPath[i] == '/' {
			newName = fileOp.NewPath[i+1:]
			break
		}
	}
	
	req := &model.UpdateFileRequest{
		Name: newName,
	}
	
	updatedFile, err := h.fileService.UpdateFile(fileID, req)
	if err != nil {
		client.SendMessage(model.WebSocketMessage{
			Type:  "file-operation-response",
			ID:    messageID,
			Error: err.Error(),
		})
		return
	}
	
	client.SendMessage(model.WebSocketMessage{
		Type: "file-operation-response",
		ID:   messageID,
		Data: map[string]interface{}{
			"operation": "rename",
			"file":      updatedFile,
		},
	})
}

// handleMoveFile handles file moving
func (h *WebSocketHandler) handleMoveFile(client *websocket.Client, messageID string, fileOp *model.FileOperationMessage) {
	if fileOp.OldPath == "" || fileOp.NewPath == "" {
		client.SendError("Both old path and new path are required for move operation")
		return
	}
	
	// Find file by old path
	var fileID string
	tree := h.fileService.GetFileTree()
	for id, file := range tree.Files {
		if file.Path == fileOp.OldPath {
			fileID = id
			break
		}
	}
	
	if fileID == "" {
		client.SendMessage(model.WebSocketMessage{
			Type:  "file-operation-response",
			ID:    messageID,
			Error: "File not found",
		})
		return
	}
	
	req := &model.MoveFileRequest{
		NewPath: fileOp.NewPath,
		// TODO: Determine new parent ID from new path
	}
	
	updatedFile, err := h.fileService.MoveFile(fileID, req)
	if err != nil {
		client.SendMessage(model.WebSocketMessage{
			Type:  "file-operation-response",
			ID:    messageID,
			Error: err.Error(),
		})
		return
	}
	
	client.SendMessage(model.WebSocketMessage{
		Type: "file-operation-response",
		ID:   messageID,
		Data: map[string]interface{}{
			"operation": "move",
			"file":      updatedFile,
		},
	})
}

// handleUpdateContent handles file content updates
func (h *WebSocketHandler) handleUpdateContent(client *websocket.Client, messageID string, fileOp *model.FileOperationMessage) {
	if fileOp.Path == "" || fileOp.Content == "" {
		client.SendError("Both path and content are required for update-content operation")
		return
	}
	
	// Find file by path
	var fileID string
	tree := h.fileService.GetFileTree()
	for id, file := range tree.Files {
		if file.Path == fileOp.Path {
			fileID = id
			break
		}
	}
	
	if fileID == "" {
		client.SendMessage(model.WebSocketMessage{
			Type:  "file-operation-response",
			ID:    messageID,
			Error: "File not found",
		})
		return
	}
	
	req := &model.UpdateFileRequest{
		Content: fileOp.Content,
	}
	
	updatedFile, err := h.fileService.UpdateFile(fileID, req)
	if err != nil {
		client.SendMessage(model.WebSocketMessage{
			Type:  "file-operation-response",
			ID:    messageID,
			Error: err.Error(),
		})
		return
	}
	
	client.SendMessage(model.WebSocketMessage{
		Type: "file-operation-response",
		ID:   messageID,
		Data: map[string]interface{}{
			"operation": "update-content",
			"file":      updatedFile,
		},
	})
}

// handleGetTree handles requests for the complete file tree
func (h *WebSocketHandler) handleGetTree(client *websocket.Client, message *model.WebSocketMessage) {
	tree := h.fileService.GetFileTree()
	
	client.SendMessage(model.WebSocketMessage{
		Type: "tree-data",
		ID:   message.ID,
		Data: tree,
	})
}

// handlePing handles ping messages
func (h *WebSocketHandler) handlePing(client *websocket.Client, message *model.WebSocketMessage) {
	client.SendMessage(model.WebSocketMessage{
		Type: "pong",
		ID:   message.ID,
		Data: "pong",
	})
}