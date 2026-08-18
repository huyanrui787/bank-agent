#!/usr/bin/env python3
"""Take comprehensive screenshots for the AI customer assistant manual."""

import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3003"
OUT_DIR = Path(__file__).resolve().parent.parent / "generated" / "manual_screenshots"
OUT_DIR.mkdir(parents=True, exist_ok=True)

VIEWPORT = {"width": 1600, "height": 1000}


def screenshot(page, name: str, full_page: bool = False):
    path = OUT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=full_page)
    print(f"Screenshot saved: {path}")
    return path


def login(page):
    page.goto(f"{BASE_URL}/login")
    page.wait_for_selector("input#username", timeout=10000)
    page.fill("input#username", "admin")
    page.fill("input#password", "demo123")
    page.click("button[type='submit']")
    page.wait_for_url(f"{BASE_URL}/", timeout=15000)
    page.wait_for_selector("aside nav a[href='/']", timeout=10000)
    time.sleep(0.5)


def navigate(page, path: str):
    page.goto(f"{BASE_URL}{path}")
    time.sleep(1.2)


def ensure_no_toast(page, timeout=3000):
    """Wait a moment for transient toasts to disappear."""
    time.sleep(timeout / 1000)


def scroll_to(page, y: int):
    """Scroll the main content container (not the window body)."""
    page.locator("main.flex-1.overflow-y-auto").evaluate(f"(el) => el.scrollTo(0, {y})")
    time.sleep(0.4)


def click_sidebar(page, label: str):
    link = page.locator("aside nav").get_by_text(label, exact=True)
    link.click()
    time.sleep(1.2)


def new_chat(page):
    """Click the new-conversation button in the chat sidebar."""
    page.locator("button:has-text('新建')").first.click()
    time.sleep(0.5)


def run_workbench_prompt(page, prompt_text: str, timeout: int = 20000):
    """Click a quick prompt and wait for streaming to finish."""
    chip = page.get_by_text(prompt_text, exact=False).first
    chip.wait_for(state="visible", timeout=10000)
    chip.click()
    # Wait for assistant message area to appear (any result card or text)
    page.wait_for_selector("[class*='flex-1 overflow-y-auto'] > div", timeout=timeout)
    # Wait for streaming cursor to disappear
    page.wait_for_selector(".animate-blink", state="detached", timeout=timeout)
    time.sleep(0.8)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport=VIEWPORT)
        page = context.new_page()
        context.clear_cookies()

        # 1. Login page
        page.goto(f"{BASE_URL}/login")
        page.wait_for_selector("input#username", timeout=10000)
        screenshot(page, "01_login")

        # 2. Dashboard empty (wait for compile indicator to disappear)
        login(page)
        time.sleep(4)
        screenshot(page, "02_dashboard_empty")

        # 3. AI Workbench - customer segment scenario
        run_workbench_prompt(page, "梳理 高新区·锦园 中日均存款大于 10 万元的客户清单")
        screenshot(page, "03_dashboard_customer_segment")

        # 4. AI Workbench - business alert scenario
        new_chat(page)
        run_workbench_prompt(page, "扫描本月所有业务预警")
        screenshot(page, "04_dashboard_business_alert")

        # 5. AI Workbench - customer analysis scenario
        new_chat(page)
        run_workbench_prompt(page, "分析 张明 的风险情况，并生成调查报告")
        screenshot(page, "05_dashboard_customer_analysis")

        # 6. AI Workbench - vertical management scenario
        new_chat(page)
        run_workbench_prompt(page, "统计各客户经理本月新增存款客户")
        screenshot(page, "06_dashboard_vertical_management")

        # 7. Customer segments - top screen
        navigate(page, "/customer-segments")
        page.wait_for_selector("text=客群梳理", timeout=10000)
        screenshot(page, "07_customer_segments_top")

        # 8. Customer segments - scrolled to customer list
        scroll_to(page, 900)
        screenshot(page, "08_customer_segments_list")

        # 9. Vertical management - top screen
        navigate(page, "/vertical-management")
        page.wait_for_selector("text=客户经理垂直管理", timeout=10000)
        page.click("button:has-text('导入支行客户清单')")
        time.sleep(0.3)
        page.click("button:has-text('AI 自动分配客户经理')")
        time.sleep(0.8)
        screenshot(page, "09_vertical_management_top")

        # 10. Vertical management - scrolled to assignment result table
        scroll_to(page, 650)
        screenshot(page, "10_vertical_management_assignment")

        # 11. Vertical management - performance tab (default is performance)
        page.click("button:has-text('经理绩效排名')")
        time.sleep(0.5)
        screenshot(page, "11_vertical_management_performance")

        # 12. Vertical management - new customers tab
        page.click("button:has-text('本月新增存贷客户')")
        time.sleep(0.5)
        screenshot(page, "12_vertical_management_new_customers")

        # 13. Vertical management - potential loan tab
        page.click("button:has-text('扩中客群贷款')")
        time.sleep(0.5)
        screenshot(page, "13_vertical_management_potential")

        # 14. Vertical management - drill dialog (first row "查看客户")
        # Switch back to performance tab where the drill button exists
        page.click("button:has-text('经理绩效排名')")
        time.sleep(0.5)
        page.locator("button:has-text('查看客户')").first.click()
        page.wait_for_selector("text=今年新引入客户清单", timeout=10000)
        time.sleep(0.4)
        screenshot(page, "14_vertical_management_drill_dialog")
        page.keyboard.press("Escape")
        time.sleep(0.3)

        # 15. Alerts list - top screen
        navigate(page, "/alerts")
        page.wait_for_selector("text=业务预警", timeout=10000)
        screenshot(page, "15_alerts_top")

        # 16. Alerts list - scrolled down
        scroll_to(page, 500)
        screenshot(page, "16_alerts_scrolled")

        # 17. Alert detail drawer
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(0.3)
        page.get_by_text("存款即将到期").first.click()
        page.wait_for_selector("text=AI 建议下一步", timeout=10000)
        time.sleep(0.4)
        screenshot(page, "17_alert_detail")

        # 18. Alert detail with generated script
        page.click("button:has-text('生成联系话术')")
        page.wait_for_selector("text=AI 沟通话术", timeout=10000)
        time.sleep(0.4)
        screenshot(page, "18_alert_detail_script")
        page.keyboard.press("Escape")
        time.sleep(0.3)

        # 19. Analysis - risk & admission tab (default)
        navigate(page, "/analysis")
        page.wait_for_selector("text=查询分析", timeout=10000)
        page.wait_for_selector("text=风险与准入", timeout=20000)
        time.sleep(0.5)
        screenshot(page, "19_analysis_risk")

        # 20. Analysis - cashflow tab
        page.click("button:has-text('资金流分析')")
        time.sleep(0.6)
        screenshot(page, "20_analysis_cashflow")

        # 21. Analysis - product recommendation tab
        page.click("button:has-text('产品推荐')")
        time.sleep(0.6)
        screenshot(page, "21_analysis_recommend")

        # 22. Analysis - marketing script tab
        page.click("button:has-text('营销话术')")
        time.sleep(0.6)
        screenshot(page, "22_analysis_script")

        # 23. Skill Center - home
        navigate(page, "/skills")
        page.wait_for_selector("text=Skill Center", timeout=10000)
        screenshot(page, "23_skills_home")

        # 24. Skill detail dialog
        page.locator("button:has-text('查看')").first.click()
        page.wait_for_selector("text=注入的 Prompt 片段", timeout=10000)
        time.sleep(0.4)
        screenshot(page, "24_skills_detail")
        page.keyboard.press("Escape")
        time.sleep(0.3)

        # 25. Skill edit sheet
        page.locator("button:has-text('编辑')").first.click()
        page.wait_for_selector("text=提示词内容", timeout=10000)
        time.sleep(0.4)
        screenshot(page, "25_skills_edit")
        page.keyboard.press("Escape")
        time.sleep(0.3)

        # 26. Skill create sheet
        page.click("button:has-text('新建 Skill')")
        page.wait_for_selector("text=新建自定义 Skill", timeout=10000)
        time.sleep(0.4)
        screenshot(page, "26_skills_create")
        page.keyboard.press("Escape")
        time.sleep(0.3)

        # 27. QA assistant - home
        navigate(page, "/qa")
        page.wait_for_selector("text=问答助手", timeout=10000)
        screenshot(page, "27_qa_home")

        # 28. QA assistant - result
        page.get_by_text("小微企业贷款最高额度是多少？").first.click()
        page.wait_for_selector("text=AI 答复", timeout=20000)
        time.sleep(0.5)
        screenshot(page, "28_qa_result")

        # 29. QA assistant - knowledge base dialog
        page.get_by_text("内置 15 条知识库").first.click()
        page.wait_for_selector("text=内置知识库", timeout=10000)
        time.sleep(0.4)
        screenshot(page, "29_qa_knowledge_base")
        page.keyboard.press("Escape")
        time.sleep(0.3)

        # 30. Workflow list
        navigate(page, "/workflow")
        page.wait_for_selector("text=Agent 编排工作流", timeout=10000)
        screenshot(page, "30_workflow_list")

        # 31. Workflow editor (create from first preset)
        page.locator("button:has-text('使用模板')").first.click()
        page.wait_for_url(f"{BASE_URL}/workflow/**", timeout=15000)
        page.wait_for_selector("text=加载画布中", state="detached", timeout=20000)
        time.sleep(1.5)
        screenshot(page, "31_workflow_editor")

        # 32. Workflow editor with run panel open
        page.click("button:has-text('运行')")
        page.wait_for_selector("text=运行工作流", timeout=10000)
        time.sleep(0.4)
        screenshot(page, "32_workflow_run_panel")

        # 33. Tasks - empty home
        navigate(page, "/tasks")
        page.wait_for_selector("text=定时任务", timeout=10000)
        screenshot(page, "33_tasks_home")

        # 34. Tasks - create sheet
        page.click("button:has-text('新建任务')")
        page.wait_for_selector("text=新建定时任务", timeout=10000)
        time.sleep(0.4)
        screenshot(page, "34_tasks_create")

        browser.close()
        print("All screenshots captured.")


if __name__ == "__main__":
    main()
