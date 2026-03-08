import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fastify = Fastify({ logger: true });
const OLLAMA = 'http://192.168.1.70:11434';

// Agent definitions
const agents = [
  {
    id: 'bulkhead',
    name: 'Bulkhead',
    role: 'Security Engineer',
    model: 'ministral-3:8b',
    system: 'You are Bulkhead, a security engineer on the TalonHub team. You specialize in threat detection, vulnerability analysis, and hardening systems. Be direct, technical, and concise. Keep responses under 150 words.'
  },
  {
    id: 'keel',
    name: 'Keel',
    role: 'Backend Engineer',
    model: 'ministral-3:8b',
    system: 'You are Keel, a backend engineer on the TalonHub team. You specialize in APIs, databases, WebSockets, and server architecture. Be practical and solution-oriented. Keep responses under 150 words.'
  },
  {
    id: 'quarterdeck',
    name: 'Quarterdeck',
    role: 'Frontend Engineer',
    model: 'ministral-3:8b',
    system: 'You are Quarterdeck, a frontend engineer on the TalonHub team. You specialize in React, UI/UX, accessibility, and performance. Be creative but grounded. Keep responses under 150 words.'
  },
  {
    id: 'helm',
    name: 'Helm',
    role: 'Project Manager',
    model: 'devstral-small-2:latest',
    system: 'You are Helm, the project manager on the TalonHub team. You coordinate between agents, track milestones, manage risks, and report status. You think strategically about architecture and delivery. Be clear, organized, and decisive. Keep responses under 150 words.'
  }
];

// Track conversation history per connection
const conversations = new Map();

await fastify.register(fastifyWebsocket);
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'dist'),
  prefix: '/',
});

fastify.get('/api/health', async () => ({ status: 'ok', app: 'TalonHub MVP', agents: agents.map(a => a.name) }));

fastify.get('/api/agents', async () => agents.map(a => ({ id: a.id, name: a.name, role: a.role })));

fastify.get('/ws', { websocket: true }, (socket) => {
  const connId = crypto.randomUUID();
  conversations.set(connId, []);

  socket.send(JSON.stringify({
    type: 'system',
    text: 'Connected to TalonHub. Agents online: ' + agents.map(a => `${a.name} (${a.role})`).join(', ')
  }));

  socket.on('message', async (raw) => {
    const msg = raw.toString();
    let parsed;
    try {
      parsed = JSON.parse(msg);
    } catch {
      parsed = { text: msg, target: null };
    }

    const userText = parsed.text || msg;
    const targetAgent = parsed.target; // optional: route to specific agent

    // Store user message
    const history = conversations.get(connId) || [];
    history.push({ role: 'user', content: userText });
    if (history.length > 20) history.splice(0, history.length - 20);
    conversations.set(connId, history);

    // Log to SQLite
    db.run('INSERT INTO messages (conn_id, sender, text) VALUES (?, ?, ?)', [connId, 'user', userText]);

    // Determine which agent(s) respond
    const respondingAgents = targetAgent
      ? agents.filter(a => a.id === targetAgent)
      : [selectAgent(userText)];

    for (const agent of respondingAgents) {
      // Send typing indicator
      socket.send(JSON.stringify({ type: 'typing', agent: agent.name }));

      try {
        const reply = await queryOllama(agent, history);

        history.push({ role: 'assistant', content: `[${agent.name}] ${reply}` });
        conversations.set(connId, history);

        db.run('INSERT INTO messages (conn_id, sender, text) VALUES (?, ?, ?)', [connId, agent.id, reply]);

        socket.send(JSON.stringify({
          type: 'agent',
          agent: agent.name,
          role: agent.role,
          text: reply,
          ts: Date.now()
        }));
      } catch (err) {
        socket.send(JSON.stringify({
          type: 'error',
          agent: agent.name,
          text: `Agent error: ${err.message}`
        }));
      }
    }
  });

  socket.on('close', () => conversations.delete(connId));
});

// Route message to most relevant agent based on keywords
function selectAgent(text) {
  const lower = text.toLowerCase();
  if (/security|vuln|threat|cve|firewall|tls|auth|encrypt|attack|defend|hack|breach|audit/.test(lower)) return agents[0]; // Bulkhead
  if (/api|server|database|sql|backend|websocket|node|fastify|deploy|docker|scale/.test(lower)) return agents[1]; // Keel
  if (/ui|ux|react|css|frontend|design|button|layout|mobile|responsive|component/.test(lower)) return agents[2]; // Quarterdeck
  if (/status|plan|sprint|milestone|risk|schedule|team|coordinate|priority|deadline|project/.test(lower)) return agents[3]; // Helm
  // Round-robin fallback (exclude Helm from random -- he responds to project questions)
  return agents[Math.floor(Math.random() * 3)];
}

// Query Ollama
async function queryOllama(agent, history) {
  const messages = [
    { role: 'system', content: agent.system },
    ...history.slice(-10)
  ];

  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: agent.model,
      messages,
      stream: false,
      options: { temperature: 0.7, num_predict: 256 }
    })
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // Some models (qwen3.5) put content in thinking field
  const content = data.message?.content || '';
  const thinking = data.message?.thinking || '';
  if (content.trim()) return content.trim();
  if (thinking.trim()) {
    // Extract the actual answer from thinking (last paragraph)
    const lines = thinking.trim().split('\n').filter(l => l.trim());
    return lines.slice(-3).join('\n').trim() || thinking.slice(0, 500);
  }
  return 'Agent processing -- no response generated';
}

// SQLite
const db = new sqlite3.Database(path.join(__dirname, 'talonhub.db'));
db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conn_id TEXT,
  sender TEXT,
  text TEXT,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
db.run(`CREATE TABLE IF NOT EXISTS audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT,
  action TEXT,
  status TEXT,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

try {
  await fastify.listen({ port: 3000, host: '0.0.0.0' });
  console.log('TalonHub listening on 0.0.0.0:3000');
  console.log(`Agents: ${agents.map(a => a.name).join(', ')}`);
  console.log(`Ollama: ${OLLAMA}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
