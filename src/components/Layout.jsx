import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { buildGlobalSearchResults } from '../utils/globalSearch';
import '../styles/main.css';

const Layout = ({ children }) => {
  const location = useLocation();
  const { data, workspaceState, connectWorkspace, regenerateWorkspaceDirs, conflictState, resolveConflict } = useData();
  const isWidePage = /^\/novel\/[^/]+\/chapter\/[^/]+$/.test(location.pathname);

  const statusClassName = workspaceState.connected ? 'workspace-chip connected' : 'workspace-chip';

  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchPanelRef = useRef(null);

  const closeSearchPanel = () => {
    setGlobalSearch('');
    setHighlightedIndex(-1);
  };

  const createSearchNavigation = (path) => {
    navigate(path);
    closeSearchPanel();
  };

  useEffect(() => {
    const handleGlobalClick = (event) => {
      if (!searchPanelRef.current) return;
      if (!searchPanelRef.current.contains(event.target)) {
        closeSearchPanel();
      }
    };

    const handleEscKey = (event) => {
      if (event.key === 'Escape') closeSearchPanel();
    };

    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  useEffect(() => {
    closeSearchPanel();
  }, [location.pathname]);

  const searchResults = useMemo(() => buildGlobalSearchResults(data, globalSearch), [data, globalSearch]);

  const hasSearchResults =
    searchResults.novels.length || searchResults.shots.length || searchResults.resources.length;

  const orderedSearchEntries = useMemo(
    () => [
      ...searchResults.novels,
      ...searchResults.shots,
      ...searchResults.resources
    ],
    [searchResults]
  );

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [globalSearch, searchResults]);

  const onSearchInputKeyDown = (event) => {
    if (!globalSearch.trim()) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!orderedSearchEntries.length) return;
      setHighlightedIndex((prev) => (prev >= orderedSearchEntries.length - 1 ? 0 : prev + 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!orderedSearchEntries.length) return;
      setHighlightedIndex((prev) => (prev <= 0 ? orderedSearchEntries.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter' && highlightedIndex >= 0 && orderedSearchEntries[highlightedIndex]) {
      event.preventDefault();
      createSearchNavigation(orderedSearchEntries[highlightedIndex].path);
    }
  };

  const renderSearchResultItem = (item, tag, indexOffset) =>
    item.map((entry, index) => {
      const absoluteIndex = indexOffset + index;
      const activeClass = absoluteIndex === highlightedIndex ? ' global-search-item-active' : '';
      return (
        <button
          key={entry.id}
          className={`global-search-item${activeClass}`}
          type="button"
          onMouseEnter={() => setHighlightedIndex(absoluteIndex)}
          onClick={() => createSearchNavigation(entry.path)}
        >
          [{tag}] {entry.label}
        </button>
      );
    });

  return (
    <div className="app-shell">
      <header className="app-header app-header-fixed">
        <div className="brand">小说分镜头可视化创作系统</div>
        <div className="header-actions">
          <div className={statusClassName}>
            {workspaceState.connected
              ? `工作目录：${workspaceState.directoryName || '已连接'}`
              : '工作目录：未连接'}
          </div>

          <button type="button" className="button-secondary workspace-button" onClick={connectWorkspace}>
            {workspaceState.connected ? '切换工作目录' : '授权工作目录'}
          </button>
          <div className="global-search-wrap" ref={searchPanelRef}>
            <input
              className="search-input global-search-input"
              placeholder="全局搜索：卷名 / 镜号 / 素材名 / 场景名"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={onSearchInputKeyDown}
            />
            {globalSearch.trim() && (
              <div className="global-search-panel">
                {!hasSearchResults && <div className="global-search-empty">未找到与“{globalSearch}”相关的内容，请更换关键词重试。</div>}
                {searchResults.novels.length > 0 && (
                  <div className="global-search-group">
                    <div className="global-search-title">卷</div>
                    {renderSearchResultItem(searchResults.novels, '卷', 0)}
                  </div>
                )}
                {searchResults.shots.length > 0 && (
                  <div className="global-search-group">
                    <div className="global-search-title">分镜</div>
                    {renderSearchResultItem(searchResults.shots, '分镜', searchResults.novels.length)}
                  </div>
                )}
                {searchResults.resources.length > 0 && (
                  <div className="global-search-group">
                    <div className="global-search-title">素材</div>
                    {renderSearchResultItem(
                      searchResults.resources,
                      '素材',
                      searchResults.novels.length + searchResults.shots.length
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <nav>
            <Link to="/">首页</Link>
            <Link to="/resources">资源库</Link>
            <Link to="/rules">规则库</Link>
          </nav>
        </div>
      </header>
      {workspaceState.error && (
        <div className="workspace-error-banner">
          <span>{workspaceState.error}</span>
          <div className="row">
            {(workspaceState.errorCode === 'PERMISSION' || workspaceState.errorCode === 'UNSUPPORTED') && (
              <button type="button" className="tab" onClick={connectWorkspace}>重新授权目录</button>
            )}
            {(workspaceState.errorCode === 'DIR_MISSING' || workspaceState.errorCode === 'WRITE_FAILED') && (
              <button type="button" className="tab" onClick={regenerateWorkspaceDirs}>重新生成目录</button>
            )}
            {workspaceState.errorCode === 'WRITE_FAILED' && (
              <button type="button" className="tab" onClick={connectWorkspace}>切换目录重试</button>
            )}
          </div>
        </div>
      )}
      {workspaceState.connected && workspaceState.lastSavedAt && (
        <div className="workspace-save-banner">
          最近自动保存：{new Date(workspaceState.lastSavedAt).toLocaleString()}
        </div>
      )}

      {conflictState.hasConflict && (
        <div className="modal">
          <div className="modal-content">
            <h3>版本冲突提示</h3>
            <p>检测到该内容已在其他标签页修改，当前为旧版本。</p>
            <div className="row">
              <button type="button" className="tab" onClick={() => resolveConflict('reload_latest')}>
                放弃当前修改，加载最新内容
              </button>
              <button type="button" className="danger" onClick={() => resolveConflict('overwrite')}>
                覆盖最新内容，保存当前修改
              </button>
            </div>
          </div>
        </div>
      )}
      <main className={`app-main ${isWidePage ? 'app-main-wide' : ''}`}>{children}</main>
    </div>
  );
};

export default Layout;