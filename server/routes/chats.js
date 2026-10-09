import { HttpError } from '../http/utils.js';
import { searchUsers, getUser } from '../services/users.js';
import { listChats, chatPayload, getOrCreateDirect, createGroup, isMember, listMessages, searchMessages, memberIds } from '../services/chat.js';
import { sendToUsers } from '../realtime/presence.js';

export default function chatRoutes(r) {
  r.get('/api/users', (ctx) => ({ users: searchUsers(ctx.url.searchParams.get('q') || '', ctx.user.id) }));

  r.get('/api/chats', (ctx) => ({ chats: listChats(ctx.user.id) }));

  r.post('/api/chats', async (ctx) => {
    const b = await ctx.body();
    let id;
    if (b.type === 'group') {
      const name = String(b.name || '').trim().slice(0, 60);
      const ids = (Array.isArray(b.memberIds) ? b.memberIds : []).map(Number).filter(Number.isInteger);
      if (!name) throw new HttpError(400, 'Give your group a name.');
      if (!ids.length) throw new HttpError(400, 'Pick at least one member.');
      id = createGroup(ctx.user.id, name, ids);
    } else {
      const other = Number(b.userId);
      if (!getUser(other) || other === ctx.user.id) throw new HttpError(400, 'Choose another user.');
      id = getOrCreateDirect(ctx.user.id, other);
    }
    for (const uid of memberIds(id)) if (uid !== ctx.user.id) sendToUsers([uid], { type: 'chat', chat: chatPayload(id, uid) });
    return { chat: chatPayload(id, ctx.user.id) };
  });

  r.get('/api/chats/:id/messages', (ctx) => {
    const id = Number(ctx.params.id);
    if (!isMember(id, ctx.user.id)) throw new HttpError(403, 'Not a member of this chat.');
    const before = Number(ctx.url.searchParams.get('before')) || null;
    return { messages: listMessages(id, before) };
  });

  r.get('/api/search', (ctx) => {
    const q = (ctx.url.searchParams.get('q') || '').trim();
    return { messages: q.length < 2 ? [] : searchMessages(ctx.user.id, q) };
  });
}
