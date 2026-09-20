import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type CareItemKind = 'medicine' | 'test' | 'visit';

export interface CareReminder {
  id: string;
  kind: CareItemKind;
  title: string;
  detail: string;
  time: string;
  nextDate: string;
  source: string;
  doneDates: string[];
  createdAt: number;
}

export interface CareReminderScope {
  profileId: string | null;
}

interface CareReminderState {
  reminders: CareReminder[];
  hydrated: boolean;
  hydratedKey: string | null;
  hydrate: (scope: CareReminderScope) => Promise<void>;
  addReminder: (
    input: Omit<CareReminder, 'id' | 'doneDates' | 'createdAt'>,
    scope: CareReminderScope,
  ) => Promise<void>;
  toggleDoneToday: (id: string, scope: CareReminderScope) => Promise<void>;
  removeReminder: (id: string, scope: CareReminderScope) => Promise<void>;
}

const STORAGE_KEY = 'healthfolio:care-reminders:v1';

function storageKeyForScope(scope: CareReminderScope): string {
  return scope.profileId ? `${STORAGE_KEY}:${scope.profileId}` : STORAGE_KEY;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function persist(reminders: CareReminder[], storageKey: string): Promise<void> {
  await AsyncStorage.setItem(storageKey, JSON.stringify(reminders));
}

export const useCareReminderStore = create<CareReminderState>((set, get) => ({
  reminders: [],
  hydrated: false,
  hydratedKey: null,
  hydrate: async (scope) => {
    const storageKey = storageKeyForScope(scope);
    if (get().hydrated && get().hydratedKey === storageKey) return;

    set({ reminders: [], hydrated: false, hydratedKey: storageKey });
    const raw = await AsyncStorage.getItem(storageKey);
    const reminders = raw ? (JSON.parse(raw) as CareReminder[]) : [];
    set({ reminders, hydrated: true, hydratedKey: storageKey });
  },
  addReminder: async (input, scope) => {
    const storageKey = storageKeyForScope(scope);
    const reminder: CareReminder = {
      ...input,
      id: makeId(),
      doneDates: [],
      createdAt: Date.now(),
    };
    const current = get().hydratedKey === storageKey ? get().reminders : [];
    const reminders = [reminder, ...current];
    set({ reminders, hydrated: true, hydratedKey: storageKey });
    await persist(reminders, storageKey);
  },
  toggleDoneToday: async (id, scope) => {
    const storageKey = storageKeyForScope(scope);
    const today = todayKey();
    const current = get().hydratedKey === storageKey ? get().reminders : [];
    const reminders = current.map((reminder) => {
      if (reminder.id !== id) return reminder;
      const done = reminder.doneDates.includes(today);
      return {
        ...reminder,
        doneDates: done
          ? reminder.doneDates.filter((date) => date !== today)
          : [today, ...reminder.doneDates],
      };
    });
    set({ reminders, hydrated: true, hydratedKey: storageKey });
    await persist(reminders, storageKey);
  },
  removeReminder: async (id, scope) => {
    const storageKey = storageKeyForScope(scope);
    const current = get().hydratedKey === storageKey ? get().reminders : [];
    const reminders = current.filter((reminder) => reminder.id !== id);
    set({ reminders, hydrated: true, hydratedKey: storageKey });
    await persist(reminders, storageKey);
  },
}));

export function isDoneToday(reminder: CareReminder): boolean {
  return reminder.doneDates.includes(todayKey());
}

export function dueLabel(reminder: CareReminder): string {
  const today = todayKey();
  if (reminder.nextDate < today) return `Overdue - ${reminder.time}`;
  if (reminder.nextDate === today) return `Today - ${reminder.time}`;
  return `${new Date(`${reminder.nextDate}T00:00:00`).toLocaleDateString()} - ${reminder.time}`;
}
