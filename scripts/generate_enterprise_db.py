#!/usr/bin/env python3
"""生成「企业客户」独立 SQLite 库 data/enterprise.db。

用于演示「数据源」模块：接入一个与默认 bank.db（个人客户）完全不同的
外部数据源，并用 AI 问数 / 工作流 codeact 节点对它做跨库分析。

数据全部为虚构演示数据，不含真实企业信息。
"""
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE_DIR, "data", "enterprise.db")

# (name, industry, scale, capital_wan, established, legal_rep, tax_level, risk_level, manager)
COMPANIES = [
    ("西安华宇精密制造有限公司", "制造业", "中型", 8000, "2012-05-18", "王建国", "A", "low", "李雪"),
    ("陕西恒达贸易有限公司", "批发零售", "小型", 1200, "2016-09-03", "张伟", "B", "medium", "王晓东"),
    ("西安天启信息技术有限公司", "科技", "小型", 500, "2018-03-22", "刘洋", "A", "low", "赵敏"),
    ("陕西隆基建筑集团有限公司", "建筑", "大型", 50000, "2003-11-08", "李建军", "A", "low", "陈伟"),
    ("西安秦风物流有限公司", "物流", "中型", 3000, "2014-07-15", "赵强", "B", "medium", "刘洋"),
    ("陕西关中餐饮管理有限公司", "餐饮", "小型", 800, "2019-01-30", "孙丽", "C", "high", "孙静"),
    ("西安绿源农业发展有限公司", "农业", "微型", 300, "2020-06-12", "周涛", "B", "medium", "周建华"),
    ("陕西康宁医疗器械有限公司", "医疗", "中型", 6000, "2015-02-27", "吴磊", "A", "low", "高雪松"),
    ("西安恒信新材料科技有限公司", "科技", "中型", 4500, "2017-10-09", "郑刚", "A", "low", "马涛"),
    ("陕西宏远机械制造有限公司", "制造业", "中型", 9500, "2011-04-16", "冯军", "B", "medium", "李雪"),
    ("西安尚品服饰贸易有限公司", "批发零售", "微型", 200, "2021-08-05", "何静", "C", "high", "王晓东"),
    ("陕西中盛建设工程有限公司", "建筑", "中型", 12000, "2009-06-23", "罗明", "B", "medium", "陈伟"),
    ("西安迅捷供应链科技有限公司", "物流", "小型", 1500, "2019-11-14", "高翔", "B", "low", "赵敏"),
    ("陕西秦风电子制造有限公司", "制造业", "大型", 30000, "2005-09-30", "秦海", "A", "low", "李雪"),
    ("西安鲜丰农产品有限公司", "农业", "小型", 600, "2018-05-20", "林峰", "B", "medium", "周建华"),
    ("陕西仁和堂医药连锁有限公司", "医疗", "中型", 7000, "2013-12-11", "陈晨", "A", "low", "吴磊"),
    ("西安百味轩餐饮服务有限公司", "餐饮", "微型", 150, "2022-03-18", "王芳", "D", "high", "孙静"),
    ("陕西华信建材贸易有限公司", "批发零售", "中型", 2800, "2015-08-25", "刘强", "B", "medium", "王晓东"),
    ("西安云图大数据科技有限公司", "科技", "小型", 900, "2020-02-14", "李明", "A", "low", "赵敏"),
    ("陕西通达物流有限公司", "物流", "大型", 8000, "2010-07-08", "杨帆", "A", "low", "刘洋"),
    ("西安精工机械制造有限公司", "制造业", "小型", 2000, "2016-04-01", "张杰", "B", "medium", "李雪"),
    ("陕西绿洲农业开发有限公司", "农业", "中型", 4000, "2012-09-17", "吴桐", "B", "low", "周建华"),
    ("西安康桥医疗科技有限公司", "医疗", "小型", 1200, "2019-06-28", "郑爽", "B", "medium", "吴磊"),
    ("陕西食为天餐饮有限公司", "餐饮", "中型", 1800, "2017-03-06", "刘洋", "C", "high", "孙静"),
    ("西安恒润贸易有限公司", "批发零售", "小型", 1000, "2018-11-19", "冯宇", "B", "medium", "王晓东"),
    ("陕西中科智能装备有限公司", "制造业", "中型", 11000, "2014-08-12", "马超", "A", "low", "李雪"),
    ("西安启航网络科技有限公司", "科技", "微型", 400, "2021-05-23", "何俊", "B", "medium", "赵敏"),
    ("陕西大唐建筑工程有限公司", "建筑", "大型", 25000, "2008-02-29", "陈昊", "A", "low", "陈伟"),
    ("西安骏驰物流有限公司", "物流", "小型", 700, "2020-10-09", "罗成", "C", "high", "刘洋"),
    ("陕西丰登农业发展有限公司", "农业", "微型", 250, "2022-07-01", "韩磊", "B", "medium", "周建华"),
    ("西安惠民堂大药房有限公司", "医疗", "微型", 180, "2021-01-15", "高华", "C", "medium", "吴磊"),
    ("陕西金饭碗餐饮有限公司", "餐饮", "小型", 900, "2019-09-20", "王鹏", "C", "high", "孙静"),
    ("西安远航国际商贸有限公司", "批发零售", "中型", 5000, "2013-05-27", "刘涛", "A", "low", "王晓东"),
    ("陕西蓝天环保科技有限公司", "科技", "中型", 3500, "2016-07-19", "杨静", "A", "low", "赵敏"),
    ("西安宏图机械有限公司", "制造业", "小型", 1600, "2017-12-08", "周峰", "B", "medium", "李雪"),
    ("陕西华宇物流有限公司", "物流", "中型", 2200, "2015-04-22", "吴波", "B", "low", "刘洋"),
]

LOAN_TYPES = ["流动资金贷款", "固定资产贷款", "票据融资", "担保贷款"]
STATUS = ["正常", "正常", "正常", "关注", "逾期"]

# 金额单位：元
def gen_loans(companies):
    loans = []
    n = 1
    for idx, c in enumerate(companies):
        cid = f"E{idx+1:03d}"
        # 每家企业 1-3 笔贷款
        for j in range(1 + (idx % 3)):
            amt_wan = (5 + (idx * 37 + j * 53) % 400) * 10  # 50万 ~ 4000万
            loan_type = LOAN_TYPES[(idx + j) % len(LOAN_TYPES)]
            status = STATUS[(idx + j * 2) % len(STATUS)]
            start = f"202{3 + (idx % 3)}-{1 + (idx % 12):02d}-{1 + (j % 20):02d}"
            due = f"2026-{1 + ((idx + j) % 12):02d}-{1 + ((idx * 2 + j) % 27):02d}"
            rate = round(3.5 + ((idx + j) % 20) * 0.05, 2)
            loans.append((f"L{n:03d}", cid, loan_type, amt_wan * 10000, rate, start, due, status))
            n += 1
    return loans


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if os.path.exists(OUT):
        os.remove(OUT)

    conn = sqlite3.connect(OUT)
    c = conn.cursor()

    c.execute("""
    CREATE TABLE companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      scale TEXT NOT NULL,
      register_capital_wan REAL NOT NULL,
      established TEXT,
      legal_rep TEXT,
      tax_level TEXT,
      risk_level TEXT,
      manager_name TEXT
    )""")

    c.execute("""
    CREATE TABLE enterprise_loans (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      loan_type TEXT NOT NULL,
      amount REAL NOT NULL,
      rate REAL,
      start_date TEXT,
      due_date TEXT,
      status TEXT
    )""")

    for idx, comp in enumerate(COMPANIES):
        cid = f"E{idx+1:03d}"
        name, industry, scale, cap, est, rep, tax, risk, mgr = comp
        c.execute(
            "INSERT INTO companies VALUES (?,?,?,?,?,?,?,?,?,?)",
            (cid, name, industry, scale, cap, est, rep, tax, risk, mgr),
        )

    c.executemany(
        "INSERT INTO enterprise_loans VALUES (?,?,?,?,?,?,?,?)",
        gen_loans(COMPANIES),
    )

    conn.commit()

    n_comp = c.execute("SELECT COUNT(*) FROM companies").fetchone()[0]
    n_loan = c.execute("SELECT COUNT(*) FROM enterprise_loans").fetchone()[0]
    print(f"已生成 {OUT}")
    print(f"  companies: {n_comp} 家")
    print(f"  enterprise_loans: {n_loan} 笔")
    conn.close()


if __name__ == "__main__":
    main()
