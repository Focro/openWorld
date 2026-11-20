import type { GameState } from "./types";

/** Сохранение с версией формата и ветками таймлайна. */
export interface Branch {
  id: string;
  parentId: string | null;
  /** Индекс снимка в родительской ветке, от которого ответвились. */
  forkIndex: number;
  states: GameState[];
}

export interface SaveFile {
  schemaVersion: 1;
  activeBranch: string;
  branches: Record<string, Branch>;
}

export function createSave(initial: GameState): SaveFile {
  return {
    schemaVersion: 1,
    activeBranch: "main",
    branches: { main: { id: "main", parentId: null, forkIndex: 0, states: [initial] } }
  };
}

export function currentState(save: SaveFile): GameState {
  const states = save.branches[save.activeBranch]!.states;
  return states[states.length - 1]!;
}

/** Добавляет снимок в активную ветку (не мутирует исходное сохранение). */
export function commitState(save: SaveFile, state: GameState): SaveFile {
  const branch = save.branches[save.activeBranch]!;
  return {
    ...save,
    branches: { ...save.branches, [branch.id]: { ...branch, states: [...branch.states, state] } }
  };
}

/**
 * Создаёт новую ветку от снимка atIndex активной ветки (по умолчанию — от последнего)
 * и делает её активной. Возвращает null при занятом id или неверном индексе.
 */
export function forkBranch(save: SaveFile, newId: string, atIndex?: number): SaveFile | null {
  const parent = save.branches[save.activeBranch]!;
  const index = atIndex ?? parent.states.length - 1;
  if (!newId || save.branches[newId] || !Number.isInteger(index) || index < 0 || index >= parent.states.length)
    return null;
  const branch: Branch = {
    id: newId, parentId: parent.id, forkIndex: index, states: parent.states.slice(0, index + 1)
  };
  return { ...save, activeBranch: newId, branches: { ...save.branches, [newId]: branch } };
}

export function serializeSave(save: SaveFile): string {
  return JSON.stringify(save);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Разбирает JSON сохранения. Возвращает null при неизвестной версии или битой структуре. */
export function parseSave(json: string): SaveFile | null {
  let data: unknown;
  try { data = JSON.parse(json); } catch { return null; }
  if (!isRecord(data) || data.schemaVersion !== 1) return null;
  if (typeof data.activeBranch !== "string" || !isRecord(data.branches)) return null;
  for (const [id, b] of Object.entries(data.branches)) {
    if (!isRecord(b) || b.id !== id || !Array.isArray(b.states) || b.states.length === 0) return null;
    if (!b.states.every((s) => isRecord(s) && s.schemaVersion === 1)) return null;
  }
  if (!(data.activeBranch in data.branches)) return null;
  return data as unknown as SaveFile;
}
