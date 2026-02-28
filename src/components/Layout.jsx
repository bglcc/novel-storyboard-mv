import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/main.css';

const Layout = ({ children }) => {
  const location = useLocation();
  const isWidePage = /^\/novel\/[^/]+\/chapter\/[^/]+$/.test(location.pathname);

  return (
    <div className="app-shell">
      <header className="app-header app-header-fixed">
        <div className="brand">小说分镜头可视化创作系统</div>
        <nav>
          <Link to="/">首页</Link>
          <Link to="/resources">资源库</Link>
          <Link to="/rules">规则库</Link>
        </nav>
      </header>
      <main className={`app-main ${isWidePage ? 'app-main-wide' : ''}`}>{children}</main>
    </div>
  );
};

export default Layout;