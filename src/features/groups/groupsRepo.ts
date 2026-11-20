import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import type { Flashcards, Notes } from '@shared/lectures';
import type { Quiz } from '@shared/learn';

export interface Group { id: string; name: string; owner_id: string; invite_code: string; created_at: string }
export interface Member { user_id: string; role: 'owner' | 'member'; display_name: string; joined_at: string }
export interface Share {
  id: string; group_id: string; shared_by: string; sharer_name: string; title: string;
  notes: Notes | null; flashcards: Flashcards | null; quiz: Quiz | null; created_at: string;
}
export type NewShare = Pick<Share, 'title' | 'notes' | 'flashcards' | 'quiz'>;

// ── Demo mode: one student, so groups live in this browser ──
interface DemoData { groups: Group[]; members: (Member & { group_id: string })[]; shares: Share[] }
const KEY = 'bw.groups';
const read = (): DemoData => { try { return { groups: [], members: [], shares: [], ...JSON.parse(storage.get(KEY) ?? '{}') }; } catch { return { groups: [], members: [], shares: [] }; } };
const write = (d: DemoData) => storage.set(KEY, JSON.stringify(d));
const code = () => crypto.randomUUID().replace(/-/g, '').slice(0, 24);
const now = () => new Date().toISOString();

/** Study groups: Supabase (RLS + functions in migration 0014), or this browser in demo mode. */
export const groupsRepo = {
  async list(): Promise<(Group & { members: number })[]> {
    if (!supabase) {
      const d = read();
      return d.groups.map((g) => ({ ...g, members: d.members.filter((m) => m.group_id === g.id).length }));
    }
    const { data, error } = await supabase.from('study_groups').select('id, name, owner_id, invite_code, created_at, group_members(count)').order('created_at', { ascending: false });
    if (error) { console.warn('Study groups unavailable (migration 0014 not run?)', error.message); return []; }
    return (data as (Group & { group_members: { count: number }[] })[]).map(({ group_members, ...g }) => ({ ...g, members: group_members[0]?.count ?? 0 }));
  },

  async create(name: string, displayName: string, userId: string): Promise<string> {
    if (!supabase) {
      const d = read();
      const g: Group = { id: crypto.randomUUID(), name: name.trim().slice(0, 80), owner_id: userId, invite_code: code(), created_at: now() };
      write({ ...d, groups: [g, ...d.groups], members: [...d.members, { group_id: g.id, user_id: userId, role: 'owner', display_name: displayName, joined_at: now() }] });
      return g.id;
    }
    const { data, error } = await supabase.rpc('create_study_group', { p_name: name.trim(), p_display_name: displayName });
    if (error) throw error;
    return data as string;
  },

  async preview(inviteCode: string): Promise<{ name: string; members: number } | null> {
    if (!supabase) {
      const d = read();
      const g = d.groups.find((x) => x.invite_code === inviteCode);
      return g ? { name: g.name, members: d.members.filter((m) => m.group_id === g.id).length } : null;
    }
    const { data, error } = await supabase.rpc('preview_study_group', { p_code: inviteCode });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { name: string; members: number } | undefined;
    return row ? { name: row.name, members: Number(row.members) } : null;
  },

  async join(inviteCode: string, displayName: string, userId: string): Promise<string> {
    if (!supabase) {
      const d = read();
      const g = d.groups.find((x) => x.invite_code === inviteCode);
      if (!g) throw new Error('invite not found');
      if (!d.members.some((m) => m.group_id === g.id && m.user_id === userId)) {
        write({ ...d, members: [...d.members, { group_id: g.id, user_id: userId, role: 'member', display_name: displayName, joined_at: now() }] });
      }
      return g.id;
    }
    const { data, error } = await supabase.rpc('join_study_group', { p_code: inviteCode, p_display_name: displayName });
    if (error) throw error;
    return data as string;
  },

  async get(id: string): Promise<{ group: Group; members: Member[]; shares: Share[] } | null> {
    if (!supabase) {
      const d = read();
      const group = d.groups.find((g) => g.id === id);
      if (!group) return null;
      return {
        group,
        members: d.members.filter((m) => m.group_id === id),
        shares: d.shares.filter((s) => s.group_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      };
    }
    const [g, m, s] = await Promise.all([
      supabase.from('study_groups').select('id, name, owner_id, invite_code, created_at').eq('id', id).maybeSingle(),
      supabase.from('group_members').select('user_id, role, display_name, joined_at').eq('group_id', id).order('joined_at'),
      supabase.from('group_shares').select('*').eq('group_id', id).order('created_at', { ascending: false }),
    ]);
    if (g.error) throw g.error;
    if (!g.data) return null;
    return { group: g.data as Group, members: (m.data ?? []) as Member[], shares: (s.data ?? []) as Share[] };
  },

  async share(groupId: string, item: NewShare, sharerName: string, userId: string) {
    if (!supabase) {
      const d = read();
      write({ ...d, shares: [{ id: crypto.randomUUID(), group_id: groupId, shared_by: userId, sharer_name: sharerName, created_at: now(), ...item }, ...d.shares] });
      return;
    }
    const { error } = await supabase.from('group_shares').insert({ group_id: groupId, sharer_name: sharerName, ...item });
    if (error) throw error;
  },

  async unshare(shareId: string) {
    if (!supabase) { const d = read(); write({ ...d, shares: d.shares.filter((s) => s.id !== shareId) }); return; }
    const { error } = await supabase.from('group_shares').delete().eq('id', shareId);
    if (error) throw error;
  },

  async removeMember(groupId: string, userId: string) {
    if (!supabase) { const d = read(); write({ ...d, members: d.members.filter((m) => !(m.group_id === groupId && m.user_id === userId)) }); return; }
    const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) throw error;
  },

  async rename(groupId: string, name: string) {
    const clean = name.trim().slice(0, 80);
    if (!supabase) { const d = read(); write({ ...d, groups: d.groups.map((g) => (g.id === groupId ? { ...g, name: clean } : g)) }); return; }
    const { error } = await supabase.from('study_groups').update({ name: clean }).eq('id', groupId);
    if (error) throw error;
  },

  async resetInvite(groupId: string): Promise<string> {
    if (!supabase) {
      const d = read(); const c = code();
      write({ ...d, groups: d.groups.map((g) => (g.id === groupId ? { ...g, invite_code: c } : g)) });
      return c;
    }
    const { data, error } = await supabase.rpc('reset_study_group_invite', { p_group: groupId });
    if (error) throw error;
    return data as string;
  },

  async remove(groupId: string) {
    if (!supabase) {
      const d = read();
      write({ groups: d.groups.filter((g) => g.id !== groupId), members: d.members.filter((m) => m.group_id !== groupId), shares: d.shares.filter((s) => s.group_id !== groupId) });
      return;
    }
    const { error } = await supabase.from('study_groups').delete().eq('id', groupId);
    if (error) throw error;
  },
};
