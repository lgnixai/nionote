type FsEvent = {
  type: 'fs';
  action: 'created' | 'modified' | 'deleted' | 'renamed';
  path: string;
  from?: string;
  to?: string;
};

type Listener = (evt: FsEvent) => void;

let socket: WebSocket | null = null;
const listeners = new Set<Listener>();

function getWsUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws`;
}

export function connectWS(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  socket = new WebSocket(getWsUrl());
  socket.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data) as FsEvent;
      if (data?.type === 'fs') {
        listeners.forEach((l) => l(data));
      }
    } catch {}
  };
  socket.onclose = () => {
    // Simple retry
    setTimeout(connectWS, 1000);
  };
}

export function addFsListener(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

