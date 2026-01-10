import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';

const Home = () => {
  const { data, addNovel, deleteNovel } = useData();
  const [title, setTitle] = useState('');
  const [cover, setCover] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [creating, setCreating] = useState(false);

  const readCover = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.readAsDataURL(file);
    });

  const handleAdd = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    let coverData = cover || '';
    if (!coverData && coverFile) {
      coverData = await readCover(coverFile);
      setCover(coverData);
    }
    addNovel(title.trim(), coverData);
    setTitle('');
    setCover('');
    setCoverFile(null);
    setCreating(false);
    setModalOpen(false);
  };

  const handleCoverChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setCover('');
      setCoverFile(null);
      return;
    }
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setCover(e.target.result);
    reader.readAsDataURL(file);
  };

  const filteredNovels = useMemo(() => {
    if (!search.trim()) return data.novels;
    return data.novels.filter((novel) => novel.title.toLowerCase().includes(search.trim().toLowerCase()));
  }, [data.novels, search]);

  return (
    <div className="card">
      <div className="shelf-header">
        <div>
          <h2>小说书架</h2>
          <p className="muted">点击卡片进入小说，使用搜索或右上角按钮快速新建。</p>
        </div>
        <div className="row">
          <input
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索小说"
          />
          <button type="button" onClick={() => setModalOpen(true)}>+ 新建小说</button>
        </div>
      </div>

      <div className="book-grid fixed-four">
        {filteredNovels.map((novel) => (
          <div key={novel.id} className="book-card">
            <div className="cover-frame">
              {novel.cover ? (
                <img src={novel.cover} alt={`${novel.title} 封面`} />
              ) : (
                <div className="cover-placeholder">无封面</div>
              )}
            </div>
            <div className="book-body">
              <div className="item-header">
                <h3>{novel.title}</h3>
                <button className="danger" onClick={() => setPendingDelete(novel)}>
                  删除
                </button>
              </div>
              <p className="muted">创建时间：{new Date(novel.createdAt).toLocaleString()}</p>
              <div className="row align-right">
                <Link to={`/novel/${novel.id}`} className="primary-button">
                  进入小说
                </Link>
              </div>
            </div>
          </div>
        ))}

        <button type="button" className="book-card add-card" onClick={() => setModalOpen(true)}>
          <div className="add-card-inner">
            <span className="add-icon">＋</span>
            <div>新建小说</div>
          </div>
        </button>
      </div>

      {filteredNovels.length === 0 && <div className="empty">暂无小说，创建一个吧。</div>}

      {modalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>新建小说</h3>
            <form className="stack" onSubmit={handleAdd}>
              <label>
                小说名称（必填）
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="为你的小说命名"
                  required
                />
              </label>
              <label className="file-button">
                上传封面（可选）
                <input type="file" accept="image/*" onChange={handleCoverChange} />
              </label>
              {cover && (
                <div className="cover-preview">
                  <img src={cover} alt="封面预览" />
                </div>
              )}
              <div className="row">
                <button type="submit" className="primary" disabled={creating}>
                  {creating ? '创建中...' : '创建'}
                </button>
                <button type="button" className="tab" onClick={() => setModalOpen(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="modal">
          <div className="modal-content">
            <h3>确认删除</h3>
            <p>确定删除《{pendingDelete.title}》吗？该操作不可撤销。</p>
            <div className="row">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  deleteNovel(pendingDelete.id);
                  setPendingDelete(null);
                }}
              >
                确认删除
              </button>
              <button type="button" className="tab" onClick={() => setPendingDelete(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
