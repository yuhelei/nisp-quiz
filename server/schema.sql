-- NISP 刷题站数据库初始化脚本（MySQL 5.5 兼容）
-- 用法：node server/init-db.js（自动执行）

CREATE DATABASE IF NOT EXISTS nisp_quiz
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE nisp_quiz;

-- 用户账号表（密码只存加盐哈希，绝不存明文）
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(20)  NOT NULL UNIQUE,
  password_hash CHAR(64)     NOT NULL COMMENT 'SHA-256(salt+password)',
  salt          CHAR(32)     NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME     NULL,
  last_login_ip VARCHAR(45)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 登录日志表（每次登录记录 IP 与设备）
CREATE TABLE IF NOT EXISTS login_logs (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  ip         VARCHAR(45)  NOT NULL,
  user_agent VARCHAR(255) NULL,
  login_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  KEY idx_time (login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 登录令牌表（记住密码：30 天有效）
CREATE TABLE IF NOT EXISTS tokens (
  token      CHAR(64)     PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  expires_at DATETIME     NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户刷题数据表（整包 JSON 存取：进度/错题/收藏/考试历史/统计）
CREATE TABLE IF NOT EXISTS user_state (
  user_id    INT UNSIGNED PRIMARY KEY,
  data       LONGTEXT     NOT NULL,
  updated_at DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
