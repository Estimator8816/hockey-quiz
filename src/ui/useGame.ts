import { createContext, h, type ComponentChildren } from 'preact';
import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bullits, questionsByTopic, subjects, training } from '../content/load';
import type { Bullit, Question, Subject } from '../content/types';
import { deriveProgress, type Progress } from '../engine/progress';
import { getClient } from '../storage/client';
import { ensureSession } from '../storage/auth';
import { startAutoSync } from '../storage/sync';
import { createLocalStore, requestPersistence, type EventStore } from '../storage/store';

export interface Content {
  subjects: Subject[];
  bullits: Bullit[];
  training: Question[];
  questionsByTopic: Map<string, Question[]>;
}
export interface Game { store: EventStore; progress: Progress; client: SupabaseClient | null; content: Content }

const defaultContent: Content = { subjects, bullits, training, questionsByTopic };
const Ctx = createContext<Game | null>(null);

export function GameProvider(props: {
  store?: EventStore; client?: SupabaseClient | null; content?: Content; children?: ComponentChildren;
}) {
  const [{ store, client }] = useState(() => {
    const store = props.store ?? createLocalStore();
    const client = props.client !== undefined ? props.client : getClient();
    return { store, client };
  });
  const content = props.content ?? defaultContent;
  const [events, setEvents] = useState(() => store.all());
  useEffect(() => store.subscribe(() => setEvents(store.all())), [store]);

  useEffect(() => {
    if (!props.store) void requestPersistence();
    if (!client) return;
    let stop: (() => void) | undefined;
    let dead = false;
    ensureSession(client)
      .then(() => { if (!dead) stop = startAutoSync(store, client); })
      .catch(() => { /* офлайн: игра работает без сети */ });
    return () => { dead = true; stop?.(); };
  }, [store, client]);

  const progress = useMemo(
    () => deriveProgress(events, content.subjects, Date.now()),
    [events, content],
  );
  const value = useMemo<Game>(() => ({ store, progress, client, content }), [store, progress, client, content]);
  return h(Ctx.Provider, { value }, props.children);
}

export function useGame(): Game {
  const g = useContext(Ctx);
  if (!g) throw new Error('useGame: нет GameProvider');
  return g;
}
