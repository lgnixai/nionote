package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"obsidian-backend/internal/model"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development
		// In production, you should validate origins
		return true
	},
}

// Client represents a WebSocket client
type Client struct {
	ID     string
	Conn   *websocket.Conn
	Send   chan []byte
	Hub    *Hub
	mutex  sync.Mutex
}

// Hub manages WebSocket connections
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()
			log.Printf("Client connected: %s", client.ID)
			
		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				log.Printf("Client disconnected: %s", client.ID)
			}
			h.mutex.Unlock()
			
		case message := <-h.broadcast:
			h.mutex.RLock()
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					delete(h.clients, client)
					close(client.Send)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// Broadcast sends a message to all connected clients
func (h *Hub) Broadcast(message interface{}) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling broadcast message: %v", err)
		return
	}
	
	select {
	case h.broadcast <- data:
	default:
		log.Println("Broadcast channel is full, dropping message")
	}
}

// SendToClient sends a message to a specific client
func (h *Hub) SendToClient(clientID string, message interface{}) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message for client %s: %v", clientID, err)
		return
	}
	
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	
	for client := range h.clients {
		if client.ID == clientID {
			select {
			case client.Send <- data:
			default:
				log.Printf("Client %s send channel is full, dropping message", clientID)
			}
			break
		}
	}
}

// GetClientCount returns the number of connected clients
func (h *Hub) GetClientCount() int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	return len(h.clients)
}

// HandleWebSocket upgrades HTTP connection to WebSocket
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request, clientID string, messageHandler func(*Client, *model.WebSocketMessage)) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	
	client := &Client{
		ID:   clientID,
		Conn: conn,
		Send: make(chan []byte, 256),
		Hub:  h,
	}
	
	client.Hub.register <- client
	
	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump(messageHandler)
}

// readPump handles incoming messages from the client
func (c *Client) readPump(messageHandler func(*Client, *model.WebSocketMessage)) {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()
	
	for {
		_, messageData, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for client %s: %v", c.ID, err)
			}
			break
		}
		
		var message model.WebSocketMessage
		if err := json.Unmarshal(messageData, &message); err != nil {
			log.Printf("Error unmarshaling message from client %s: %v", c.ID, err)
			c.SendError("Invalid message format")
			continue
		}
		
		// Handle the message
		if messageHandler != nil {
			messageHandler(c, &message)
		}
	}
}

// writePump handles outgoing messages to the client
func (c *Client) writePump() {
	defer c.Conn.Close()
	
	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			
			c.mutex.Lock()
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Error writing message to client %s: %v", c.ID, err)
				c.mutex.Unlock()
				return
			}
			c.mutex.Unlock()
		}
	}
}

// SendMessage sends a message to this client
func (c *Client) SendMessage(message interface{}) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message for client %s: %v", c.ID, err)
		return
	}
	
	select {
	case c.Send <- data:
	default:
		log.Printf("Client %s send channel is full, dropping message", c.ID)
	}
}

// SendError sends an error message to this client
func (c *Client) SendError(errorMsg string) {
	c.SendMessage(model.WebSocketMessage{
		Type:  "error",
		Error: errorMsg,
	})
}

// SendSuccess sends a success response to this client
func (c *Client) SendSuccess(msgType string, data interface{}) {
	c.SendMessage(model.WebSocketMessage{
		Type: msgType,
		Data: data,
	})
}