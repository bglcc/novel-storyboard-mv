import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';

const Home = () => {
  const { data, addNovel, deleteNovel } = useData();
  const [title, setTitle] = useState('');

  const handleAdd = () => {
    if (!title.trim()) return;
    addNovel(title.trim());
    setTitle('');
  };

  return (
    <div className="card">
      <h2>小说列表</h2>
      <div className="row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入小说名称"
        />
        <button onClick={handleAdd}>新建小说</button>
      </div>
      <div className="grid">
        {data.novels.map((novel) => (
          <div key={novel.id} className="item-card">
            <div className="item-header">
              <h3>{novel.title}</h3>
              <button className="danger" onClick={() => deleteNovel(novel.id)}>
                删除
              </button>
            </div>
            <p>创建时间：{new Date(novel.createdAt).toLocaleString()}</p>
            <Link to={`/novel/${novel.id}`} className="primary-link">
              进入小说
            </Link>
          </div>
        ))}
        {data.novels.length === 0 && <div className="empty">尚无小说，创建一个吧。</div>}
      </div>
    </div>
  );
};

export default Home;
