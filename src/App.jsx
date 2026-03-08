import React, { useState, useEffect, useRef } from 'react';

const AGENT_COLORS = {
  Bulkhead: '#dc3545',
  Keel: '#0d6efd',
  Quarterdeck: '#198754',
  Helm: '#fd7e14',
};

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(null);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === 'typing') {
        setTyping(data.agent);
        return;
      }

      setTyping(null);

      if (data.type === 'system') {
        setMessages(m => [...m, { type: 'system', text: data.text }]);
      } else if (data.type === 'agent') {
        setMessages(m => [...m, {
          type: 'agent',
          agent: data.agent,
          role: data.role,
          text: data.text,
          ts: data.ts
        }]);
      } else if (data.type === 'error') {
        setMessages(m => [...m, { type: 'error', agent: data.agent, text: data.text }]);
      }
    };

    ws.onclose = () => {
      setMessages(m => [...m, { type: 'system', text: 'Disconnected from TalonHub' }]);
      setTyping(null);
    };

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const send = () => {
    if (wsRef.current?.readyState === 1 && input.trim()) {
      wsRef.current.send(JSON.stringify({ text: input }));
      setMessages(m => [...m, { type: 'user', text: input, ts: Date.now() }]);
      setInput('');
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 20, fontFamily: 'system-ui', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#eee' }}>TalonHub</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(AGENT_COLORS).map(([name, color]) => (
            <span key={name} style={{
              padding: '2px 8px', borderRadius: 12, fontSize: 11,
              background: color + '33', color, border: `1px solid ${color}66`
            }}>{name}</span>
          ))}
        </div>
      </div>

      <div style={{
        flex: 1, border: '1px solid #333', borderRadius: 8, padding: 16,
        overflowY: 'auto', background: '#111', marginBottom: 16
      }}>
        {messages.map((msg, i) => {
          if (msg.type === 'system') return (
            <div key={i} style={{ textAlign: 'center', color: '#666', fontSize: 12, padding: '8px 0' }}>
              {msg.text}
            </div>
          );

          if (msg.type === 'error') return (
            <div key={i} style={{ textAlign: 'center', color: '#dc3545', fontSize: 12, padding: '4px 0' }}>
              {msg.agent}: {msg.text}
            </div>
          );

          if (msg.type === 'user') return (
            <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <div style={{
                maxWidth: '75%', padding: '8px 14px', borderRadius: '14px 14px 4px 14px',
                background: '#0066cc', color: '#fff', fontSize: 14
              }}>
                {msg.text}
              </div>
            </div>
          );

          if (msg.type === 'agent') {
            const color = AGENT_COLORS[msg.agent] || '#888';
            return (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color, marginBottom: 2, fontWeight: 600 }}>
                  {msg.agent} <span style={{ fontWeight: 400, color: '#666' }}>{msg.role}</span>
                </div>
                <div style={{
                  maxWidth: '85%', padding: '8px 14px', borderRadius: '4px 14px 14px 14px',
                  background: '#1e1e1e', color: '#ddd', fontSize: 14, lineHeight: 1.5,
                  borderLeft: `3px solid ${color}`
                }}>
                  {msg.text}
                </div>
              </div>
            );
          }
          return null;
        })}

        {typing && (
          <div style={{ fontSize: 12, color: AGENT_COLORS[typing] || '#888', padding: '4px 0' }}>
            {typing} is thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask the team anything..."
          style={{
            flex: 1, padding: 12, borderRadius: 8, border: '1px solid #444',
            background: '#1a1a1a', color: '#eee', fontSize: 14
          }}
        />
        <button onClick={send} style={{
          padding: '12px 24px', borderRadius: 8, background: '#0066cc',
          color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600
        }}>
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
