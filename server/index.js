/**
 * index.js - NISP 刷题站后端服务
 *
 * 功能：
 *   - MySQL 持久化：用户账号（SHA-256+盐）、登录日志（IP/UA）、30 天 token、刷题数据同步
 *   - REST API：/api/ping /api/register /api/login /api/me /api/state
 *   - 静态托管前端（index.html + css/js/data）
 *
 * 启动：node server/index.js   → http://localhost:3000
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mysql = require('mysql2/promise');

// ============== 配置 ==============
const ROOT = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const PORT = config.httpPort || 3000;
const TOKEN_DAYS = config.tokenDays || 30;

// ============== MySQL 连接池 ==============
const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  connectionLimit: 10,
  charset: 'utf8mb4_general_ci',
  supportBigNumbers: true,
});

// ============== 工具函数 ==============
function hashPassword(salt, password) {
  return crypto.createHash('sha256').update(salt + password, 'utf8').digest('hex');
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function newSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  let ip = (req.socket && req.socket.remoteAddress) || '';
  return ip.replace(/^::ffff:/, '') || '未知';
}

function validateUsername(u) {
  return typeof u === 'string' && /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/.test(u);
}

function validatePassword(p) {
  return typeof p === 'string' && p.length >= 6 && p.length <= 64;
}

/** 异步路由包装：捕获异常返回 500 */
function wrap(fn) {
  return function (req, res) {
    fn(req, res).catch(function (err) {
      console.error('[api]', err.message);
      if (!res.headersSent) res.status(500).json({ ok: false, msg: '服务器内部错误' });
    });
  };
}

/** Bearer token 认证，返回 {userId, username} 或抛 401 */
async function requireAuth(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw Object.assign(new Error('未登录'), { status: 401 });
  const [rows] = await pool.query(
    'SELECT t.user_id, t.expires_at, u.username FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?',
    [token]
  );
  if (!rows.length) throw Object.assign(new Error('登录已失效'), { status: 401 });
  if (new Date(rows[0].expires_at) < new Date()) {
    await pool.query('DELETE FROM tokens WHERE token = ?', [token]);
    throw Object.assign(new Error('登录已过期，请重新登录'), { status: 401 });
  }
  return { userId: rows[0].user_id, username: rows[0].username, token: token };
}

// ============== 应用 ==============
const app = express();
app.use(express.json({ limit: '2mb' }));

// 简易 CORS（本机/局域网自用）
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------- 存活探测 ----------
app.get('/api/ping', wrap(async function (req, res) {
  await pool.query('SELECT 1');
  res.json({ ok: true, server: 'nisp', time: Date.now() });
}));

// ---------- 注册 ----------
app.post('/api/register', wrap(async function (req, res) {
  const { username, password } = req.body || {};
  if (!validateUsername(username)) return res.status(400).json({ ok: false, msg: '用户名需 2-20 位（中文/字母/数字/下划线）' });
  if (!validatePassword(password)) return res.status(400).json({ ok: false, msg: '密码至少 6 位' });

  const salt = newSalt();
  const hash = hashPassword(salt, password);
  try {
    const [r] = await pool.query(
      'INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)',
      [username, hash, salt]
    );
    const userId = r.insertId;
    // 注册即登录：发 token + 记一条登录日志
    const token = await issueToken(userId);
    await logLogin(userId, req);
    res.json({ ok: true, token: token, username: username });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, msg: '用户名已被注册' });
    }
    throw err;
  }
}));

async function issueToken(userId) {
  const token = newToken();
  await pool.query(
    'INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
    [token, userId, TOKEN_DAYS]
  );
  return token;
}

async function logLogin(userId, req) {
  const ip = getClientIp(req);
  const ua = String(req.headers['user-agent'] || '').slice(0, 255);
  await pool.query(
    'INSERT INTO login_logs (user_id, ip, user_agent) VALUES (?, ?, ?)',
    [userId, ip, ua]
  );
  await pool.query('UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?', [ip, userId]);
}

// ---------- 登录 ----------
app.post('/api/login', wrap(async function (req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, msg: '请输入用户名和密码' });

  const [rows] = await pool.query('SELECT id, username, password_hash, salt FROM users WHERE username = ?', [username]);
  if (!rows.length) return res.status(401).json({ ok: false, msg: '用户名或密码错误' });
  const user = rows[0];
  const hash = hashPassword(user.salt, password);
  // 常量时间比较，防时序侧信道
  const a = Buffer.from(hash), b = Buffer.from(user.password_hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, msg: '用户名或密码错误' });
  }

  const token = await issueToken(user.id);
  await logLogin(user.id, req);
  res.json({ ok: true, token: token, username: user.username });
}));

// ---------- 当前用户 ----------
app.get('/api/me', wrap(async function (req, res) {
  const auth = await requireAuth(req);
  res.json({ ok: true, userId: auth.userId, username: auth.username });
}));

// ---------- 退出登录（吊销 token） ----------
app.post('/api/logout', wrap(async function (req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) await pool.query('DELETE FROM tokens WHERE token = ?', [token]);
  res.json({ ok: true });
}));

// ---------- 刷题数据同步 ----------
// 拉取：登录后用服务端状态覆盖本地
app.get('/api/state', wrap(async function (req, res) {
  const auth = await requireAuth(req);
  const [rows] = await pool.query('SELECT data, updated_at FROM user_state WHERE user_id = ?', [auth.userId]);
  if (!rows.length) return res.json({ ok: true, data: null, updatedAt: null });
  let data = null;
  try { data = JSON.parse(rows[0].data); } catch (e) { data = null; }
  res.json({ ok: true, data: data, updatedAt: rows[0].updated_at });
}));

// 推送：本地变更防抖后上传（整包覆盖，最后写入胜出）
app.post('/api/state', wrap(async function (req, res) {
  const auth = await requireAuth(req);
  const data = req.body && req.body.data;
  if (!data || typeof data !== 'object') return res.status(400).json({ ok: false, msg: '数据格式错误' });
  const json = JSON.stringify(data);
  await pool.query(
    'INSERT INTO user_state (user_id, data, updated_at) VALUES (?, ?, NOW()) ' +
    'ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()',
    [auth.userId, json]
  );
  res.json({ ok: true });
}));

// ---------- 静态托管前端（仅公开资源） ----------
app.use('/css', express.static(path.join(ROOT, 'css')));
app.use('/js', express.static(path.join(ROOT, 'js')));
app.use('/data', express.static(path.join(ROOT, 'data')));
app.get('/', function (req, res) {
  res.sendFile(path.join(ROOT, 'index.html'));
});
app.use(express.static(ROOT, { index: false, dotfiles: 'ignore' }));

// 404
app.use(function (req, res) {
  res.status(404).json({ ok: false, msg: '接口不存在' });
});

// ============== 启动 ==============
async function main() {
  // 启动前先验证数据库连通性
  try {
    await pool.query('SELECT 1');
    console.log('[db] MySQL 连接成功 →', config.mysql.host + ':' + config.mysql.port);
  } catch (err) {
    console.error('[db] MySQL 连接失败：' + err.message);
    console.error('     请确认 MySQLCC 服务已启动、server/schema.sql 已执行、config.json 密码正确');
    process.exit(1);
  }
  http.createServer(app).listen(PORT, function () {
    console.log('[http] NISP 刷题站已启动 → http://localhost:' + PORT);
    console.log('       局域网访问：http://<本机IP>:' + PORT + '（同 Wi-Fi 手机可用）');
  });
}

main();
