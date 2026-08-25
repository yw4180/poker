/** 房间名、机器人名与机器人台词池 */
const ROOM_NAMES = [
  '竹里馆',
  '听雨轩',
  '云顶牌局',
  '松风阁',
  '桃花坞',
  '落霞小筑',
  '月下棋摊',
  '清风茶座',
  '半山亭',
  '渔舟唱晚',
  '烟雨楼',
  '梅花三弄',
  '踏雪寻梅',
  '一壶浊酒',
  '把酒问月',
  '春江花月',
  '深夜食堂',
  '老地方',
  '牌桌不散',
  '决战到天亮',
  '今晚不睡',
  '打完这局就睡',
];
const BOT_NAMES = [
  '松间月',
  '白鹭',
  '扫地僧',
  '云深不知处',
  '小桥流水',
  '听涛',
  '阿呆',
  '铁算盘',
  '一阵风',
  '半仙',
  '老船长',
  '夜猫子',
  '青衫',
  '琥珀',
  '墨鱼',
  '大聪明',
  '冷月',
  '拂晓',
  '小满',
  '惊蛰',
  '南风知我意',
  '孤舟蓑笠翁',
  '牌神附体',
  '铁面判官',
  '摸鱼大师',
  '快乐牌友',
];

export const BOT_LINES = {
  bigTrick: [
    '这把稳了 😎',
    '分都归我了~',
    '不好意思，手气有点好',
    '哈哈，收下了',
    '这波我来',
    '看我的！',
  ],
  killKitty: ['抠底成功！🎉', '底牌翻倍，谢谢老板', '底给我抠了 😏'],
  roundWin: ['配合愉快 🤝', '升级！再来一局', '轻松拿下', '这局打得漂亮'],
  roundLose: ['大意了…', '下一局翻盘 💪', '牌不好，认了', '你们打得也太好了吧'],
  slow: ['等得我花都谢了 🌸', '快点出牌啦', '在想什么呢？'],
};

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

export function randomRoomName(): string {
  return pick(ROOM_NAMES);
}

/** 从池里挑一个尚未被占用的机器人名 */
export function randomBotName(used: Iterable<string>): string {
  const taken = new Set(used);
  const free = BOT_NAMES.filter((n) => !taken.has(n));
  return free.length ? pick(free) : `${pick(BOT_NAMES)}${Math.floor(Math.random() * 90 + 10)}`;
}

export function botAvatarUrl(name: string): string {
  return `/api/bot-avatar/${encodeURIComponent(name)}.svg`;
}

export const botLine = (kind: keyof typeof BOT_LINES): string => pick(BOT_LINES[kind]);
