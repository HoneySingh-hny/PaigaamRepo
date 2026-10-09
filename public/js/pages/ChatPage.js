import { h } from '../utils/dom.js';
import { Sidebar } from '../components/Sidebar.js';
import { ChatWindow } from '../components/ChatWindow.js';
import { openNewChatDialog } from '../components/NewChatDialog.js';
import { state, emit } from '../state.js';
import { startRealtime } from '../services/realtime.js';
import { loadChats, markRead } from '../services/chats.js';
import { api } from '../services/api.js';
import { navigate } from '../router.js';
import { toast } from '../utils/toast.js';

export function ChatPage(root, params) {
  const app = h('div', { class: 'app' });
  const win = ChatWindow({ onBack: () => navigate('/chat') });
  const sidebar = Sidebar({
    onOpen: (id) => navigate('/chat/' + id),
    onNew: () => openNewChatDialog({ onCreated: (chat) => navigate('/chat/' + chat.id) }),
    onLogout: async () => { await api.post('/api/auth/logout').catch(() => {}); state.me = null; navigate('/login'); },
  });
  app.append(sidebar.el, win.el);
  root.replaceChildren(app);

  const stopRealtime = startRealtime();

  let latest = params;
  function update(p = {}) {
    latest = p;
    const id = p.id ? Number(p.id) : null;
    const chat = id ? state.chats.get(id) : null;
    state.activeId = chat ? chat.id : null;
    app.classList.toggle('chat-open', !!chat);
    win.show(chat);
    if (chat) {
      const last = chat.lastMessage;
      if (last && chat.unread) markRead(chat, last.id);
    }
    emit('active');
    if (id && !chat && state.chats.size) { toast('That conversation was not found.', 'error'); navigate('/chat'); }
  }

  loadChats().then(() => update(latest)).catch((e) => toast(e.message, 'error'));
  return {
    update,
    unmount() { stopRealtime(); sidebar.destroy(); win.destroy(); state.activeId = null; state.chats.clear(); state.messages.clear(); },
  };
}
