/** 打分权重集中在这里，方便调参 */
export const W = {
  // 亮主
  declareMinTrumps: 8,
  declareOverrideMinTrumps: 10,
  // 扣底
  buryPoint: 40,
  buryTen: 20,
  buryPair: 18,
  buryTrump: 100,
  buryShortSuitBonus: 6,
  // 领出
  leadSureWin: 60,
  leadTractor: 12,
  leadPair: 6,
  leadPointsLoss: 4,
  leadTrumpWhenUnsafe: 15,
  // 跟牌
  followPointsWon: 1.0,
  followPointsGiven: 1.6,
  followUnsafeWinDiscount: 0.6,
  followTrumpCost: 0.3,
  followStrengthCost: 0.15,
  /** 赢下这一墩（拿到领出权）的基础价值 */
  followWinBonus: 3,
};
