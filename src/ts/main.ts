import { User } from 'firebase/auth';
import { onAuthChange, loginWithGoogle, logout } from './auth';
import { showToast, openOverlay, closeOverlay, textEl, iconEl, button } from './ui';
import { submitFeedback } from './feedback';
import {
  subscribeProgress, saveProgress,
  subscribeCustomTasks, createCustomTask, updateCustomTask, deleteCustomTask,
  subscribeOrders, createOrder, updateOrder, setOrderStatus, deleteOrder,
  normalizeAmount, ORDER_STATUSES, MAX_CUSTOM_TASKS,
} from './store';
import { STAGES, stageName, BUILTIN_TASKS } from './steps';
import {
  evaluateAutoRules, buildTaskViews, nextMoveCandidates, stageStats, currentStage,
  wonAmountByMonth, monthKey, isWon,
} from './progress';
import { AutoRule, CustomTask, Order, OrderData, OrderStatus, Progress, StageId, TaskView } from './types';

// ============================================================
// Icons（開発者定義の固定SVGのみ）
// ============================================================
const svg = (inner: string, size = 18): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICON_CHECK = svg('<path d="M14 34 L26 46 L50 20"/>', 14);
const ICON_PLUS = svg('<path d="M32 14 V50"/><path d="M14 32 H50"/>', 14);
const ICON_AUTO = svg('<path d="M12 22 H44 L36 14"/><path d="M52 42 H20 L28 50"/>', 13);
const ICON_MEMO = svg('<path d="M14 10 H42 L50 18 V54 H14 Z"/><path d="M22 28 H42"/><path d="M22 38 H42"/>', 13);
const ICON_PIECE = svg('<circle cx="32" cy="20" r="9"/><path d="M24 30 L18 52 H46 L40 30"/>', 18);
const ICON_CHEVRON = svg('<path d="M24 14 L42 32 L24 50"/>', 14);

// ============================================================
// DOM refs
// ============================================================
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const loginScreen = $('login-screen');
const appEl = $('app');
const userInfo = $('user-info');
const userAvatar = $<HTMLImageElement>('user-avatar');
const userName = $('user-name');
const btnGoogleLogin = $<HTMLButtonElement>('btn-google-login');
const btnLogout = $<HTMLButtonElement>('btn-logout');

const tabBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.tabs__btn'));
const loadingEl = $('loading');
const panelBoard = $('panel-board');
const panelOrders = $('panel-orders');

const nextMoveEl = $('next-move');
const nextStage = $('next-stage');
const nextTitle = $('next-title');
const nextWhy = $('next-why');
const nextHowWrap = $('next-how-wrap');
const nextHow = $('next-how');
const btnNextDone = $<HTMLButtonElement>('btn-next-done');
const btnNextOrder = $<HTMLButtonElement>('btn-next-order');
const btnNextDetail = $<HTMLButtonElement>('btn-next-detail');
const btnNextOther = $<HTMLButtonElement>('btn-next-other');
const goalCard = $('goal-card');
const overallCount = $('overall-count');
const overallBar = $('overall-bar');
const boardEl = $('board');
const stageListEl = $('stage-list');

const statMonthWon = $('stat-month-won');
const statMonthPaid = $('stat-month-paid');
const statWonCount = $('stat-won-count');
const statLeadCount = $('stat-lead-count');
const monthChart = $('month-chart');
const statusFilterEl = $('status-filter');
const btnNewOrder = $<HTMLButtonElement>('btn-new-order');
const orderList = $('order-list');
const ordersEmpty = $('orders-empty');
const ordersEmptyFilter = $('orders-empty-filter');
const btnEmptyOrder = $<HTMLButtonElement>('btn-empty-order');

const taskOverlay = $('task-overlay');
const taskForm = $<HTMLFormElement>('task-form');
const taskStagePill = $('task-stage-pill');
const taskTitle = $('task-title');
const taskTitleField = $('task-title-field');
const inputTaskTitle = $<HTMLInputElement>('input-task-title');
const taskStageField = $('task-stage-field');
const inputTaskStage = $<HTMLSelectElement>('input-task-stage');
const taskWhyWrap = $('task-why-wrap');
const taskWhy = $('task-why');
const taskHowWrap = $('task-how-wrap');
const taskHow = $('task-how');
const taskAuto = $('task-auto');
const inputTaskDone = $<HTMLInputElement>('input-task-done');
const inputTaskMemo = $<HTMLTextAreaElement>('input-task-memo');
const btnTaskClose = $<HTMLButtonElement>('btn-task-close');
const btnTaskCancel = $<HTMLButtonElement>('btn-task-cancel');
const btnTaskSave = $<HTMLButtonElement>('btn-task-save');
const btnTaskDelete = $<HTMLButtonElement>('btn-task-delete');

const addTaskOverlay = $('add-task-overlay');
const addTaskForm = $<HTMLFormElement>('add-task-form');
const inputAddStage = $<HTMLSelectElement>('input-add-stage');
const inputAddTitle = $<HTMLInputElement>('input-add-title');
const inputAddMemo = $<HTMLTextAreaElement>('input-add-memo');
const btnAddTaskClose = $<HTMLButtonElement>('btn-add-task-close');
const btnAddTaskCancel = $<HTMLButtonElement>('btn-add-task-cancel');
const btnAddTaskSave = $<HTMLButtonElement>('btn-add-task-save');

const orderOverlay = $('order-overlay');
const orderForm = $<HTMLFormElement>('order-form');
const orderModalTitle = $('order-modal-title');
const inputOrderTitle = $<HTMLInputElement>('input-order-title');
const inputOrderClient = $<HTMLInputElement>('input-order-client');
const clientOptions = $('client-options');
const inputOrderAmount = $<HTMLInputElement>('input-order-amount');
const inputOrderDate = $<HTMLInputElement>('input-order-date');
const orderStatusPicker = $('order-status-picker');
const inputOrderMemo = $<HTMLTextAreaElement>('input-order-memo');
const btnOrderClose = $<HTMLButtonElement>('btn-order-close');
const btnOrderCancel = $<HTMLButtonElement>('btn-order-cancel');
const btnOrderSave = $<HTMLButtonElement>('btn-order-save');
const btnOrderDelete = $<HTMLButtonElement>('btn-order-delete');

const celebrateOverlay = $('celebrate-overlay');
const celebrateList = $('celebrate-list');
const btnCelebrateOk = $<HTMLButtonElement>('btn-celebrate-ok');

const confirmOverlay = $('confirm-dialog-overlay');
const confirmDialogTitle = $('confirm-dialog-title');
const confirmDialogText = $('confirm-dialog-text');
const btnConfirmCancel = $<HTMLButtonElement>('btn-confirm-cancel');
const btnConfirmDelete = $<HTMLButtonElement>('btn-confirm-delete');

const feedbackBtn = $<HTMLButtonElement>('feedback-btn');
const feedbackOverlay = $('feedback-modal-overlay');
const inputFeedbackMessage = $<HTMLTextAreaElement>('input-feedback-message');
const btnFeedbackClose = $<HTMLButtonElement>('btn-feedback-close');
const btnFeedbackSend = $<HTMLButtonElement>('btn-feedback-send');

// ============================================================
// State
// ============================================================
type Tab = 'board' | 'orders';
type StatusFilter = OrderStatus | 'all';

const TAB_STORAGE_KEY = 'kigyo-sugoroku:tab';
const OPEN_STAGES_STORAGE_KEY = 'kigyo-sugoroku:open-stages';

const STATUS_LABEL: Record<OrderStatus, string> = {
  lead: '相談中',
  won: '受注',
  delivered: '納品済',
  paid: '入金済',
  lost: '見送り',
};

const AUTO_LABEL: Record<AutoRule, string> = {
  'first-won': '受注ログに「受注」以上の案件が1件',
  'first-delivered': '受注ログに「納品済」以上の案件が1件',
  'first-paid': '受注ログに「入金済」の案件が1件',
  'repeat-client': '同じ取引先の「受注」以上の案件が2件',
  'won-5': '「受注」以上の案件が5件',
  'won-20': '「受注」以上の案件が20件',
  'month-100k': '同じ月の受注額の合計が10万円',
  'month-300k': '同じ月の受注額の合計が30万円',
};

interface State {
  uid: string | null;
  progress: Map<string, Progress>;
  custom: CustomTask[];
  orders: Order[];
  loaded: { progress: boolean; custom: boolean; orders: boolean };
  views: TaskView[];
  tab: Tab;
  /** 「別のやることを見る」で何番目の候補を見ているか */
  nextIndex: number;
  /** 前回の自動達成（お祝い表示の差分判定用。初回読み込み前は null） */
  prevAuto: Set<AutoRule> | null;
  openStages: Set<StageId> | null;
  statusFilter: StatusFilter;
  editingTaskKey: string | null;
  editingOrderId: string | null;
  orderStatus: OrderStatus;
  busy: boolean;
}

const state: State = {
  uid: null,
  progress: new Map(),
  custom: [],
  orders: [],
  loaded: { progress: false, custom: false, orders: false },
  views: [],
  tab: 'board',
  nextIndex: 0,
  prevAuto: null,
  openStages: null,
  statusFilter: 'all',
  editingTaskKey: null,
  editingOrderId: null,
  orderStatus: 'won',
  busy: false,
};

let unsubscribers: (() => void)[] = [];

// ============================================================
// Utils
// ============================================================
const yen = (n: number): string => `${n.toLocaleString('ja-JP')}円`;

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}/${m}/${d}`;
}

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ストレージが使えない環境では保存しない */
  }
}

const isLoaded = (): boolean => state.loaded.progress && state.loaded.custom && state.loaded.orders;

function stageOptions(select: HTMLSelectElement, selected: StageId): void {
  select.replaceChildren();
  STAGES.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = String(s.id);
    opt.textContent = `${s.id}. ${s.name}`;
    opt.selected = s.id === selected;
    select.appendChild(opt);
  });
}

const parseStage = (v: string): StageId => {
  const n = Number(v);
  return (n >= 1 && n <= 5 ? n : 1) as StageId;
};

function handleError(err: unknown, message: string): void {
  console.error(err);
  showToast(message);
}

// ============================================================
// Confirm dialog（カスタムUI）
// ============================================================
let confirmResolver: ((ok: boolean) => void) | null = null;

function askConfirm(title: string, text: string, okLabel = '削除する'): Promise<boolean> {
  confirmDialogTitle.textContent = title;
  confirmDialogText.textContent = text;
  btnConfirmDelete.textContent = okLabel;
  openOverlay(confirmOverlay);
  btnConfirmCancel.focus();
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function settleConfirm(ok: boolean): void {
  closeOverlay(confirmOverlay);
  const r = confirmResolver;
  confirmResolver = null;
  if (r) r(ok);
}

btnConfirmCancel.addEventListener('click', () => settleConfirm(false));
btnConfirmDelete.addEventListener('click', () => settleConfirm(true));

// ============================================================
// Tabs
// ============================================================
function setTab(tab: Tab): void {
  state.tab = tab;
  lsSet(TAB_STORAGE_KEY, tab);
  tabBtns.forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', String(active));
  });
  if (!isLoaded()) return;
  panelBoard.classList.toggle('hidden', tab !== 'board');
  panelOrders.classList.toggle('hidden', tab !== 'orders');
}

tabBtns.forEach((b) => b.addEventListener('click', () => {
  setTab(b.dataset.tab === 'orders' ? 'orders' : 'board');
  window.scrollTo({ top: 0 });
}));

// ============================================================
// Render: すごろく
// ============================================================
function recompute(): void {
  const autoDone = evaluateAutoRules(state.orders);
  state.views = buildTaskViews(state.progress, state.custom, autoDone);

  // 受注ログの変化で新しくマスが進んだらお祝いする（初回読み込み時は除く）
  if (state.loaded.orders) {
    if (state.prevAuto) {
      const prev = state.prevAuto;
      const newly = BUILTIN_TASKS.filter((t) => t.auto && autoDone.has(t.auto) && !prev.has(t.auto));
      if (newly.length) showCelebrate(newly.map((t) => t.title));
    }
    state.prevAuto = autoDone;
  }
}

function render(): void {
  if (!isLoaded()) return;
  loadingEl.classList.add('hidden');
  setTab(state.tab);
  renderNextMove();
  renderBoard();
  renderStageList();
  renderOrders();
}

function renderNextMove(): void {
  const candidates = nextMoveCandidates(state.views);
  if (!candidates.length) {
    nextMoveEl.classList.add('hidden');
    goalCard.classList.remove('hidden');
    return;
  }
  nextMoveEl.classList.remove('hidden');
  goalCard.classList.add('hidden');

  if (state.nextIndex >= candidates.length) state.nextIndex = 0;
  const t = candidates[state.nextIndex];
  nextStage.textContent = `ステージ${t.stage}「${stageName(t.stage)}」`;
  nextTitle.textContent = t.title;
  nextWhy.textContent = t.why || (t.custom ? 'あなたが追加したやることです。' : '');
  nextWhy.classList.toggle('hidden', !nextWhy.textContent);
  nextHow.textContent = t.how;
  nextHowWrap.classList.toggle('hidden', !t.how);
  btnNextDone.classList.toggle('hidden', !!t.auto);
  btnNextOrder.classList.toggle('hidden', !t.auto);
  btnNextOther.classList.toggle('hidden', candidates.length < 2);
  btnNextDone.dataset.key = t.key;
  btnNextDetail.dataset.key = t.key;
}

function renderBoard(): void {
  const total = state.views.length;
  const done = state.views.filter((v) => v.done).length;
  overallCount.textContent = `${total}マス中 ${done}マス`;
  overallBar.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;

  const candidates = nextMoveCandidates(state.views);
  const pieceKey = candidates.length ? candidates[Math.min(state.nextIndex, candidates.length - 1)].key : null;

  boardEl.replaceChildren();
  const start = textEl('span', 'board__cell board__cell--start', 'ふりだし');
  boardEl.appendChild(start);
  let n = 0;
  state.views.forEach((v, i) => {
    n += 1;
    const isStageStart = i === 0 || state.views[i - 1].stage !== v.stage;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'board__cell';
    cell.dataset.stage = String(v.stage);
    if (isStageStart) cell.classList.add('is-stage-start');
    if (v.done) cell.classList.add('is-done');
    if (v.key === pieceKey) cell.classList.add('is-current');
    cell.setAttribute('aria-label', `${n}マス目：${v.title}${v.done ? '（完了）' : ''}`);
    cell.title = v.title;
    if (v.key === pieceKey) {
      cell.appendChild(iconEl(ICON_PIECE, 'board__piece'));
    } else if (v.done) {
      cell.appendChild(iconEl(ICON_CHECK, 'board__check'));
    } else {
      cell.appendChild(textEl('span', 'board__num', String(n)));
    }
    cell.addEventListener('click', () => openTask(v.key));
    boardEl.appendChild(cell);
  });
  const goal = textEl('span', 'board__cell board__cell--goal', 'あがり');
  if (!candidates.length) goal.classList.add('is-reached');
  boardEl.appendChild(goal);
}

function loadOpenStages(): Set<StageId> {
  const raw = lsGet(OPEN_STAGES_STORAGE_KEY);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map((v) => parseStage(String(v))));
    } catch {
      /* 壊れていたら初期値に戻す */
    }
  }
  const cur = currentStage(state.views);
  return new Set<StageId>(cur ? [cur] : []);
}

function saveOpenStages(): void {
  if (state.openStages) lsSet(OPEN_STAGES_STORAGE_KEY, JSON.stringify(Array.from(state.openStages)));
}

function renderStageList(): void {
  if (!state.openStages) state.openStages = loadOpenStages();
  const stats = stageStats(state.views);
  const cur = currentStage(state.views);

  stageListEl.replaceChildren();
  STAGES.forEach((stage) => {
    const stat = stats[stage.id - 1];
    const open = state.openStages!.has(stage.id);
    const section = document.createElement('section');
    section.className = 'stage card-surface';
    if (stat.done === stat.total && stat.total > 0) section.classList.add('is-complete');
    if (stage.id === cur) section.classList.add('is-current');

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'stage__head';
    head.setAttribute('aria-expanded', String(open));
    head.appendChild(textEl('span', 'stage__num', String(stage.id)));
    const titles = document.createElement('span');
    titles.className = 'stage__titles';
    const nameRow = textEl('span', 'stage__name', stage.name);
    if (stage.id === cur) nameRow.appendChild(textEl('span', 'stage__now', 'いまここ'));
    titles.appendChild(nameRow);
    titles.appendChild(textEl('span', 'stage__goal', stage.goal));
    head.appendChild(titles);
    const meta = document.createElement('span');
    meta.className = 'stage__meta';
    meta.appendChild(textEl('span', 'stage__count', `${stat.done}/${stat.total}`));
    const bar = document.createElement('span');
    bar.className = 'bar bar--sm';
    const fill = document.createElement('span');
    fill.className = 'bar__fill';
    fill.style.width = `${stat.total ? Math.round((stat.done / stat.total) * 100) : 0}%`;
    bar.appendChild(fill);
    meta.appendChild(bar);
    head.appendChild(meta);
    head.appendChild(iconEl(ICON_CHEVRON, 'stage__chevron'));
    head.addEventListener('click', () => {
      if (state.openStages!.has(stage.id)) state.openStages!.delete(stage.id);
      else state.openStages!.add(stage.id);
      saveOpenStages();
      renderStageList();
    });
    section.appendChild(head);

    if (open) {
      const ul = document.createElement('ul');
      ul.className = 'task-list';
      state.views.filter((v) => v.stage === stage.id).forEach((v) => ul.appendChild(renderTaskRow(v)));
      section.appendChild(ul);
      const add = button('', 'stage__add', () => openAddTask(stage.id));
      add.appendChild(iconEl(ICON_PLUS));
      add.appendChild(textEl('span', '', 'やることを追加'));
      section.appendChild(add);
    }
    stageListEl.appendChild(section);
  });
}

function renderTaskRow(v: TaskView): HTMLElement {
  const li = document.createElement('li');
  li.className = 'task-row';
  if (v.done) li.classList.add('is-done');

  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'task-row__check';
  check.setAttribute('aria-pressed', String(v.done));
  check.setAttribute('aria-label', v.done ? `「${v.title}」を未完了に戻す` : `「${v.title}」を完了にする`);
  if (v.done) check.appendChild(iconEl(ICON_CHECK));
  if (v.autoDone && !v.manualDone) {
    check.disabled = true;
    check.title = '受注ログから自動で達成しました';
  }
  check.addEventListener('click', () => toggleDone(v.key, !v.manualDone));
  li.appendChild(check);

  const body = document.createElement('button');
  body.type = 'button';
  body.className = 'task-row__body';
  body.appendChild(textEl('span', 'task-row__title', v.title));
  const tags = document.createElement('span');
  tags.className = 'task-row__tags';
  if (v.auto) {
    const t = iconEl(ICON_AUTO, 'tag tag--auto');
    t.appendChild(document.createTextNode(v.autoDone ? '受注ログで達成' : '受注ログで自動判定'));
    tags.appendChild(t);
  }
  if (v.custom) tags.appendChild(textEl('span', 'tag', '自分で追加'));
  if (v.memo) {
    const m = iconEl(ICON_MEMO, 'tag');
    m.appendChild(document.createTextNode('メモあり'));
    tags.appendChild(m);
  }
  if (tags.childNodes.length) body.appendChild(tags);
  body.addEventListener('click', () => openTask(v.key));
  li.appendChild(body);
  return li;
}

// ============================================================
// やることの完了・編集
// ============================================================
const findView = (key: string): TaskView | undefined => state.views.find((v) => v.key === key);

async function toggleDone(key: string, done: boolean): Promise<void> {
  if (!state.uid || state.busy) return;
  const v = findView(key);
  if (!v) return;
  state.busy = true;
  try {
    if (v.custom) await updateCustomTask(state.uid, key.slice(2), { done });
    else await saveProgress(state.uid, key.slice(2), { done });
    if (done) {
      state.nextIndex = 0;
      showToast(`1マス進みました：${v.title}`);
    }
  } catch (err) {
    handleError(err, '保存できませんでした。通信状況を確認してください。');
  } finally {
    state.busy = false;
  }
}

function openTask(key: string): void {
  const v = findView(key);
  if (!v) return;
  state.editingTaskKey = key;
  taskStagePill.textContent = `ステージ${v.stage}「${stageName(v.stage)}」`;
  taskTitle.textContent = v.title;
  taskTitle.classList.toggle('hidden', v.custom);
  taskTitleField.classList.toggle('hidden', !v.custom);
  taskStageField.classList.toggle('hidden', !v.custom);
  inputTaskTitle.value = v.title;
  stageOptions(inputTaskStage, v.stage);
  taskWhy.textContent = v.why;
  taskWhyWrap.classList.toggle('hidden', !v.why);
  taskHow.textContent = v.how;
  taskHowWrap.classList.toggle('hidden', !v.how);

  if (v.auto) {
    taskAuto.textContent = v.autoDone
      ? `受注ログから自動で達成しました（${AUTO_LABEL[v.auto]}）。`
      : `受注ログに記録すると自動で達成します（${AUTO_LABEL[v.auto]}）。このアプリを使う前に達成済みなら、下のチェックで完了にできます。`;
    taskAuto.classList.remove('hidden');
  } else {
    taskAuto.classList.add('hidden');
  }
  inputTaskDone.checked = v.manualDone || v.autoDone;
  inputTaskDone.disabled = v.autoDone && !v.manualDone;
  inputTaskMemo.value = v.memo;
  btnTaskDelete.classList.toggle('hidden', !v.custom);
  btnTaskSave.disabled = false;
  openOverlay(taskOverlay);
}

function closeTask(): void {
  closeOverlay(taskOverlay);
  state.editingTaskKey = null;
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = state.editingTaskKey;
  const v = key ? findView(key) : undefined;
  if (!state.uid || !key || !v || state.busy) return;

  const memo = inputTaskMemo.value;
  const done = inputTaskDone.disabled ? v.manualDone : inputTaskDone.checked;
  let title = v.title;
  if (v.custom) {
    title = inputTaskTitle.value.trim();
    if (!title) {
      showToast('やることを入力してください');
      inputTaskTitle.focus();
      return;
    }
  }

  state.busy = true;
  btnTaskSave.disabled = true;
  try {
    if (v.custom) {
      await updateCustomTask(state.uid, key.slice(2), {
        title, memo, done, stage: parseStage(inputTaskStage.value),
      });
    } else {
      await saveProgress(state.uid, key.slice(2), { memo, done });
    }
    if (done && !v.done) {
      state.nextIndex = 0;
      showToast(`1マス進みました：${title}`);
    } else {
      showToast('保存しました');
    }
    closeTask();
  } catch (err) {
    handleError(err, '保存できませんでした。通信状況を確認してください。');
  } finally {
    state.busy = false;
    btnTaskSave.disabled = false;
  }
});

btnTaskClose.addEventListener('click', closeTask);
btnTaskCancel.addEventListener('click', closeTask);

btnTaskDelete.addEventListener('click', async () => {
  const key = state.editingTaskKey;
  const v = key ? findView(key) : undefined;
  if (!state.uid || !key || !v || !v.custom) return;
  const ok = await askConfirm('このやることを削除しますか？', `「${v.title}」を削除します。メモも一緒に消え、元に戻せません。`);
  if (!ok || !state.uid || state.busy) return;
  state.busy = true;
  try {
    await deleteCustomTask(state.uid, key.slice(2));
    closeTask();
    showToast('削除しました');
  } catch (err) {
    handleError(err, '削除できませんでした。通信状況を確認してください。');
  } finally {
    state.busy = false;
  }
});

// ----- 追加 -----
function openAddTask(stage: StageId): void {
  if (state.custom.length >= MAX_CUSTOM_TASKS) {
    showToast(`追加できるのは${MAX_CUSTOM_TASKS}件までです`);
    return;
  }
  stageOptions(inputAddStage, stage);
  inputAddTitle.value = '';
  inputAddMemo.value = '';
  btnAddTaskSave.disabled = false;
  openOverlay(addTaskOverlay);
  inputAddTitle.focus();
}

const closeAddTask = (): void => closeOverlay(addTaskOverlay);
btnAddTaskClose.addEventListener('click', closeAddTask);
btnAddTaskCancel.addEventListener('click', closeAddTask);

addTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.uid || state.busy) return;
  const title = inputAddTitle.value.trim();
  if (!title) {
    showToast('やることを入力してください');
    inputAddTitle.focus();
    return;
  }
  const stage = parseStage(inputAddStage.value);
  state.busy = true;
  btnAddTaskSave.disabled = true;
  try {
    await createCustomTask(state.uid, stage, title, inputAddMemo.value);
    state.openStages?.add(stage);
    saveOpenStages();
    closeAddTask();
    showToast('やることを追加しました');
  } catch (err) {
    handleError(err, '追加できませんでした。通信状況を確認してください。');
  } finally {
    state.busy = false;
    btnAddTaskSave.disabled = false;
  }
});

// ----- 次の一手 -----
btnNextDone.addEventListener('click', () => {
  const key = btnNextDone.dataset.key;
  if (key) toggleDone(key, true);
});
btnNextDetail.addEventListener('click', () => {
  const key = btnNextDetail.dataset.key;
  if (key) openTask(key);
});
btnNextOther.addEventListener('click', () => {
  state.nextIndex += 1;
  renderNextMove();
  renderBoard();
});
btnNextOrder.addEventListener('click', () => {
  setTab('orders');
  openOrder(null);
});

// ============================================================
// Render: 受注ログ
// ============================================================
function renderOrders(): void {
  const thisMonth = monthKey(todayStr());
  const won = state.orders.filter(isWon);
  const monthWon = won.filter((o) => monthKey(o.date) === thisMonth).reduce((s, o) => s + o.amount, 0);
  const monthPaid = state.orders
    .filter((o) => o.status === 'paid' && monthKey(o.date) === thisMonth)
    .reduce((s, o) => s + o.amount, 0);
  statMonthWon.textContent = yen(monthWon);
  statMonthPaid.textContent = yen(monthPaid);
  statWonCount.textContent = `${won.length}件`;
  statLeadCount.textContent = `${state.orders.filter((o) => o.status === 'lead').length}件`;

  renderMonthChart();
  renderStatusFilter();

  const sorted = [...state.orders].sort((a, b) => (b.date.localeCompare(a.date)) || (b.createdAt - a.createdAt));
  const list = state.statusFilter === 'all' ? sorted : sorted.filter((o) => o.status === state.statusFilter);

  orderList.replaceChildren();
  list.forEach((o) => orderList.appendChild(renderOrderRow(o)));
  ordersEmpty.classList.toggle('hidden', state.orders.length > 0);
  ordersEmptyFilter.classList.toggle('hidden', state.orders.length === 0 || list.length > 0);

  clientOptions.replaceChildren();
  Array.from(new Set(state.orders.map((o) => o.client).filter(Boolean))).forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    clientOptions.appendChild(opt);
  });
}

function renderMonthChart(): void {
  const byMonth = wonAmountByMonth(state.orders);
  const now = new Date();
  const months: { key: string; label: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: `${d.getMonth() + 1}月`, amount: byMonth.get(key) || 0 });
  }
  const max = Math.max(1, ...months.map((m) => m.amount));
  monthChart.replaceChildren();
  months.forEach((m) => {
    const col = document.createElement('div');
    col.className = 'chart__col';
    col.setAttribute('aria-label', `${m.label}：${yen(m.amount)}`);
    const value = textEl('span', 'chart__value', m.amount ? `${Math.round(m.amount / 1000).toLocaleString('ja-JP')}k` : '');
    const track = document.createElement('span');
    track.className = 'chart__track';
    const fill = document.createElement('span');
    fill.className = 'chart__fill';
    fill.style.height = `${Math.round((m.amount / max) * 100)}%`;
    track.appendChild(fill);
    col.appendChild(value);
    col.appendChild(track);
    col.appendChild(textEl('span', 'chart__label', m.label));
    monthChart.appendChild(col);
  });
}

function renderStatusFilter(): void {
  const filters: StatusFilter[] = ['all', ...ORDER_STATUSES];
  statusFilterEl.replaceChildren();
  filters.forEach((f) => {
    const count = f === 'all' ? state.orders.length : state.orders.filter((o) => o.status === f).length;
    const label = f === 'all' ? 'すべて' : STATUS_LABEL[f];
    const chip = button(`${label} ${count}`, 'chip', () => {
      state.statusFilter = f;
      renderOrders();
    });
    chip.classList.toggle('is-active', state.statusFilter === f);
    chip.setAttribute('aria-pressed', String(state.statusFilter === f));
    statusFilterEl.appendChild(chip);
  });
}

function renderOrderRow(o: Order): HTMLElement {
  const li = document.createElement('li');
  li.className = 'order card-surface';
  li.dataset.status = o.status;

  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'order__main';
  main.appendChild(textEl('span', 'order__title', o.title));
  const meta = document.createElement('span');
  meta.className = 'order__meta';
  meta.appendChild(textEl('span', '', formatDate(o.date)));
  if (o.client) meta.appendChild(textEl('span', '', o.client));
  main.appendChild(meta);
  if (o.memo) main.appendChild(textEl('span', 'order__memo', o.memo));
  main.addEventListener('click', () => openOrder(o.id));
  li.appendChild(main);

  const side = document.createElement('div');
  side.className = 'order__side';
  side.appendChild(textEl('span', 'order__amount', yen(o.amount)));
  const select = document.createElement('select');
  select.className = `status-select status-select--${o.status}`;
  select.setAttribute('aria-label', `「${o.title}」の状態`);
  ORDER_STATUSES.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = STATUS_LABEL[s];
    opt.selected = s === o.status;
    select.appendChild(opt);
  });
  select.addEventListener('change', async () => {
    if (!state.uid) return;
    const next = select.value as OrderStatus;
    select.disabled = true;
    try {
      await setOrderStatus(state.uid, o.id, next);
      showToast(`「${STATUS_LABEL[next]}」にしました`);
    } catch (err) {
      select.value = o.status;
      handleError(err, '状態を変更できませんでした。通信状況を確認してください。');
    } finally {
      select.disabled = false;
    }
  });
  side.appendChild(select);
  li.appendChild(side);
  return li;
}

// ----- 案件の記録・編集 -----
function renderStatusPicker(): void {
  orderStatusPicker.replaceChildren();
  ORDER_STATUSES.forEach((s) => {
    const b = button(STATUS_LABEL[s], `status-option status-option--${s}`, () => {
      state.orderStatus = s;
      renderStatusPicker();
    });
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(state.orderStatus === s));
    b.classList.toggle('is-active', state.orderStatus === s);
    orderStatusPicker.appendChild(b);
  });
}

function openOrder(id: string | null): void {
  const o = id ? state.orders.find((x) => x.id === id) : undefined;
  state.editingOrderId = o ? o.id : null;
  orderModalTitle.textContent = o ? '案件を編集' : '案件を記録';
  inputOrderTitle.value = o?.title || '';
  inputOrderClient.value = o?.client || '';
  inputOrderAmount.value = o && o.amount ? String(o.amount) : '';
  inputOrderDate.value = o?.date || todayStr();
  inputOrderMemo.value = o?.memo || '';
  state.orderStatus = o?.status || 'won';
  renderStatusPicker();
  btnOrderDelete.classList.toggle('hidden', !o);
  btnOrderSave.disabled = false;
  openOverlay(orderOverlay);
  if (!o) inputOrderTitle.focus();
}

function closeOrder(): void {
  closeOverlay(orderOverlay);
  state.editingOrderId = null;
}

btnOrderClose.addEventListener('click', closeOrder);
btnOrderCancel.addEventListener('click', closeOrder);
btnNewOrder.addEventListener('click', () => openOrder(null));
btnEmptyOrder.addEventListener('click', () => openOrder(null));

// 全角数字・カンマ・「円」を許容して数値に直す
function parseAmountInput(raw: string): number | null {
  const s = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，、円\s]/g, '');
  if (!s) return 0;
  if (!/^\d+$/.test(s)) return null;
  return normalizeAmount(Number(s));
}

orderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.uid || state.busy) return;
  const title = inputOrderTitle.value.trim();
  if (!title) {
    showToast('案件名を入力してください');
    inputOrderTitle.focus();
    return;
  }
  const amount = parseAmountInput(inputOrderAmount.value);
  if (amount === null) {
    showToast('金額は数字で入力してください');
    inputOrderAmount.focus();
    return;
  }
  const date = inputOrderDate.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    showToast('日付を入力してください');
    inputOrderDate.focus();
    return;
  }
  const data: OrderData = {
    title,
    client: inputOrderClient.value,
    amount,
    status: state.orderStatus,
    date,
    memo: inputOrderMemo.value,
  };

  state.busy = true;
  btnOrderSave.disabled = true;
  try {
    if (state.editingOrderId) await updateOrder(state.uid, state.editingOrderId, data);
    else await createOrder(state.uid, data);
    showToast(state.editingOrderId ? '保存しました' : '記録しました');
    closeOrder();
  } catch (err) {
    handleError(err, '保存できませんでした。通信状況を確認してください。');
  } finally {
    state.busy = false;
    btnOrderSave.disabled = false;
  }
});

btnOrderDelete.addEventListener('click', async () => {
  const id = state.editingOrderId;
  const o = id ? state.orders.find((x) => x.id === id) : undefined;
  if (!state.uid || !o) return;
  const ok = await askConfirm('この案件を削除しますか？', `「${o.title}」の記録を削除します。元に戻せません。`);
  if (!ok || !state.uid || state.busy) return;
  state.busy = true;
  try {
    await deleteOrder(state.uid, o.id);
    closeOrder();
    showToast('削除しました');
  } catch (err) {
    handleError(err, '削除できませんでした。通信状況を確認してください。');
  } finally {
    state.busy = false;
  }
});

// ============================================================
// お祝い
// ============================================================
function showCelebrate(titles: string[]): void {
  celebrateList.replaceChildren();
  titles.forEach((t) => celebrateList.appendChild(textEl('li', '', t)));
  openOverlay(celebrateOverlay);
}

btnCelebrateOk.addEventListener('click', () => {
  closeOverlay(celebrateOverlay);
  closeOrder();
  setTab('board');
  window.scrollTo({ top: 0 });
});

// ============================================================
// Feedback
// ============================================================
feedbackBtn.addEventListener('click', () => {
  openOverlay(feedbackOverlay);
  inputFeedbackMessage.focus();
});
btnFeedbackClose.addEventListener('click', () => closeOverlay(feedbackOverlay));
btnFeedbackSend.addEventListener('click', async () => {
  const message = inputFeedbackMessage.value.trim();
  if (!message) {
    showToast('内容を入力してください');
    return;
  }
  btnFeedbackSend.disabled = true;
  const ok = await submitFeedback(message);
  btnFeedbackSend.disabled = false;
  if (ok) {
    inputFeedbackMessage.value = '';
    closeOverlay(feedbackOverlay);
    showToast('送信しました。ありがとうございます！');
  } else {
    showToast('送信できませんでした。時間をおいて再度お試しください。');
  }
});

// ============================================================
// Overlay の共通操作（背景クリック・Escで閉じる）
// ============================================================
const closers: [HTMLElement, () => void][] = [
  [taskOverlay, closeTask],
  [addTaskOverlay, closeAddTask],
  [orderOverlay, closeOrder],
  [feedbackOverlay, () => closeOverlay(feedbackOverlay)],
  [celebrateOverlay, () => closeOverlay(celebrateOverlay)],
  [confirmOverlay, () => settleConfirm(false)],
];

closers.forEach(([overlay, close]) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // いちばん手前（後に定義したもの）から閉じる
  for (let i = closers.length - 1; i >= 0; i -= 1) {
    const [overlay, close] = closers[i];
    if (overlay.classList.contains('is-open')) {
      close();
      return;
    }
  }
});

// ============================================================
// Auth
// ============================================================
btnGoogleLogin.addEventListener('click', async () => {
  btnGoogleLogin.disabled = true;
  try {
    await loginWithGoogle();
  } catch (err) {
    const code = (err as { code?: string }).code || '';
    if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      handleError(err, 'ログインできませんでした。もう一度お試しください。');
    }
  } finally {
    btnGoogleLogin.disabled = false;
  }
});

btnLogout.addEventListener('click', async () => {
  try {
    await logout();
  } catch (err) {
    handleError(err, 'ログアウトできませんでした。');
  }
});

function resetState(): void {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  state.uid = null;
  state.progress = new Map();
  state.custom = [];
  state.orders = [];
  state.loaded = { progress: false, custom: false, orders: false };
  state.views = [];
  state.nextIndex = 0;
  state.prevAuto = null;
  state.openStages = null;
  state.statusFilter = 'all';
}

function onDataError(err: Error): void {
  handleError(err, 'データを読み込めませんでした。再読み込みしてください。');
  loadingEl.textContent = 'データを読み込めませんでした。ページを再読み込みしてください。';
}

function startSync(uid: string): void {
  unsubscribers.push(subscribeProgress(uid, (map) => {
    state.progress = map;
    state.loaded.progress = true;
    recompute();
    render();
  }, onDataError));
  unsubscribers.push(subscribeCustomTasks(uid, (list) => {
    state.custom = list;
    state.loaded.custom = true;
    recompute();
    render();
  }, onDataError));
  unsubscribers.push(subscribeOrders(uid, (list) => {
    state.orders = list;
    state.loaded.orders = true;
    recompute();
    render();
  }, onDataError));
}

onAuthChange((user: User | null) => {
  resetState();
  if (!user) {
    loginScreen.classList.remove('hidden');
    appEl.classList.add('hidden');
    userInfo.classList.add('hidden');
    return;
  }
  state.uid = user.uid;
  loginScreen.classList.add('hidden');
  appEl.classList.remove('hidden');
  userInfo.classList.remove('hidden');
  userAvatar.src = user.photoURL || '';
  userAvatar.classList.toggle('hidden', !user.photoURL);
  userName.textContent = user.displayName || '';
  loadingEl.textContent = '読み込み中…';
  loadingEl.classList.remove('hidden');
  panelBoard.classList.add('hidden');
  panelOrders.classList.add('hidden');
  state.tab = lsGet(TAB_STORAGE_KEY) === 'orders' ? 'orders' : 'board';
  setTab(state.tab);
  startSync(user.uid);
});
