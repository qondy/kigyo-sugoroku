export type StageId = 1 | 2 | 3 | 4 | 5;

/** 受注ログから自動で判定するマイルストーン */
export type AutoRule =
  | 'first-won'
  | 'first-delivered'
  | 'first-paid'
  | 'repeat-client'
  | 'won-5'
  | 'won-20'
  | 'month-100k'
  | 'month-300k';

export interface Stage {
  id: StageId;
  name: string;
  goal: string;
}

/** 最初から入っている「やること」（内容はコード側で定義） */
export interface BuiltinTask {
  id: string;
  stage: StageId;
  title: string;
  why: string;
  how: string;
  auto?: AutoRule;
}

/** ユーザーごとの進捗（users/{uid}/progress/{taskId}） */
export interface Progress {
  done: boolean;
  memo: string;
}

/** ユーザーが追加した「やること」（users/{uid}/customTasks/{id}） */
export interface CustomTask {
  id: string;
  stage: StageId;
  title: string;
  memo: string;
  done: boolean;
  createdAt: number;
}

/** 画面表示用にまとめた「やること」 */
export interface TaskView {
  key: string;
  stage: StageId;
  title: string;
  why: string;
  how: string;
  memo: string;
  auto?: AutoRule;
  custom: boolean;
  /** 手動でチェックした */
  manualDone: boolean;
  /** 受注ログから自動で達成した */
  autoDone: boolean;
  done: boolean;
}

export type OrderStatus = 'lead' | 'won' | 'delivered' | 'paid' | 'lost';

export interface OrderData {
  title: string;
  client: string;
  amount: number;
  status: OrderStatus;
  /** YYYY-MM-DD（受注日。相談中は相談日） */
  date: string;
  memo: string;
}

export interface Order extends OrderData {
  id: string;
  createdAt: number;
  updatedAt: number;
}
