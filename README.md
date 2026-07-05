# そろばん帳場 - 簿記3級学習アプリ

日商簿記3級の学習アプリです。一問一答・模擬試験・単語クイズに加えて、
Gemini API を使った類似問題の自動生成に対応しています。

## 1. GitHubにアップロード
git init
git add .
git commit -m "簿記3級学習アプリ 初回コミット"
git remote add origin https://github.com/<ユーザー名>/soroban-choba.git
git branch -M main
git push -u origin main

## 2. Gemini APIキーを取得
https://aistudio.google.com/apikey で発行(AIza... から始まる文字列)

## 3. Vercelにデプロイ
- vercel.com にGitHubアカウントでサインアップ
- Add New → Project → 該当リポジトリをImport
- Environment Variables に GEMINI_API_KEY を追加
- Deploy

## 4. 更新
git add . && git commit -m "更新" && git push で自動再デプロイ
