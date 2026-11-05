/**
 * Hệ Thống Công Đức & Bảng Xếp Hạng Phẩm Vị Trong Chùa Hải An.
 * Lưu trữ bền vững trên trình duyệt (localStorage) và kết hợp hiển thị
 * cùng các Phật tử trong phòng chung + Bảng Vàng Công Đức Chùa Hải An.
 */

export type MeritActionKey =
  | 'incense'
  | 'chant'
  | 'hall_pray'
  | 'fish_release'
  | 'bath_buddha'
  | 'sweep_leaves'
  | 'water_garden'
  | 'ring_bell'
  | 'fortune_stick'
  | 'wishing_plaque'
  | 'lotus_lantern'
  | 'stupa_walk'
  | 'hsk_boat'
  | 'monk_talk';

export interface MeritActionInfo {
  key: MeritActionKey;
  label: string;
  points: number;
  icon: string;
  desc: string;
}

export const MERIT_ACTIONS: Record<MeritActionKey, MeritActionInfo> = {
  incense: {
    key: 'incense',
    label: 'Dâng hương lễ Phật tại Đỉnh đồng',
    points: 15,
    icon: '🔥',
    desc: 'Thành tâm dâng nén tâm hương trước sân Đại Hùng Bảo Điện',
  },
  chant: {
    key: 'chant',
    label: 'Tụng kinh · Niệm Phật & Hồi hướng',
    points: 30,
    icon: '📿',
    desc: 'Ngồi tại tọa cụ lắng nghe kinh kệ, tụng niệm và hồi hướng phước báu',
  },
  hall_pray: {
    key: 'hall_pray',
    label: 'Quỳ lễ & Phát nguyện trong Chính điện',
    points: 15,
    icon: '🙇',
    desc: 'Quỳ lễ hoặc tọa thiền trang nghiêm trước Phật đài Quán Thế Âm',
  },
  fish_release: {
    key: 'fish_release',
    label: 'Thả cá phóng sinh tại Tâm Liên Hồ',
    points: 20,
    icon: '🐟',
    desc: 'Nâng bát sành nhẹ tay thả cá chép Koi về với làn nước mát',
  },
  bath_buddha: {
    key: 'bath_buddha',
    label: 'Lễ Tắm Phật Đản Sinh tại Vườn Lâm Tỳ Ni',
    points: 30,
    icon: '🛁',
    desc: 'Ba lần rưới nước thơm tắm tôn tượng Thái tử Tất Đạt Đa đản sinh',
  },
  sweep_leaves: {
    key: 'sweep_leaves',
    label: 'Chấp tác quét lá dưới Cây đa Bách Linh',
    points: 25,
    icon: '🧹',
    desc: 'Quét dọn lá đa rơi trả lại sân chùa sạch sẽ, thanh tịnh',
  },
  water_garden: {
    key: 'water_garden',
    label: 'Cầm gáo tưới rau tại Vườn Lộc Uyển',
    points: 20,
    icon: '🪣',
    desc: 'Múc nước từ lu sành và cầm gáo gỗ tưới xanh luống rau nhà chùa',
  },
  ring_bell: {
    key: 'ring_bell',
    label: 'Thỉnh Đại Hồng Chuông tại Gác Chuông',
    points: 10,
    icon: '🔔',
    desc: 'Thỉnh tiếng chuông chùa ngân vang thức tỉnh chánh niệm',
  },
  fortune_stick: {
    key: 'fortune_stick',
    label: 'Xin xâm Từ Bi đầu năm trong Chính điện',
    points: 10,
    icon: '🎋',
    desc: 'Lắc ống xâm tre đón nhận lời kệ Phật pháp hướng thiện',
  },
  wishing_plaque: {
    key: 'wishing_plaque',
    label: 'Treo thẻ gỗ ước nguyện Bồ Đề',
    points: 15,
    icon: '🎋',
    desc: 'Viết lời nguyện lành lên thẻ gỗ đỏ thếp vàng dưới tán đa cổ thụ',
  },
  lotus_lantern: {
    key: 'lotus_lantern',
    label: 'Thả đèn Hoa Đăng cầu nguyện bình an',
    points: 15,
    icon: '🪷',
    desc: 'Thắp sáng ngọn đèn hoa sen thả trên Tâm Liên Hồ & Sông Bát Nhã',
  },
  stupa_walk: {
    key: 'stupa_walk',
    label: 'Kinh hành nhiễu Bảo Tháp Báo Ân 7 tầng',
    points: 25,
    icon: '🏯',
    desc: 'Đi kinh hành chánh niệm theo chiều kim đồng hồ quanh Bảo Tháp 7 tầng',
  },
  hsk_boat: {
    key: 'hsk_boat',
    label: 'Đi thuyền vượt Sông Bát Nhã sang Đảo HSK',
    points: 20,
    icon: '⛵',
    desc: 'Lên thuyền Độ Sinh qua sông cầu học tập tinh tấn tại Đảo HSK',
  },
  monk_talk: {
    key: 'monk_talk',
    label: 'Vấn đạo học lễ cùng Chú tiểu trong chùa',
    points: 10,
    icon: '🙏',
    desc: 'Trò chuyện với Chú tiểu Tâm An, Tâm Minh tìm hiểu nếp sống thiền môn',
  },
};

export interface MeritRank {
  level: number;
  title: string;
  badge: string;
  minPoints: number;
  nextPoints: number | null;
  color: string;
  bgClass: string;
  meaning: string;
}

export const MERIT_RANKS: MeritRank[] = [
  {
    level: 1,
    title: 'Thiện Tín Sơ Tâm',
    badge: '🌱',
    minPoints: 0,
    nextPoints: 50,
    color: '#6b7280',
    bgClass: 'bg-stone-100 text-stone-800 border-stone-300',
    meaning: 'Người mới khởi tâm hướng thiện, bước qua Cổng Tam Quan tìm về chốn bình yên.',
  },
  {
    level: 2,
    title: 'Phật Tử Tinh Tấn',
    badge: '🪷',
    minPoints: 50,
    nextPoints: 130,
    color: '#0d9488',
    bgClass: 'bg-teal-50 text-teal-900 border-teal-300',
    meaning: 'Biết đi nhẹ nói khẽ nơi Chính điện, thành tâm dâng hương và lễ bái Tam Bảo.',
  },
  {
    level: 3,
    title: 'Cư Sĩ Tri Khách',
    badge: '📿',
    minPoints: 130,
    nextPoints: 240,
    color: '#2563eb',
    bgClass: 'bg-sky-50 text-sky-900 border-sky-300',
    meaning: 'Chăm chỉ ngồi tọa cụ tụng kinh, niệm Phật và phóng sinh gieo duyên lành.',
  },
  {
    level: 4,
    title: 'Hộ Pháp Thiện Tâm',
    badge: '🎋',
    minPoints: 240,
    nextPoints: 380,
    color: '#16a34a',
    bgClass: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    meaning: 'Siêng năng chấp tác quét lá đa, tưới rau Vườn Lộc Uyển, hộ trì cảnh chùa thanh tịnh.',
  },
  {
    level: 5,
    title: 'Hiền Giả Từ Bi',
    badge: '🏮',
    minPoints: 380,
    nextPoints: 560,
    color: '#ea580c',
    bgClass: 'bg-orange-50 text-orange-900 border-orange-300',
    meaning: 'Lòng từ bi rộng mở, thường xuyên thả hoa đăng, tắm Phật và hồi hướng cho muôn loài.',
  },
  {
    level: 6,
    title: 'Bồ Đề Đạo Hữu',
    badge: '☸️',
    minPoints: 560,
    nextPoints: 800,
    color: '#9333ea',
    bgClass: 'bg-purple-50 text-purple-900 border-purple-300',
    meaning: 'Tâm trí sáng suốt, tinh thông lễ nghi Phật giáo và hiếu học vượt sông sang Đảo HSK.',
  },
  {
    level: 7,
    title: 'Trưởng Lão Công Đức',
    badge: '🏯',
    minPoints: 800,
    nextPoints: 1200,
    color: '#b45309',
    bgClass: 'bg-amber-100 text-amber-950 border-amber-400',
    meaning: 'Bậc đại thí chủ công đức sâu dày, tấm gương tu học và hộ trì Tam Bảo nơi cửa thiền.',
  },
  {
    level: 8,
    title: 'Liên Hoa Đại Đức',
    badge: '🌟',
    minPoints: 1200,
    nextPoints: null,
    color: '#d97706',
    bgClass: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-950 border-amber-500',
    meaning: 'Phẩm vị cao quý nhất trong chùa — công đức viên mãn, từ bi và trí tuệ tỏa sáng như sen vàng.',
  },
];

export interface MeritHistoryItem {
  id: string;
  key: MeritActionKey;
  label: string;
  points: number;
  note?: string;
  date: string;
}

export interface MeritState {
  points: number;
  counts: Partial<Record<MeritActionKey, number>>;
  history: MeritHistoryItem[];
}

const MERIT_STORAGE_KEY = 'chua-hai-an-merit-v1';

export function getMeritRank(points: number): MeritRank {
  let current = MERIT_RANKS[0];
  for (const r of MERIT_RANKS) {
    if (points >= r.minPoints) current = r;
  }
  return current;
}

export function getNextMeritRank(points: number): MeritRank | null {
  for (const r of MERIT_RANKS) {
    if (points < r.minPoints) return r;
  }
  return null;
}

export function loadMeritState(existingPrayersCount = 0): MeritState {
  try {
    const raw = localStorage.getItem(MERIT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MeritState;
      if (typeof parsed.points === 'number' && parsed.points >= 0) {
        return {
          points: parsed.points,
          counts: parsed.counts || {},
          history: Array.isArray(parsed.history) ? parsed.history : [],
        };
      }
    }
  } catch {
    /* ignore */
  }
  // Seed initial points from existing prayer book entries if first time opening v2.4
  const seedPoints = Math.min(300, Math.max(20, existingPrayersCount * 15));
  const initial: MeritState = {
    points: seedPoints,
    counts: {},
    history: [
      {
        id: 'init-welcome',
        key: 'incense',
        label: 'Khởi tâm bước vào Cổng Tam Quan Chùa Hải An',
        points: seedPoints,
        date: new Date().toLocaleString('vi-VN'),
      },
    ],
  };
  try {
    localStorage.setItem(MERIT_STORAGE_KEY, JSON.stringify(initial));
  } catch {
    /* ignore */
  }
  return initial;
}

export function awardMerit(
  key: MeritActionKey,
  customPoints?: number,
  note?: string,
): { state: MeritState; added: number; rankUp: MeritRank | null } {
  const prev = loadMeritState();
  const prevRank = getMeritRank(prev.points);
  const info = MERIT_ACTIONS[key];
  const added = customPoints ?? info.points;
  const nextPoints = prev.points + added;
  const nextRank = getMeritRank(nextPoints);
  const item: MeritHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    key,
    label: note ? `${info.label} (${note})` : info.label,
    points: added,
    note,
    date: new Date().toLocaleString('vi-VN'),
  };
  const next: MeritState = {
    points: nextPoints,
    counts: {
      ...prev.counts,
      [key]: (prev.counts[key] || 0) + 1,
    },
    history: [item, ...prev.history].slice(0, 50),
  };
  try {
    localStorage.setItem(MERIT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return {
    state: next,
    added,
    rankUp: nextRank.level > prevRank.level ? nextRank : null,
  };
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  rank: MeritRank;
  deedsCount: number;
  specialty: string;
  isSelf?: boolean;
  isOnline?: boolean;
  /** True rank in the full sorted list (the board shows top 8 + your own row). */
  position?: number;
}

/** One row of the SHARED merit board, served by the Cloudflare Worker.
 *  `points` is the player's best reported total (no login: one display
 *  name = one slot, best score wins). */
export interface GlobalBoardEntry {
  name: string;
  points: number;
}

/** HTTP origin of the Worker, derived from the configured WebSocket URL
 *  (stored URL wins, else the build-time env var). Empty = no sync. */
export function getLeaderboardOrigin(): string {
  try {
    const raw =
      (typeof localStorage !== 'undefined' ? localStorage.getItem('thien-vien-ws-url') : '') ||
      process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL ||
      '';
    let u = raw.trim().replace(/\/+$/, '');
    if (u.endsWith('/ws')) u = u.slice(0, -3);
    if (u.startsWith('wss://')) u = 'https://' + u.slice(6);
    else if (u.startsWith('ws://')) u = 'http://' + u.slice(5);
    if (!/^https?:\/\//.test(u)) return '';
    return u;
  } catch {
    return '';
  }
}

export async function fetchGlobalBoard(origin: string): Promise<GlobalBoardEntry[] | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${origin}/leaderboard`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { entries?: unknown };
    if (!Array.isArray(data.entries)) return null;
    return data.entries
      .filter(
        (e): e is GlobalBoardEntry =>
          !!e &&
          typeof (e as GlobalBoardEntry).name === 'string' &&
          Number.isInteger((e as GlobalBoardEntry).points),
      )
      .slice(0, 50);
  } catch {
    return null;
  }
}

let lastReportMs = 0;

/** Report your current total to the shared board (throttled to 1/30s;
 *  a failed send does not consume the throttle, so the next change
 *  retries immediately). Fire-and-forget: the board stays local when
 *  offline. Solo mode never calls this. */
export function reportMeritPoints(origin: string, name: string, points: number): void {
  const clean = (name || '').trim();
  if (!origin || !clean || !Number.isInteger(points) || points < 0) return;
  const now = Date.now();
  if (now - lastReportMs < 30000) return;
  lastReportMs = now;
  fetch(`${origin}/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: clean.slice(0, 30), points }),
  })
    .then((res) => {
      if (!res.ok) lastReportMs = 0;
    })
    .catch(() => {
      lastReportMs = 0;
    });
}

/** Danh sách Phật tử tiêu biểu được ghi danh trên Bảng Vàng Công Đức Chùa Hải An */
const TEMPLE_DEVOTEES: Array<{
  id: string;
  name: string;
  points: number;
  deedsCount: number;
  specialty: string;
}> = [
  {
    id: 'dev-1',
    name: 'Nguyễn Hữu Hoàng Hải Anh',
    points: 920,
    deedsCount: 46,
    specialty: 'Tụng kinh Phổ Môn · Hộ trì Đại Hùng Bảo Điện',
  },
  {
    id: 'dev-2',
    name: 'Hoàng Bá Bảo',
    points: 680,
    deedsCount: 35,
    specialty: 'Thả hoa đăng · Tắm Phật & Phóng sinh Tâm Liên Hồ',
  },
  {
    id: 'dev-3',
    name: 'Hoàng Thanh Thảo',
    points: 585,
    deedsCount: 29,
    specialty: 'Vượt Sông Bát Nhã · Tinh tấn học Hán ngữ HSK',
  },
  {
    id: 'dev-4',
    name: 'Trần Tú Linh',
    points: 420,
    deedsCount: 22,
    specialty: 'Kinh hành Bảo Tháp 7 tầng · Chấp tác quét lá đa',
  },
  {
    id: 'dev-5',
    name: 'Đinh Ngọc Cầm',
    points: 295,
    deedsCount: 16,
    specialty: 'Chăm sóc Vườn Lộc Uyển · Treo thẻ ước nguyện Bồ Đề',
  },
  {
    id: 'dev-6',
    name: 'Nguyễn Đình An',
    points: 185,
    deedsCount: 11,
    specialty: 'Thỉnh Đại Hồng Chuông · Tọa thiền Niệm Phật Đường',
  },
  {
    id: 'dev-7',
    name: 'Trần Việt Anh',
    points: 110,
    deedsCount: 7,
    specialty: 'Dâng hương Đỉnh đồng · Xin xâm Từ Bi đầu năm',
  },
  {
    id: 'dev-8',
    name: 'Tín nữ An Nhiên',
    points: 65,
    deedsCount: 4,
    specialty: 'Lễ Phật Chính điện · Đàm đạo cùng Chú tiểu',
  },
];

export function buildMeritLeaderboard(
  selfName: string,
  selfState: MeritState,
  globalEntries: GlobalBoardEntry[] | null,
): LeaderboardEntry[] {
  const cleanSelf = (selfName || '').trim() || 'Khách';
  const totalSelfDeeds =
    Object.values(selfState.counts).reduce((acc, v) => acc + (v || 0), 0) || selfState.history.length;
  const globalByName = new Map<string, number>();
  if (globalEntries) {
    for (const g of globalEntries) {
      if (typeof g.name !== 'string' || !Number.isInteger(g.points)) continue;
      const prev = globalByName.get(g.name);
      if (prev === undefined || g.points > prev) globalByName.set(g.name, g.points);
    }
  }

  const entries: LeaderboardEntry[] = [];
  // Real players from the shared board. Your own row uses the best of
  // your local total and your synced total, so a rank you earned on
  // another device still shows when you open the board here.
  globalByName.forEach((gPoints, gName) => {
    const isSelf = gName === cleanSelf;
    const points = isSelf ? Math.max(gPoints, selfState.points) : gPoints;
    entries.push({
      id: `global-${gName}`,
      name: gName,
      points,
      rank: getMeritRank(points),
      deedsCount: isSelf ? totalSelfDeeds : 0,
      specialty: isSelf ? 'Đang tu tập trực tiếp tại Chùa Hải An' : 'Phật tử tu tập tại Chùa Hải An',
      ...(isSelf ? { isSelf: true, isOnline: true } : {}),
    });
  });
  if (!globalByName.has(cleanSelf)) {
    entries.push({
      id: 'self',
      name: cleanSelf,
      points: selfState.points,
      rank: getMeritRank(selfState.points),
      deedsCount: totalSelfDeeds,
      specialty: 'Đang tu tập trực tiếp tại Chùa Hải An',
      isSelf: true,
      isOnline: true,
    });
  }

  // Temple devotees are STARTING NUMBERS only: once a devotee's name
  // plays for real (synced, or yourself right now), the placeholder
  // steps aside for the real score — even if the real score is lower.
  for (const d of TEMPLE_DEVOTEES) {
    if (globalByName.has(d.name) || d.name === cleanSelf) continue;
    entries.push({
      id: d.id,
      name: d.name,
      points: d.points,
      rank: getMeritRank(d.points),
      deedsCount: d.deedsCount,
      specialty: d.specialty,
    });
  }

  // Ties: yourself first, then real players before placeholders (insertion order).
  entries.sort((a, b) => b.points - a.points || (a.isSelf ? -1 : b.isSelf ? 1 : 0));
  const positioned = entries.map((e, i) => ({ ...e, position: i + 1 }));
  const top = positioned.slice(0, 8);
  const self = positioned.find((e) => e.isSelf);
  if (self && !top.includes(self)) return [...top, self];
  return top;
}
