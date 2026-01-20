import { create } from 'zustand';
import { matchApi } from '../services/api';

// 比赛设置
export interface MatchSettings {
  matchType: 'singles' | 'doubles';
  setFormat: 'one' | 'three' | 'tiebreak10';
  useTiebreak: boolean;
  useAdvantage: boolean;
  player1Name: string;
  player2Name: string;
  firstServer: 1 | 2;
}

// 比赛比分状态
export interface MatchScore {
  player1Points: number;
  player2Points: number;
  player1Games: number[];
  player2Games: number[];
  currentSet: number;
  isDeuce: boolean;
  isTiebreak: boolean;
  tiebreakPoints: [number, number];
  isFinished: boolean;
  winner: 1 | 2 | null;
}

// 校准点
export interface CalibrationPoint {
  id?: string;
  x: number;
  y: number;
  label?: string;
}

// 完整比赛状态
interface MatchState {
  // 比赛 ID (保存后返回)
  matchId: string | null;

  // 比赛设置
  settings: MatchSettings;

  // 比赛比分
  score: MatchScore;

  // 录制时长 (秒)
  duration: number;

  // 比赛开始时间
  startTime: number | null;

  // 校准数据
  calibration: CalibrationPoint[] | null;

  // 视频路径
  videoPath: string | null;

  // Actions
  setSettings: (settings: Partial<MatchSettings>) => void;
  resetSettings: () => void;
  startMatch: () => Promise<void>;
  updateScore: (player: 1 | 2) => void;
  undoScore: () => void;
  finishMatch: () => Promise<void>;
  setDuration: (duration: number) => void;
  setCalibration: (points: CalibrationPoint[]) => void;
  setVideoPath: (path: string) => void;
  resetMatch: () => void;
}

const defaultSettings: MatchSettings = {
  matchType: 'singles',
  setFormat: 'three',
  useTiebreak: true,
  useAdvantage: true,
  player1Name: '',
  player2Name: '',
  firstServer: 1,
};

const defaultScore: MatchScore = {
  player1Points: 0,
  player2Points: 0,
  player1Games: [0],
  player2Games: [0],
  currentSet: 0,
  isDeuce: false,
  isTiebreak: false,
  tiebreakPoints: [0, 0],
  isFinished: false,
  winner: null,
};

// 计分逻辑
function calculateNewScore(
  prevScore: MatchScore,
  player: 1 | 2,
  settings: MatchSettings
): MatchScore {
  const newScore = { ...prevScore };

  // 抢十赛制
  if (settings.setFormat === 'tiebreak10') {
    if (player === 1) {
      newScore.player1Points++;
    } else {
      newScore.player2Points++;
    }

    const p1 = newScore.player1Points;
    const p2 = newScore.player2Points;

    if ((p1 >= 10 || p2 >= 10) && Math.abs(p1 - p2) >= 2) {
      newScore.isFinished = true;
      newScore.winner = p1 > p2 ? 1 : 2;
      newScore.player1Games[0] = p1;
      newScore.player2Games[0] = p2;
    }
    return newScore;
  }

  // 抢七局
  if (prevScore.isTiebreak) {
    newScore.tiebreakPoints = [...prevScore.tiebreakPoints] as [number, number];
    newScore.tiebreakPoints[player - 1]++;

    const [p1, p2] = newScore.tiebreakPoints;
    if ((p1 >= 7 || p2 >= 7) && Math.abs(p1 - p2) >= 2) {
      const setWinner = p1 > p2 ? 1 : 2;
      if (setWinner === 1) {
        newScore.player1Games[prevScore.currentSet]++;
      } else {
        newScore.player2Games[prevScore.currentSet]++;
      }
      newScore.isTiebreak = false;
      newScore.tiebreakPoints = [0, 0];
      newScore.player1Points = 0;
      newScore.player2Points = 0;

      // 检查比赛是否结束
      const setsToWin = settings.setFormat === 'one' ? 1 : 2;
      let p1Sets = 0;
      let p2Sets = 0;
      for (let i = 0; i < newScore.player1Games.length; i++) {
        const sg1 = newScore.player1Games[i];
        const sg2 = newScore.player2Games[i];
        // 赢盘条件：局数领先且至少6局，且领先2局以上（或7-6抢七胜）
        if (sg1 > sg2 && sg1 >= 6 && (sg1 - sg2 >= 2 || sg1 === 7)) p1Sets++;
        if (sg2 > sg1 && sg2 >= 6 && (sg2 - sg1 >= 2 || sg2 === 7)) p2Sets++;
      }

      if (p1Sets >= setsToWin) {
        newScore.isFinished = true;
        newScore.winner = 1;
      } else if (p2Sets >= setsToWin) {
        newScore.isFinished = true;
        newScore.winner = 2;
      } else {
        // 下一盘
        newScore.currentSet++;
        newScore.player1Games.push(0);
        newScore.player2Games.push(0);
      }
    }
    return newScore;
  }

  // 常规计分
  if (player === 1) {
    newScore.player1Points++;
  } else {
    newScore.player2Points++;
  }

  const p1 = newScore.player1Points;
  const p2 = newScore.player2Points;

  // Deuce 逻辑
  if (p1 >= 3 && p2 >= 3) {
    newScore.isDeuce = true;

    // 占先制检查
    if (settings.useAdvantage) {
      if (Math.abs(p1 - p2) >= 2) {
        winGame(newScore, p1 > p2 ? 1 : 2, settings);
      }
    } else {
      // 无占先制：Deuce 后直接得分胜局
      if (p1 !== p2) {
        winGame(newScore, p1 > p2 ? 1 : 2, settings);
      }
    }
  } else if (p1 >= 4 || p2 >= 4) {
    winGame(newScore, p1 >= 4 ? 1 : 2, settings);
  }

  return newScore;
}

function winGame(score: MatchScore, gameWinner: 1 | 2, settings: MatchSettings) {
  if (gameWinner === 1) {
    score.player1Games[score.currentSet]++;
  } else {
    score.player2Games[score.currentSet]++;
  }
  score.player1Points = 0;
  score.player2Points = 0;
  score.isDeuce = false;

  const g1 = score.player1Games[score.currentSet];
  const g2 = score.player2Games[score.currentSet];

  // 检查是否进入抢七
  if (g1 === 6 && g2 === 6 && settings.useTiebreak) {
    score.isTiebreak = true;
    return;
  }

  // 检查盘是否结束
  if ((g1 >= 6 || g2 >= 6) && Math.abs(g1 - g2) >= 2) {
    const setsToWin = settings.setFormat === 'one' ? 1 : 2;

    // 计算赢的盘数
    let p1Sets = 0;
    let p2Sets = 0;
    for (let i = 0; i <= score.currentSet; i++) {
      const sg1 = score.player1Games[i];
      const sg2 = score.player2Games[i];
      // 赢盘条件：局数领先且至少6局，且领先2局以上（或7-6抢七胜）
      if (sg1 > sg2 && sg1 >= 6 && (sg1 - sg2 >= 2 || sg1 === 7)) p1Sets++;
      if (sg2 > sg1 && sg2 >= 6 && (sg2 - sg1 >= 2 || sg2 === 7)) p2Sets++;
    }

    if (p1Sets >= setsToWin) {
      score.isFinished = true;
      score.winner = 1;
    } else if (p2Sets >= setsToWin) {
      score.isFinished = true;
      score.winner = 2;
    } else {
      // 下一盘
      score.currentSet++;
      score.player1Games.push(0);
      score.player2Games.push(0);
    }
  }
}

// 历史记录用于撤销
let scoreHistory: MatchScore[] = [];

export const useMatchStore = create<MatchState>((set, get) => ({
  matchId: null,
  settings: { ...defaultSettings },
  score: { ...defaultScore },
  duration: 0,
  startTime: null,
  calibration: null,
  videoPath: null,

  setSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
  },

  resetSettings: () => {
    set({ settings: { ...defaultSettings } });
  },

  startMatch: async () => {
    const { settings } = get();

    try {
      const match = await matchApi.create({
        player1Name: settings.player1Name || '我',
        player2Name: settings.player2Name || '对手',
        matchType: settings.matchType,
        setFormat: settings.setFormat,
        useTiebreak: settings.useTiebreak,
        useAdvantage: settings.useAdvantage,
      });

      scoreHistory = [];
      set({
        matchId: match.id,
        score: { ...defaultScore },
        duration: 0,
        startTime: Date.now(),
      });
    } catch (error) {
      console.error('Failed to create match:', error);
      // 即使 API 失败也允许开始比赛 (离线模式)
      scoreHistory = [];
      set({
        matchId: null,
        score: { ...defaultScore },
        duration: 0,
        startTime: Date.now(),
      });
    }
  },

  updateScore: (player) => {
    const { score, settings } = get();
    if (score.isFinished) return;

    // 保存历史用于撤销
    scoreHistory.push({
      ...score,
      player1Games: [...score.player1Games],
      player2Games: [...score.player2Games],
      tiebreakPoints: [...score.tiebreakPoints] as [number, number],
    });

    const newScore = calculateNewScore(score, player, settings);
    set({ score: newScore });
  },

  undoScore: () => {
    if (scoreHistory.length > 0) {
      const prevScore = scoreHistory.pop()!;
      set({ score: prevScore });
    }
  },

  finishMatch: async () => {
    const { matchId, score, duration } = get();

    if (!matchId || !score.winner) return;

    try {
      await matchApi.updateScore(matchId, {
        player1Sets: score.player1Games,
        player2Sets: score.player2Games,
        player1Points: score.player1Points,
        player2Points: score.player2Points,
        currentSet: score.currentSet,
        isFinished: true,
        winner: score.winner,
      });

      await matchApi.finish(matchId, score.winner, duration);
    } catch (error) {
      console.error('Failed to save match result:', error);
    }
  },

  setDuration: (duration) => {
    set({ duration });
  },

  setCalibration: (points) => {
    set({ calibration: points });
  },

  setVideoPath: (path) => {
    set({ videoPath: path });
  },

  resetMatch: () => {
    scoreHistory = [];
    set({
      matchId: null,
      settings: { ...defaultSettings },
      score: { ...defaultScore },
      duration: 0,
      startTime: null,
      calibration: null,
      videoPath: null,
    });
  },
}));
