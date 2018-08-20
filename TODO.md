## Server
- Flask Http server
- Websocket server

## Data transfer
- json

### method (User send)
- Login
- Ready
- Unready
- Spectate
- UnSpectate

- Chose team
- Comfire team
- Approve
- Reject
- Succes
- Fail
- Lake
- Assasin

### method (Server send)
- Varify fail
- Become Spectate
- Waiting
- Need Ready
- Too many

- Story start
- Ask team
- Ask Approval
- Team Assemble fail
- Ask success
- Mission Fail
- Mission Success

## Websocket Flow
### 連到網站
玩家連到網站, 要輸入名字和密語

### 密語失敗
告訴玩家密語失敗, 結束連結

### 密語成功
把玩家夾到連結中 <br>
如果遊戲開始, 把它夾到觀察者 <br>
如果還沒, 但超過限制也加入觀察者 <br>
如果都不是, 加入等待 <br>

檢查人數是否可以開始遊戲, 5 人以上 (包含) <br>
如果是告訴所有等待等待的玩家可以按準備完成 <br>

### 準備完成
#### 伺服器
檢查是不是所有人都點準備完成 <br>
如果是隨機指派玩家角色, 並分別告訴他們, 如果玩家有特殊角色, 告訴他額外的資訊 <br>
指定隊長並告訴所有人

#### 玩家
開始講故事, 顯示特殊角色的技能

## 遊戲開始
### 選擇隊伍
#### 伺服器
告訴隊長有多少人可以選

把即時收到的人丟給其他人

#### 玩家
把票給額定的人, 即時把選到的人丟會給伺服器

### 投票出任務
#### 伺服器
告訴所有人開始投票

所有人都投完後, 成功繼續, 失敗重新指派隊長, 重新選擇隊伍

#### 玩家
顯示投票的畫面

### 出任務
#### 伺服器
告訴出任務的人要決定成功失敗 <br>

#### 玩家
出任務的人顯示決定畫面, 決定後告訴伺服器

### 任務結果
#### 伺服器
告訴所有人結果 <br>
選下一個隊長, 並重新選擇隊伍

### 遊戲結尾
### 伺服器

