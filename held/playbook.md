# held / 斜率门 实盘执行纪律（1 万本金 HITL）

> **用途**：小资金（默认展示本金 **10000**）人工跟 **held + 宽度 5 日斜率门** 时，收盘复盘与次日开盘按本文执行。  
> **看板**：box `http://127.0.0.1:8787/` · Pages 快照 https://raincoolguy.github.io/zhenyan-strategy-catalog/held/  
> **信号**：与 HANDOFF held+斜率门一致；**本纪律不改信号数学**，只规定人怎么读票、怎么下单。  
> **不是** trading_cn Lorentzian Classification；LC 另见 `trading_cn` 的 `docs/a-stock-execution-playbook.md`。  
> **免责**：纪律降低误操作，**不保证盈利**；研究账本按 2 万起算，1 万实盘会有跟踪误差。

---

## 一、信号怎么读（三栏）

| 显示 | 字段 | 含义 | 默认动作 |
|------|------|------|----------|
| **持仓** | `keep` | 当日收盘**目标持仓**，只数 = `n` | 实盘对齐到这里 |
| **卖出** | `sell` | 计划清掉 | **次日开盘卖**（见开盘规则） |
| **买入** | `buy` | 排名**候选池**（可到约 20 只） | **不是全买**；只买「在 `keep` 里你还没有的」 |
| 环境条 | `mode` / `hard_off` / 斜率门 | `quality` / `guard`；急跌砍仓；斜率门可把 quality 打回 guard | 只解释环境，不单独当买卖理由 |
| 一手告警 | `lot_cost` / `over_capital` | 一手金额 vs `capital_display`（默认 10000） | `over_capital=true` → **跳过不买** |

真目标永远是：**持仓列表 = `keep`，长度 = `n`**。  
不要把「买入」栏 20 只当成今日篮子——那是 LC 多票并行买不完的同一类坑。

```text
目标持仓 := keep（长度 n）
应卖 := sell ∩ 你实盘持有
应买 := keep − 你实盘持有，且一手买得起
不动 := 已在 keep 且不在 sell
忽略 := buy 里不在 keep 的票
```

---

## 二、本金与仓位（1 万）

| 项 | 口径 |
|----|------|
| 展示本金 | `HELD_CAPITAL_DISPLAY=10000`，**仅告警**，不改引擎 |
| 研究账本 | 仍 **2 万**起复利（路径与 HANDOFF 一致） |
| 只数 | 正常 **n=2**；`hard_off` → **n=1**（`HARD_KEEP=1`） |
| 手数 | 优先 **每票 1 手**；买不起第二只 → 只做买得起的、`keep` 靠前的，**宁缺毋滥** |
| 超本金 | `lot_cost > 可用现金` 或 `over_capital` → 跳过；**不借钱、不拆信号去换池外票** |
| 加仓 | **不加仓摊平** |
| 止损 | 引擎 `TRAIL=0` / `STOP_COST=0`（全关）→ **只跟 sell / 移出 keep 出场** |

1 万相对研究权益偏小：引擎按大权益筛可买池，实盘常会因买不起产生**跟踪误差**，不能承诺复现研究表年化/胜率。小单还容易碰到 **5 元最低佣金**，摩擦更重。

---

## 三、每日流程

### 收盘后（信号日 T）

1. 确认 `a_data` 有当日增量：`kline_daily_incr_YYYYMMDD`（没有新日线 → **不要当今天信号**）。
2. 刷新面板与票：

```bash
cd /workspace/held_dashboard
export A_DATA_ROOT=/workspace/a_data
export HELD_PANEL=/workspace/held_dashboard/cache/panel.parquet
export HELD_CAPITAL_DISPLAY=10000
.venv/bin/python scripts/prepare_panel_from_a_data.py
.venv/bin/python ticket_runner.py
# 需要手机看时再 export + push Pages
# .venv/bin/python scripts/export_static_pages.py --out /tmp/zhenyan-strategy-catalog
```

或看板点「刷新信号」；看 `GET /api/ticket`。

3. 记下：`asof` / `mode` / `n` / `fresh` / `keep` / `sell` / `hard_off` / 各票 `lot_cost`·`over_capital`。  
4. 写出**明日动作清单**（对齐到 `keep`）：
   - **卖**：`sell` 里你有的 → 次日开盘卖  
   - **买**：`keep` 缺口且买得起 → 次日开盘买  
   - **持有**：已在 `keep` 且不在 `sell` → 不动  
5. `fresh=false` 且无 `sell`、已对齐 `keep` → 通常无调仓。

### 次日开盘（T+1）

1. **先卖后买**（对齐引擎顺序）。  
2. **涨停开盘不买**；**跌停开盘不卖**；停牌不做。  
3. 按清单下单；第二只买不起就停，不要用「买入」栏替补。  
4. 成交后核对：实盘持仓应尽量等于「买得起的 `keep` 子集」。

---

## 四、开仓检查清单（必须全部通过才买）

系统侧（票上已体现）：

1. 标的在 **`keep`**（不在 `keep` 的 `buy` 候选 → 不做）。  
2. 日线已收盘，`asof` 是你要跟的交易日。  
3. 未标 `over_capital`，且一手 ≤ 你的可用现金。

你必须自己看的：

4. **次日开盘买**，不在信号日尾盘追。  
5. 涨停开盘 / 停牌 → 放弃该票（不换池外替补）。  
6. 当前总只数对齐 `n`；已满仓且无 `sell` → 不开新仓。  
7. **不加仓摊平。**

```text
IF 不在 keep → 不做
IF over_capital 或一手 > 现金 → 跳过
IF asof 不是最新已收盘日 → 不当日信号
IF 次日涨停开盘 / 停牌 → 放弃该票
IF 已有 sell → 先卖再买
ELSE → 次日开盘买 1 手，持有到 sell / 移出 keep
```

---

## 五、明确不要做

| 不要 | 原因 |
|------|------|
| 把「买入」栏当全买篮子 | `buy` 是候选池；目标是 `keep`/`n` |
| 用池外票替换买不起的 `keep` | 等于改信号 |
| 当 LC 做：温度门、4 棒到期、高开>2% 放弃 | **不是同一条策略**；高开放弃若要加，须口头改口径后再写进本文 |
| 自设止损/止盈改出场 | 引擎止损关着；出场跟 `sell` |
| 数据没更新仍当「今日票」 | panel 会停在旧 `asof` |
| 自动下单 / 改信号数学 / 动优胜劣汰研究线 | 看板职责边界 |
| 默认连 Mac MySQL | 本 MVP 只用 `a_data` parquet |

---

## 六、mode / 斜率门速查

| 状态 | 含义 | 实盘含义 |
|------|------|----------|
| `mode=quality` | 低波小票环境 | 按 `keep` 执行 |
| `mode=guard` | 低波大票；常含斜率门拦截 quality | 仍按 `keep`；只数可能仍是 2 或因 hard_off 变 1 |
| `hard_off` | 急跌防守 | **n=1**，仓位更集中 |
| `slope_gate_blocks_quality` | 宽度 5 日斜率 &lt;0，不进/不留 quality | 解释为何偏 guard；不必另做动作 |

---

## 七、已知风险（跟之前要心里有数）

1. **无系统止损**，回撤可深（研究样本最大回撤量级约约三成）。  
2. 研究目标（每年≥40% / 完整年全正等）**尚未达标**；HANDOFF 禁止为「少亏一点」偷偷改目标。  
3. **1 万 vs 研究 2 万账本**：跳过超本金票 → PnL 路径分叉。  
4. **隔夜缺口**躲不掉；本文默认**不加**「次日高开>2% 放弃」（那是 LC 纪律）。若要加，先口头定口径。  
5. Pages 是快照，改完票要重新 export + push；盘中以 box `:8787` 为准。

---

## 八、每日收盘后可对 Agent 说

```text
按 docs/held-execution-playbook.md（1 万 HITL）：
1）asof / mode / n / hard_off / fresh
2）keep / sell；哪些一手 over_capital
3）明日：卖列表、应买（keep 缺口且买得起）、跳过、不动
4）不要扫买入栏全池
```

Agent 应：读 `/api/ticket` 或最新 ticket，按本文输出明日动作；**不改信号、不下单**。

---

## 九、相关路径

| 项 | 路径 |
|----|------|
| 项目 | `/workspace/held_dashboard/` |
| 本纪律 | `docs/held-execution-playbook.md` |
| 看板说明 | `README.md` |
| 刷面板 | `scripts/prepare_panel_from_a_data.py` |
| 出票 | `ticket_runner.py` |
| 静态页 | `scripts/export_static_pages.py` |
| 规则来源 | `trading-cn-survival` / HANDOFF held+斜率门 |
