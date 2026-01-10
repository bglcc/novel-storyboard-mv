import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';

const statusColors = {
  仅录入: 'gray',
  待审核: 'orange',
  已完成: 'green'
};

const NovelDetail = () => {
  const { novelId } = useParams();
  const navigate = useNavigate();
  const { data, addChapter, updateChapter } = useData();
  const novel = data.novels.find((n) => n.id === novelId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editModal, setEditModal] = useState(null);

  if (!novel) return <div className="card">未找到小说。</div>;

  const handleAddChapter = (e) => {
    if (e) e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const newId = addChapter(novelId, title.trim(), content.trim());
    setTitle('');
    setContent('');
    setModalOpen(false);
    if (newId) navigate(`/novel/${novelId}/chapter/${newId}`);
  };

  return (
    <div className="card">
      <div className="space-between">
        <div>
          <h2>{novel.title} - 章节列表</h2>
          <p className="muted">管理章节并进入分镜编辑</p>
        </div>
        <div className="row">
          <Link to="/" className="tab">返回书架</Link>
          <button type="button" onClick={() => setModalOpen(true)}>+ 新建章节</button>
        </div>
      </div>

      <div className="list">
        {novel.chapters.map((chapter) => (
          <div key={chapter.id} className="list-item chapter-item">
            <div className="chapter-main">
              <button className="ghost" onClick={() => setEditModal(chapter)}>
                <div className="list-title chapter-title underline">{chapter.title}</div>
              </button>
            </div>
            <div className="chapter-meta">
              <div className={`status-pill ${statusColors[chapter.status] || 'gray'}`}>{chapter.status}</div>
              <Link to={`/novel/${novelId}/chapter/${chapter.id}`} className="primary-button">
                进入章节
              </Link>
            </div>
          </div>
        ))}
        {novel.chapters.length === 0 && <div className="empty">暂无章节，创建一个吧。</div>}
      </div>

      {modalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>新建章节</h3>
            <form className="stack" onSubmit={handleAddChapter}>
              <label>
                章节标题（必填）
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="请输入章节标题"
                  required
                />
              </label>
              <label>
                章节内容（必填）
                <textarea
                  className="large-input"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="请输入章节正文"
                  required
                />
              </label>
              <div className="row">
                <button type="submit" className="primary">创建并进入章节</button>
                <button type="button" className="tab" onClick={() => setModalOpen(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>编辑章节</h3>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (!editModal.title.trim() || !editModal.content.trim()) return;
                updateChapter(novelId, editModal.id, {
                  title: editModal.title.trim(),
                  content: editModal.content.trim()
                });
                setEditModal(null);
              }}
            >
              <label>
                章节标题
                <input
                  value={editModal.title}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </label>
              <label>
                章节正文
                <textarea
                  className="large-input"
                  value={editModal.content}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, content: e.target.value }))}
                  required
                />
              </label>
              <div className="row">
                <button type="submit" className="primary">保存修改</button>
                <button type="button" className="tab" onClick={() => setEditModal(null)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NovelDetail;
