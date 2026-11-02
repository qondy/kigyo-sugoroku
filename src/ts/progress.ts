import { BUILTIN_TASKS, STAGES } from './steps';
import { AutoRule, CustomTask, MyWhy, Order, OrderStatus, Progress, StageId, TaskView } from './types';

/** 「受注」以上とみなす状態 */
const WON_STATUSES: OrderStatus[] = ['won', 'delivered', 'paid'];
export const isWon = (o: Order): boolean => WON_STATUSES.includes(o.status);

export const monthKey = (date: string): string => date.slice(0, 7);

/** 月ごとの受注額（受注以上の金額の合計） */
export function wonAmountByMonth(orders: Order[]): Map<string, number> {
  const map = new Map<string, number>();
  orders.filter(isWon).forEach((o) => {
    const k = monthKey(o.date);
    map.set(k, (map.get(k) || 0) + o.amount);
  });
  return map;
}

/** 受注ログ（と「わたしのWHY」）から、自動判定のマイルストーンを達成しているか調べる */
export function evaluateAutoRules(orders: Order[], why: MyWhy | null): Set<AutoRule> {
  const won = orders.filter(isWon);
  const done = new Set<AutoRule>();
  if (why) done.add('why-written');
  if (why && why.mission && why.vision && why.values.length) done.add('mvv-written');
  if (won.length >= 1) done.add('first-won');
  if (orders.some((o) => o.status === 'delivered' || o.status === 'paid')) done.add('first-delivered');
  if (orders.some((o) => o.status === 'paid')) done.add('first-paid');
  if (won.length >= 5) done.add('won-5');
  if (won.length >= 20) done.add('won-20');

  const byClient = new Map<string, number>();
  won.forEach((o) => {
    const c = o.client.trim();
    if (c) byClient.set(c, (byClient.get(c) || 0) + 1);
  });
  if (Array.from(byClient.values()).some((n) => n >= 2)) done.add('repeat-client');

  const maxMonth = Math.max(0, ...Array.from(wonAmountByMonth(orders).values()));
  if (maxMonth >= 100_000) done.add('month-100k');
  if (maxMonth >= 300_000) done.add('month-300k');
  return done;
}

/** すごろくのマスの並び（段階ごとに、最初から入っている項目→自分で追加した項目の順） */
export function buildTaskViews(
  progress: Map<string, Progress>,
  custom: CustomTask[],
  autoDone: Set<AutoRule>,
): TaskView[] {
  const views: TaskView[] = [];
  STAGES.forEach((stage) => {
    BUILTIN_TASKS.filter((t) => t.stage === stage.id).forEach((t) => {
      const p = progress.get(t.id);
      const manualDone = p?.done === true;
      const isAutoDone = !!t.auto && autoDone.has(t.auto);
      views.push({
        key: `b:${t.id}`,
        stage: t.stage,
        title: t.title,
        why: t.why,
        how: t.how,
        memo: p?.memo || '',
        auto: t.auto,
        custom: false,
        manualDone,
        autoDone: isAutoDone,
        done: manualDone || isAutoDone,
      });
    });
    custom.filter((c) => c.stage === stage.id).forEach((c) => {
      views.push({
        key: `c:${c.id}`,
        stage: c.stage,
        title: c.title,
        why: '',
        how: '',
        memo: c.memo,
        custom: true,
        manualDone: c.done,
        autoDone: false,
        done: c.done,
      });
    });
  });
  return views;
}

/** いまいる段階 = まだ終わっていない項目がある最初の段階（全部終わっていれば null） */
export function currentStage(views: TaskView[]): StageId | null {
  const t = views.find((v) => !v.done);
  return t ? t.stage : null;
}

/** 受注ログの記録を待つ自動判定マスか（WHY・MVVは自分で書けば進むので含めない） */
const waitsForOrders = (v: TaskView): boolean =>
  !!v.auto && v.auto !== 'why-written' && v.auto !== 'mvv-written';

/**
 * 「次の一手」の候補を優先順に並べる。
 * いまいる段階の未完了項目のうち、自分で動ける項目を先に、受注ログ待ちの項目を後にする。
 */
export function nextMoveCandidates(views: TaskView[]): TaskView[] {
  const stage = currentStage(views);
  if (stage === null) return [];
  const pending = views.filter((v) => v.stage === stage && !v.done);
  return [...pending.filter((v) => !waitsForOrders(v)), ...pending.filter(waitsForOrders)];
}

export interface StageStat {
  stage: StageId;
  done: number;
  total: number;
}

export function stageStats(views: TaskView[]): StageStat[] {
  return STAGES.map((s) => {
    const list = views.filter((v) => v.stage === s.id);
    return { stage: s.id, done: list.filter((v) => v.done).length, total: list.length };
  });
}
