/**
 * 中文语言包
 */
export default {
  // 通用
  common: {
    confirm: '确认',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    back: '返回',
    next: '下一步',
    done: '完成',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    retry: '重试',
    close: '关闭',
  },

  // 首页
  home: {
    title: 'SuperTennis',
    subtitle: 'AI 智能网球记分',
    startMatch: '开始比赛',
    matchHistory: '比赛记录',
    settings: '设置',
    noMatches: '暂无比赛记录',
  },

  // 比赛设置
  matchSetup: {
    title: '比赛设置',
    player1: '玩家 1',
    player2: '玩家 2',
    playerName: '输入姓名',
    matchType: '比赛类型',
    singles: '单打',
    doubles: '双打',
    sets: '盘数',
    oneSet: '一盘',
    threeSets: '三盘两胜',
    fiveSets: '五盘三胜',
    tiebreak: '抢七',
    startMatch: '开始比赛',
  },

  // 场地校准
  calibration: {
    title: '场地校准',
    instruction: '请依次点击球场的四个角点',
    topLeft: '左上角',
    topRight: '右上角',
    bottomRight: '右下角',
    bottomLeft: '左下角',
    reset: '重置',
    startMatch: '开始比赛',
    tip: '提示：将手机固定在场边，确保能拍到整个球场',
    point: '点',
    pointsRemaining: '还需标记 {{count}} 个点',
    complete: '校准完成',
  },

  // 比赛进行中
  match: {
    title: '比赛',
    set: '盘',
    game: '局',
    point: '分',
    serve: '发球',
    score: '比分',
    advantage: '占先',
    deuce: '平分',
    gamePoint: '局点',
    setPoint: '盘点',
    matchPoint: '赛点',
    breakPoint: '破发点',
    tiebreak: '抢七',
    player1Scores: '{{name}} 得分',
    player2Scores: '{{name}} 得分',
    endMatch: '结束比赛',
    pauseMatch: '暂停',
    resumeMatch: '继续',
  },

  // AI 功能
  ai: {
    status: 'AI 状态',
    idle: 'AI 待机',
    tracking: 'AI 追踪中',
    bounceDetected: '检测到落点',
    autoScore: '自动记分',
    autoScoreEnabled: '自动记分已开启',
    autoScoreDisabled: '自动记分已关闭',
    inBounds: '界内',
    outOfBounds: '出界',
    confidence: '置信度',
    fps: 'FPS',
    hawkEye: '鹰眼',
    analyzing: '分析中...',
    noData: '无数据',
  },

  // 鹰眼判定
  hawkEye: {
    title: '鹰眼判定',
    in: '界内',
    out: '出界',
    distance: '距离边线',
    mm: '毫米',
    reviewing: '回放分析中...',
    noCallAvailable: '暂无判定数据',
  },

  // 比赛回放
  replay: {
    title: '比赛回放',
    events: '事件列表',
    noEvents: '暂无事件记录',
    bounce: '落点',
    shot: '击球',
    out: '出界',
    statistics: '统计',
    timeline: '时间线',
  },

  // 比赛结果
  result: {
    title: '比赛结束',
    winner: '获胜者',
    finalScore: '最终比分',
    duration: '比赛时长',
    totalPoints: '总分数',
    aces: 'Aces',
    doubleFaults: '双误',
    winners: '制胜分',
    errors: '失误',
    saveMatch: '保存比赛',
    newMatch: '新比赛',
    share: '分享',
  },

  // 设置
  settings: {
    title: '设置',
    language: '语言',
    chinese: '中文',
    english: 'English',
    camera: '摄像头',
    cameraPermission: '摄像头权限',
    aiSettings: 'AI 设置',
    sensitivity: '检测灵敏度',
    low: '低',
    medium: '中',
    high: '高',
    about: '关于',
    version: '版本',
    feedback: '反馈',
    privacyPolicy: '隐私政策',
  },

  // 权限
  permissions: {
    cameraTitle: '需要摄像头权限',
    cameraMessage: '请允许访问摄像头以使用 AI 鹰眼功能',
    goToSettings: '前往设置',
    denied: '权限被拒绝',
  },

  // 错误消息
  errors: {
    networkError: '网络错误，请检查连接',
    serverError: '服务器错误，请稍后重试',
    saveError: '保存失败',
    loadError: '加载失败',
    cameraError: '摄像头启动失败',
    calibrationError: '校准失败，请重试',
  },

  // 网球术语
  tennis: {
    serve: '发球',
    return: '接发',
    forehand: '正手',
    backhand: '反手',
    volley: '截击',
    smash: '扣杀',
    lob: '挑高球',
    dropShot: '放小球',
    ace: 'Ace',
    doubleFault: '双误',
    let: 'Let',
    fault: '失误',
    net: '触网',
    baseline: '底线',
    sideline: '边线',
    serviceLine: '发球线',
    centerLine: '中线',
    deuceCourt: 'Deuce 区',
    adCourt: 'Ad 区',
  },
};
