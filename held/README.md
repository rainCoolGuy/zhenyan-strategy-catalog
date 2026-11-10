# held / 斜率门 · GitHub Pages 静态快照

本目录是 **明文** 静态页，挂在加密策略目录站点旁，**不进 AES 加密树**。

- 页面：`index.html` + `ticket.json` + `bars/*.json`
- 实时刷新：仍在 box 上跑 `uvicorn app:app --port 8787`；Pages 只在重新执行导出后更新
- 数据源：box `a_data` 面板，不连 Mac MySQL
- 再导出：

```bash
cd /workspace/held_dashboard
.venv/bin/python scripts/export_static_pages.py --out /tmp/zhenyan-strategy-catalog
# 然后在 catalog 仓库 commit held/ 并 push main
```
