// ========================================
// 1. 自动更新页脚年份
// ========================================

// 找到 HTML 中 id 为 current-year 的元素
const yearElement = document.getElementById("current-year");

// 获取当前年份，并显示在页面上
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

// ========================================
// 2. 手机端导航菜单
// ========================================

// 获取菜单按钮和导航列表
const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");

// 切换菜单的打开和关闭状态
function setMenuOpen(isOpen) {
  if (!menuToggle || !navLinks) {
    return;
  }

  // 添加或移除 CSS 类，控制菜单显示
  navLinks.classList.toggle("is-open", isOpen);

  // 更新无障碍属性，告诉辅助技术菜单是否展开
  menuToggle.setAttribute("aria-expanded", String(isOpen));

  // 更新按钮提示文字
  menuToggle.setAttribute(
    "aria-label",
    isOpen ? "关闭导航菜单" : "打开导航菜单"
  );
}

// 点击按钮时切换菜单
if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.contains("is-open");
    setMenuOpen(!isOpen);
  });

  // 点击导航链接后关闭菜单
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      setMenuOpen(false);
    });
  });

  // 按 Escape 键关闭菜单
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
    }
  });

  // 从手机尺寸切换到桌面尺寸时，清除手机菜单状态
  window.addEventListener("resize", () => {
    if (window.innerWidth > 680) {
      setMenuOpen(false);
    }
  });
}
