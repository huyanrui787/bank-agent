#!/usr/bin/env bash
# 启动演示用的 MySQL + PostgreSQL 容器并初始化演示数据。
# 前提：Docker 可用，且能访问 Docker Hub（或被配置了镜像加速）。
# 完成后，应用里的「对公信贷库(MySQL)」「企业画像库(PostgreSQL)」数据源即可测试连接。
set -euo pipefail

MYSQL_NAME=bank-demo-mysql
PG_NAME=bank-demo-postgres

echo "==> 启动 MySQL (corp_credit) ..."
docker rm -f "$MYSQL_NAME" >/dev/null 2>&1 || true
docker run -d --name "$MYSQL_NAME" \
  -e MYSQL_ROOT_PASSWORD=demo123 \
  -e MYSQL_DATABASE=corp_credit \
  -p 3306:3306 mysql:8

echo "==> 启动 PostgreSQL (corp_profile) ..."
docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
docker run -d --name "$PG_NAME" \
  -e POSTGRES_PASSWORD=demo123 \
  -e POSTGRES_DB=corp_profile \
  -p 5432:5432 postgres:15-alpine

echo "==> 等待数据库就绪 ..."
for _ in $(seq 1 60); do
  docker exec "$MYSQL_NAME" mysqladmin ping -uroot -pdemo123 --silent >/dev/null 2>&1 && break
  sleep 2
done
for _ in $(seq 1 60); do
  docker exec "$PG_NAME" pg_isready -U postgres 2>/dev/null | grep -q accepting && break
  sleep 2
done

echo "==> 初始化 MySQL 数据 ..."
docker exec -i "$MYSQL_NAME" mysql -uroot -pdemo123 corp_credit <<'SQL'
CREATE TABLE IF NOT EXISTS credit_limits (
  company_id VARCHAR(10) PRIMARY KEY,
  limit_amount BIGINT,
  used_amount BIGINT,
  rating VARCHAR(10),
  status VARCHAR(20)
);
INSERT INTO credit_limits VALUES
('E001', 50000000, 32000000, 'AA', '正常'),
('E004', 120000000, 60000000, 'AAA', '正常'),
('E009', 80000000, 80000000, 'AA', '关注'),
('E014', 150000000, 90000000, 'AAA', '正常'),
('E020', 60000000, 45000000, 'A', '正常'),
('E026', 70000000, 70000000, 'A', '关注'),
('E034', 30000000, 10000000, 'BB', '正常'),
('E036', 25000000, 22000000, 'B', '逾期');
SQL

echo "==> 初始化 PostgreSQL 数据 ..."
docker exec -i "$PG_NAME" psql -U postgres -d corp_profile <<'SQL'
CREATE TABLE IF NOT EXISTS company_profiles (
  company_id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100),
  industry VARCHAR(20),
  credit_score INT,
  risk_tags TEXT
);
INSERT INTO company_profiles VALUES
('E001', '西安华宇精密制造有限公司', '制造业', 92, '优质'),
('E004', '陕西隆基建筑集团有限公司', '建筑', 95, '优质'),
('E006', '陕西关中餐饮管理有限公司', '餐饮', 58, '高负债'),
('E009', '西安恒信新材料科技有限公司', '科技', 88, '成长型'),
('E014', '陕西秦风电子制造有限公司', '制造业', 90, '优质'),
('E017', '西安百味轩餐饮服务有限公司', '餐饮', 45, '高风险'),
('E026', '陕西中科智能装备有限公司', '制造业', 86, '稳健'),
('E036', '陕西华宇物流有限公司', '物流', 70, '关注');
SQL

echo "==> 完成。数据源连接信息："
echo "  MySQL:      127.0.0.1:3306  corp_credit  root/demo123"
echo "  PostgreSQL: 127.0.0.1:5432  corp_profile  postgres/demo123"
