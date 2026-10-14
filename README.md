# razer_driver

非官方的 **Razer Huntsman V3 Pro Tenkeyless（RZ03-0498）網頁版設定工具**，
透過 WebHID 在瀏覽器裡直接設定鍵盤，主要給 macOS 使用者——Razer Synapse 不支援
macOS，官方的 Synapse Web 也只支援 8KHz 版（RZ03-0552）。

*Unofficial WebHID configurator for the Razer Huntsman V3 Pro TKL (RZ03-0498).
Not affiliated with or endorsed by Razer.*

## 狀態

剛建立專案骨架，還不能控制鍵盤。規劃中的功能（依優先順序）：

1. 觸發點 / Rapid Trigger / Snap Tap
2. RGB 燈效與亮度
3. 改鍵、Hypershift、巨集
4. 板載設定檔、回報率等其他設定

鍵盤韌體本身不支援的功能（例如 Tournament Mode）不會出現在介面上。

## 需求

- Chrome、Edge、Opera 或 Brave（Firefox 和 Safari 不支援 WebHID）
- Razer Huntsman V3 Pro Tenkeyless，USB ID `1532:02A7`

## 本機執行

```sh
npm install
npm run dev        # 開 http://localhost:5173
```

## 開發

指令、Definition of done 和專案規則都在 [`CLAUDE.md`](./CLAUDE.md)。
專案的工作記憶在 `.ai_context/`（由
[claude-starter](https://github.com/kouok415/claude-starter) 建立）。

## 免責聲明

本工具會直接寫入鍵盤設定，使用風險自負。協議資訊來自公開來源與逆向工程，
並非 Razer 官方文件。
