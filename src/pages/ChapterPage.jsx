import React from 'react';
import { useParams } from 'react-router-dom';
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
    <div className="stack">
      <div className="card">
        <h2>
          {novel.title} / {chapter.title}
        </h2>
        <p className="muted">
          当前章节采用“分镜驱动”模式：先完成分镜头大纲与细纲，再进 L1-L4 资源补齐与素材上传。
        </p>
      </div>
      <StoryboardEditor novelId={novelId} chapter={chapter} />
    </div>
  );
};

export default ChapterPage;
