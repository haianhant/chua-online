/**
 * Niệm Phật catalogue — only short danh hiệu (name chanting).
 *
 * The former groups B (tụng kinh, trì chú) and C (theo tâm nguyện) were
 * REMOVED at the user's request (2026-11-03): long sutra/mantra texts
 * and their recordings raise copyright questions, and synthetic
 * readings of sacred texts risked misleading practitioners, so they
 * do not belong in this temple app. Do not re-add them without a
 * verified, licensed source and the user's explicit approval.
 *
 * What remains are short traditional name chants. Their audio is
 * synthetic voice, labelled as reference listening only — never a
 * standard chant recording, never the voice of a real monk or nun.
 */

export type ChantItem = {
  id: string;
  name: string;
  meaning: string;
  sourceNote: string;
  audio: string;
  text: string[];
  syntheticVoice: true;
};

export const CHANT_ITEMS: ChantItem[] = [
  {
    id: 'a-di-da',
    name: 'Nam mô A Di Đà Phật',
    meaning: 'Niệm danh hiệu Đức Phật A Di Đà, thực tập hướng tâm về an lạc và tỉnh thức.',
    sourceNote: 'Danh hiệu truyền thống. Bản nghe là giọng đọc tổng hợp, chỉ để nghe tham khảo.',
    audio: '/audio/zen.mp3',
    text: ['Nam mô A Di Đà Phật'],
    syntheticVoice: true,
  },
  {
    id: 'quan-am',
    name: 'Nam mô Đại Bi Quán Thế Âm Bồ Tát',
    meaning: 'Niệm danh hiệu Bồ Tát Quán Thế Âm, thực tập lắng nghe và lòng từ bi.',
    sourceNote: 'Danh hiệu truyền thống. Bản nghe là giọng đọc tổng hợp, chỉ để nghe tham khảo.',
    audio: '/audio/chanting/quan-am.mp3',
    text: ['Nam mô Đại Bi Quán Thế Âm Bồ Tát'],
    syntheticVoice: true,
  },
  {
    id: 'dia-tang-danh-hieu',
    name: 'Nam mô Địa Tạng Vương Bồ Tát',
    meaning: 'Niệm danh hiệu Bồ Tát Địa Tạng, thực tập hiếu kính và nguyện lực bền bỉ cứu độ.',
    sourceNote: 'Danh hiệu truyền thống. Bản nghe là giọng đọc tổng hợp, chỉ để nghe tham khảo.',
    audio: '/audio/chanting/dia-tang.mp3',
    text: ['Nam mô Địa Tạng Vương Bồ Tát'],
    syntheticVoice: true,
  },
  {
    id: 'thich-ca',
    name: 'Nam mô Bổn Sư Thích Ca Mâu Ni Phật',
    meaning: 'Niệm danh hiệu Đức Phật Thích Ca, bậc thầy gốc của đạo Phật.',
    sourceNote: 'Danh hiệu truyền thống. Bản nghe là giọng đọc tổng hợp, chỉ để nghe tham khảo.',
    audio: '/audio/chanting/thich-ca.mp3',
    text: ['Nam mô Bổn Sư Thích Ca Mâu Ni Phật'],
    syntheticVoice: true,
  },
];

export function getChant(id: string): ChantItem | undefined {
  return CHANT_ITEMS.find((c) => c.id === id);
}
