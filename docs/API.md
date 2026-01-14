# SuperTennis API 接口文档

## 概述

SuperTennis 服务端提供 RESTful API 用于比赛数据的持久化存储和查询。

- **基础 URL**: `http://localhost:3001/api`
- **数据格式**: JSON
- **字符编码**: UTF-8

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

### HTTP 状态码

| 状态码 | 说明 |
|-------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 比赛 API

### 获取比赛列表

获取所有比赛记录，按创建时间倒序排列。

```
GET /matches
```

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| status | string | 否 | 筛选状态: `in_progress` / `completed` |
| limit | number | 否 | 返回数量限制，默认 20 |
| offset | number | 否 | 分页偏移量，默认 0 |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "id": "uuid-1234",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T11:45:00Z",
        "status": "completed",
        "player1Name": "Player 1",
        "player2Name": "Player 2",
        "score": {
          "sets": [
            { "player1": 6, "player2": 4 },
            { "player1": 3, "player2": 6 },
            { "player1": 6, "player2": 2 }
          ],
          "currentSet": 2,
          "currentGame": { "player1": 0, "player2": 0 }
        }
      }
    ],
    "total": 15,
    "limit": 20,
    "offset": 0
  }
}
```

---

### 创建比赛

创建新的比赛记录。

```
POST /matches
```

#### 请求体

```json
{
  "player1Name": "Alice",
  "player2Name": "Bob",
  "calibration": [
    { "x": 100, "y": 200 },
    { "x": 500, "y": 200 },
    { "x": 500, "y": 600 },
    { "x": 100, "y": 600 }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| player1Name | string | 否 | 玩家1名称，默认 "Player 1" |
| player2Name | string | 否 | 玩家2名称，默认 "Player 2" |
| calibration | array | 否 | 校准点数组 (4个点) |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid-5678",
    "createdAt": "2024-01-15T14:00:00Z",
    "updatedAt": "2024-01-15T14:00:00Z",
    "status": "in_progress",
    "player1Name": "Alice",
    "player2Name": "Bob",
    "score": {
      "sets": [],
      "currentSet": 0,
      "currentGame": { "player1": 0, "player2": 0 }
    },
    "calibration": [
      { "x": 100, "y": 200 },
      { "x": 500, "y": 200 },
      { "x": 500, "y": 600 },
      { "x": 100, "y": 600 }
    ]
  }
}
```

---

### 获取比赛详情

获取指定比赛的详细信息。

```
GET /matches/:id
```

#### 路径参数

| 参数 | 类型 | 说明 |
|-----|------|------|
| id | string | 比赛 ID |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid-5678",
    "createdAt": "2024-01-15T14:00:00Z",
    "updatedAt": "2024-01-15T15:30:00Z",
    "status": "in_progress",
    "player1Name": "Alice",
    "player2Name": "Bob",
    "score": {
      "sets": [
        { "player1": 6, "player2": 4 }
      ],
      "currentSet": 1,
      "currentGame": { "player1": 30, "player2": 15 }
    },
    "calibration": [...],
    "aiEvents": [
      {
        "id": "event-1",
        "createdAt": "2024-01-15T14:05:00Z",
        "type": "bounce",
        "positionX": 12.5,
        "positionY": 5.2,
        "isInBounds": true,
        "confidence": 95.5
      }
    ]
  }
}
```

---

### 更新比赛

更新比赛信息（比分、状态等）。

```
PUT /matches/:id
```

#### 路径参数

| 参数 | 类型 | 说明 |
|-----|------|------|
| id | string | 比赛 ID |

#### 请求体

```json
{
  "status": "completed",
  "score": {
    "sets": [
      { "player1": 6, "player2": 4 },
      { "player1": 6, "player2": 3 }
    ],
    "currentSet": 1,
    "currentGame": { "player1": 0, "player2": 0 }
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| status | string | 否 | 比赛状态 |
| score | object | 否 | 比分信息 |
| player1Name | string | 否 | 玩家1名称 |
| player2Name | string | 否 | 玩家2名称 |
| calibration | array | 否 | 校准点 |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid-5678",
    "updatedAt": "2024-01-15T16:00:00Z",
    "status": "completed",
    ...
  }
}
```

---

### 删除比赛

删除指定比赛及其关联的 AI 事件。

```
DELETE /matches/:id
```

#### 路径参数

| 参数 | 类型 | 说明 |
|-----|------|------|
| id | string | 比赛 ID |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "id": "uuid-5678"
  }
}
```

---

## AI 事件 API

### 获取比赛的 AI 事件

获取指定比赛的所有 AI 检测事件。

```
GET /ai-events/:matchId
```

#### 路径参数

| 参数 | 类型 | 说明 |
|-----|------|------|
| matchId | string | 比赛 ID |

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| type | string | 否 | 事件类型筛选 |
| limit | number | 否 | 返回数量限制 |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event-1",
        "createdAt": "2024-01-15T14:05:00Z",
        "matchId": "uuid-5678",
        "type": "bounce",
        "positionX": 12.5,
        "positionY": 5.2,
        "isInBounds": true,
        "confidence": 95.5,
        "metadata": {
          "velocity": { "vx": 15.2, "vy": -8.3 },
          "frameNumber": 1234
        }
      },
      {
        "id": "event-2",
        "createdAt": "2024-01-15T14:05:01Z",
        "matchId": "uuid-5678",
        "type": "trajectory",
        "positionX": 10.2,
        "positionY": 6.8,
        "isInBounds": null,
        "confidence": 88.0,
        "metadata": {
          "trackingId": "ball-1"
        }
      }
    ],
    "total": 156
  }
}
```

---

### 记录 AI 事件

记录新的 AI 检测事件。

```
POST /ai-events
```

#### 请求体

```json
{
  "matchId": "uuid-5678",
  "type": "bounce",
  "positionX": 15.3,
  "positionY": 4.8,
  "isInBounds": false,
  "confidence": 92.0,
  "metadata": {
    "velocity": { "vx": 12.0, "vy": -5.5 },
    "distanceToLine": 0.15,
    "closestLine": "rightLine"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| matchId | string | 是 | 比赛 ID |
| type | string | 是 | 事件类型 |
| positionX | number | 是 | X 坐标 (球场坐标系，米) |
| positionY | number | 是 | Y 坐标 (球场坐标系，米) |
| isInBounds | boolean | 否 | 是否界内 |
| confidence | number | 否 | 置信度 (0-100) |
| metadata | object | 否 | 额外元数据 |

#### 事件类型

| 类型 | 说明 |
|-----|------|
| bounce | 落点事件 |
| trajectory | 轨迹点 |
| out_of_bounds | 出界事件 |
| detection_start | 开始检测 |
| detection_end | 结束检测 |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "event-3",
    "createdAt": "2024-01-15T14:10:00Z",
    "matchId": "uuid-5678",
    "type": "bounce",
    "positionX": 15.3,
    "positionY": 4.8,
    "isInBounds": false,
    "confidence": 92.0
  }
}
```

---

## 数据模型

### Match (比赛)

```typescript
interface Match {
  id: string;              // UUID
  createdAt: string;       // ISO 8601 时间戳
  updatedAt: string;       // ISO 8601 时间戳
  status: 'in_progress' | 'completed';
  player1Name: string;
  player2Name: string;
  score: Score;
  calibration?: CalibrationPoint[];
  aiEvents?: AIEvent[];
}
```

### Score (比分)

```typescript
interface Score {
  sets: SetScore[];        // 盘分
  currentSet: number;      // 当前盘索引
  currentGame: GameScore;  // 当前局分
  tiebreak?: TiebreakScore;// 抢七分数
}

interface SetScore {
  player1: number;         // 玩家1局数
  player2: number;         // 玩家2局数
}

interface GameScore {
  player1: number;         // 0, 15, 30, 40, AD
  player2: number;
}

interface TiebreakScore {
  player1: number;         // 抢七得分
  player2: number;
}
```

### CalibrationPoint (校准点)

```typescript
interface CalibrationPoint {
  x: number;  // 像素 X 坐标
  y: number;  // 像素 Y 坐标
}
```

### AIEvent (AI 事件)

```typescript
interface AIEvent {
  id: string;
  createdAt: string;
  matchId: string;
  type: 'bounce' | 'trajectory' | 'out_of_bounds' | 'detection_start' | 'detection_end';
  positionX: number;       // 球场 X 坐标 (米)
  positionY: number;       // 球场 Y 坐标 (米)
  isInBounds?: boolean;    // 是否界内
  confidence?: number;     // 置信度 (0-100)
  metadata?: Record<string, any>;
}
```

---

## 错误码

| 错误码 | HTTP 状态码 | 说明 |
|-------|------------|------|
| MATCH_NOT_FOUND | 404 | 比赛不存在 |
| INVALID_MATCH_ID | 400 | 无效的比赛 ID |
| INVALID_SCORE | 400 | 无效的比分格式 |
| INVALID_CALIBRATION | 400 | 无效的校准数据 |
| INVALID_EVENT_TYPE | 400 | 无效的事件类型 |
| MISSING_REQUIRED_FIELD | 400 | 缺少必填字段 |
| DATABASE_ERROR | 500 | 数据库错误 |

---

## 使用示例

### 完整比赛流程

```javascript
// 1. 创建比赛
const createRes = await fetch('/api/matches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    player1Name: 'Alice',
    player2Name: 'Bob',
    calibration: [
      { x: 100, y: 200 },
      { x: 500, y: 200 },
      { x: 500, y: 600 },
      { x: 100, y: 600 }
    ]
  })
});
const { data: match } = await createRes.json();
const matchId = match.id;

// 2. 记录 AI 事件
await fetch('/api/ai-events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    matchId,
    type: 'bounce',
    positionX: 12.5,
    positionY: 5.2,
    isInBounds: true,
    confidence: 95.5
  })
});

// 3. 更新比分
await fetch(`/api/matches/${matchId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    score: {
      sets: [{ player1: 1, player2: 0 }],
      currentSet: 0,
      currentGame: { player1: 15, player2: 0 }
    }
  })
});

// 4. 结束比赛
await fetch(`/api/matches/${matchId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'completed'
  })
});

// 5. 获取比赛回放数据
const replayRes = await fetch(`/api/matches/${matchId}`);
const { data: replayData } = await replayRes.json();
console.log(replayData.aiEvents);
```

---

## 开发调试

### 启动服务

```bash
cd apps/server
npm run dev
```

服务启动后监听 `http://localhost:3001`

### 测试 API

```bash
# 获取比赛列表
curl http://localhost:3001/api/matches

# 创建比赛
curl -X POST http://localhost:3001/api/matches \
  -H "Content-Type: application/json" \
  -d '{"player1Name": "Test Player 1"}'

# 获取比赛详情
curl http://localhost:3001/api/matches/{id}
```
