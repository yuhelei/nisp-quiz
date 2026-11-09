/**
 * init-db.js - 初始化数据库（执行 schema.sql）
 * 用法：node server/init-db.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

async function main() {
  // 先不指定 database，连接后建库
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    charset: 'utf8mb4_general_ci',
  });
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql
    .split(';')
    .map(function (s) { return s.replace(/^\s*--.*$/gm, '').trim(); })
    .filter(function (s) { return s.length > 0; });

  for (const stmt of statements) {
    await conn.query(stmt);
  }
  const [tables] = await conn.query("SHOW TABLES FROM nisp_quiz");
  console.log('[db] 初始化完成，nisp_quiz 库中的表：');
  tables.forEach(function (r) { console.log('  - ' + Object.values(r)[0]); });
  await conn.end();
}

main().catch(function (err) {
  console.error('[db] 初始化失败：' + err.message);
  process.exit(1);
});
