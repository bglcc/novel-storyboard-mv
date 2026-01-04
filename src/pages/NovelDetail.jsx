import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';

const statusColors = {
  仅录入: 'gray',
  待审核: 'orange',
  已完成: 'green'
};

const NovelDetail = () => {
  const { novelId } = useParams();
  const { data, addChapter } = useData();
  const novel = data.novels.find((n) => n.id === novelId);
  const [title, setTitle] = useState('');

  if (!novel) return <div className="card">未找到小说。</div>;

  const handleAddChapter = () => {
    if (!title.trim()) return;
    addChapter(novelId, title.trim());
    setTitle('');
  };

  return (
    <div className="card">
      <h2>{novel.title} - 章节列表</h2>
      <div className="row">
        <input placeholder="章节标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button onClick={handleAddChapter}>新建章节</button>
      </div>
      <div className="list">
        {novel.chapters.map((chapter) => (
          <div key={chapter.id} className="list-item">
            <div>
              <div className="list-title">{chapter.title}</div>
              <div className={`status-pill ${statusColors[chapter.status] || 'gray'}`}>{chapter.status}</div>
            </div>
            <Link to={`/novel/${novelId}/chapter/${chapter.id}`} className="primary-link">
              进入章节
            </Link>
          </div>
        ))}
        {novel.chapters.length === 0 && <div className="empty">暂无章节，创建一个吧。</div>}
      </div>
    </div>
  );
};

export default NovelDetail;
