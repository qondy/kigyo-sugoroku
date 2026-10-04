import {
  collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { BUILTIN_IDS } from './steps';
import { CustomTask, Order, OrderData, OrderStatus, Progress, StageId } from './types';

export const MAX_TASK_TITLE = 60;
export const MAX_MEMO = 1000;
export const MAX_CUSTOM_TASKS = 100;
export const MAX_ORDER_TITLE = 60;
export const MAX_CLIENT = 40;
export const MAX_AMOUNT = 100_000_000;

export const ORDER_STATUSES: OrderStatus[] = ['lead', 'won', 'delivered', 'paid', 'lost'];

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const msOrZero = (v: unknown): number => (typeof v === 'number' && v > 0 ? v : 0);
const isStage = (v: unknown): v is StageId => v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
const isStatus = (v: unknown): v is OrderStatus => ORDER_STATUSES.includes(v as OrderStatus);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeAmount(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), MAX_AMOUNT);
}

type Unsub = () => void;
type OnError = (err: Error) => void;

// ============================================================
// 進捗（最初から入っている「やること」のチェックとメモ）
// ============================================================
const progressCol = (uid: string) => collection(db, 'users', uid, 'progress');

export function subscribeProgress(
  uid: string,
  onData: (map: Map<string, Progress>) => void,
  onError: OnError,
): Unsub {
  return onSnapshot(progressCol(uid), (snap) => {
    const map = new Map<string, Progress>();
    snap.forEach((d) => {
      if (!BUILTIN_IDS.has(d.id)) return;
      const data = d.data();
      map.set(d.id, { done: data.done === true, memo: str(data.memo, MAX_MEMO) });
    });
    onData(map);
  }, onError);
}

export function saveProgress(uid: string, taskId: string, patch: Partial<Progress>): Promise<void> {
  if (!BUILTIN_IDS.has(taskId)) return Promise.reject(new Error('unknown task'));
  const data: Record<string, unknown> = { updatedAt: Date.now() };
  if (typeof patch.done === 'boolean') data.done = patch.done;
  if (typeof patch.memo === 'string') data.memo = patch.memo.slice(0, MAX_MEMO);
  return setDoc(doc(progressCol(uid), taskId), data, { merge: true });
}

// ============================================================
// 自分で追加した「やること」
// ============================================================
const customCol = (uid: string) => collection(db, 'users', uid, 'customTasks');

export function subscribeCustomTasks(
  uid: string,
  onData: (list: CustomTask[]) => void,
  onError: OnError,
): Unsub {
  return onSnapshot(customCol(uid), (snap) => {
    const list: CustomTask[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (!isStage(data.stage) || typeof data.title !== 'string') return;
      list.push({
        id: d.id,
        stage: data.stage,
        title: str(data.title, MAX_TASK_TITLE),
        memo: str(data.memo, MAX_MEMO),
        done: data.done === true,
        createdAt: msOrZero(data.createdAt),
      });
    });
    list.sort((a, b) => a.createdAt - b.createdAt);
    onData(list);
  }, onError);
}

export async function createCustomTask(uid: string, stage: StageId, title: string, memo: string): Promise<void> {
  await addDoc(customCol(uid), {
    stage,
    title: title.trim().slice(0, MAX_TASK_TITLE),
    memo: memo.slice(0, MAX_MEMO),
    done: false,
    createdAt: Date.now(),
  });
}

export function updateCustomTask(
  uid: string,
  id: string,
  patch: Partial<Pick<CustomTask, 'stage' | 'title' | 'memo' | 'done'>>,
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (isStage(patch.stage)) data.stage = patch.stage;
  if (typeof patch.title === 'string') data.title = patch.title.trim().slice(0, MAX_TASK_TITLE);
  if (typeof patch.memo === 'string') data.memo = patch.memo.slice(0, MAX_MEMO);
  if (typeof patch.done === 'boolean') data.done = patch.done;
  return updateDoc(doc(customCol(uid), id), data);
}

export function deleteCustomTask(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(customCol(uid), id));
}

// ============================================================
// 受注ログ
// ============================================================
const ordersCol = (uid: string) => collection(db, 'users', uid, 'orders');

function sanitizeOrder(data: OrderData): OrderData {
  return {
    title: data.title.trim().slice(0, MAX_ORDER_TITLE),
    client: data.client.trim().slice(0, MAX_CLIENT),
    amount: normalizeAmount(data.amount),
    status: isStatus(data.status) ? data.status : 'lead',
    date: DATE_RE.test(data.date) ? data.date : '',
    memo: data.memo.slice(0, MAX_MEMO),
  };
}

export function subscribeOrders(
  uid: string,
  onData: (list: Order[]) => void,
  onError: OnError,
): Unsub {
  return onSnapshot(ordersCol(uid), (snap) => {
    const list: Order[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const date = str(data.date, 10);
      if (typeof data.title !== 'string' || !DATE_RE.test(date)) return;
      list.push({
        id: d.id,
        title: str(data.title, MAX_ORDER_TITLE),
        client: str(data.client, MAX_CLIENT),
        amount: normalizeAmount(data.amount),
        status: isStatus(data.status) ? data.status : 'lead',
        date,
        memo: str(data.memo, MAX_MEMO),
        createdAt: msOrZero(data.createdAt),
        updatedAt: msOrZero(data.updatedAt),
      });
    });
    onData(list);
  }, onError);
}

export async function createOrder(uid: string, data: OrderData): Promise<void> {
  const now = Date.now();
  await addDoc(ordersCol(uid), { ...sanitizeOrder(data), createdAt: now, updatedAt: now });
}

export function updateOrder(uid: string, id: string, data: OrderData): Promise<void> {
  return updateDoc(doc(ordersCol(uid), id), { ...sanitizeOrder(data), updatedAt: Date.now() });
}

export function setOrderStatus(uid: string, id: string, status: OrderStatus): Promise<void> {
  return updateDoc(doc(ordersCol(uid), id), { status, updatedAt: Date.now() });
}

export function deleteOrder(uid: string, id: string): Promise<void> {
  return deleteDoc(doc(ordersCol(uid), id));
}
