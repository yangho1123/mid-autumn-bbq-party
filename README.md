# 中秋烤肉會｜雲端共享清單網站

這個版本已經準備好部署到 Render。網站使用 Node.js Web Service，資料寫入 `/var/data/data.json`，搭配 Render Persistent Disk 後，重新啟動或重新部署時仍可保留活動資料。

## 本機測試

需要 Node.js 18 以上。

```bash
npm start
```

開啟：`http://localhost:3000`

## 部署到 Render

1. 把這個專案放到 GitHub repository。
2. 登入 Render，選擇 **New → Web Service**。
3. 連接 GitHub repository。
4. Render 會讀取 `render.yaml`，使用：
   - Build Command：`npm install`
   - Start Command：`npm start`
   - Health Check：`/api/health`
   - Persistent Disk：`/var/data`
5. 建立服務並等待部署完成。
6. Render 會提供一個公開的 `onrender.com` 網址，可以直接分享給朋友。

### 重要

Render 的一般檔案系統是 ephemeral；如果直接把資料寫在專案目錄，重新部署或重新啟動可能會遺失。這個版本已改成使用 `DATA_DIR`，並在 `render.yaml` 把資料放到 `/var/data` 的 Persistent Disk。Render 官方文件指出 Persistent Disk 可保留部署與重啟間的檔案變更，但需要付費 Web Service。

如果之後要做正式多人使用，建議再把資料從 JSON 升級成 PostgreSQL，並加入登入、邀請連結與活動權限。
