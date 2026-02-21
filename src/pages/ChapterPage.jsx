import React from 'react';
import { Link, useParams } from 'react-router-dom';
import StoryboardEditor from '../components/StoryboardEditor';
import { useData } from '../context/DataContext';
import '../styles/novel.css';

const ChapterPage = () => {
  const { novelId, chapterId } = useParams();
  const { data } = useData();
  const novel = data.novels.find((item) => item.id === novelId);
  const chapter = novel?.chapters.find((item) => item.id === chapterId);

  if (!novel || !chapter) return <div className="card">未找到章节。</div>;

  return (
    <div className="chapter-workbench-page">
      <div className="chapter-topbar">
        <div className="chapter-topbar-title">
          <strong>{novel.title}</strong>
          <span>/</span>
          <span>{chapter.title}</span>
        </div>
        <Link to={`/novel/${novelId}`} className="chapter-exit-button">
          退出章节
        </Link>
      </div>
      <StoryboardEditor novelId={novelId} chapter={chapter} />
    </div>
  );
};

export default ChapterPage;
