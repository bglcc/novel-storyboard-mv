import React from 'react';
import { Link } from 'react-router-dom';

const Layout = ({ children }) => {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">小说分镜头可视化创作系统</div>
        <nav>
          <Link to="/">首页</Link>
          <Link to="/resources">资源库</Link>
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
};

export default Layout;
