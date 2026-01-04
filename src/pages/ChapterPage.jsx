import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import StoryboardEditor from '../components/StoryboardEditor';
import { useData } from '../context/DataContext';

const statusOptions = ['仅录入', '待审核', '已完成'];

const ChapterPage = () => {
  const { novelId, chapterId } = useParams();
  const { data, updateChapter } = useData();
  const novel = data.novels.find((n) => n.id === novelId);
  const chapter = novel?.chapters.find((c) => c.id === chapterId);
  const [content, setContent] = useState(chapter?.content || '');
  const [status, setStatus] = useState(chapter?.status || '仅录入');
  const [lastSaved, setLastSaved] = useState(chapter?.storyboardUpdatedAt || null);

  useEffect(() => {
    setContent(chapter?.content || '');
    setStatus(chapter?.status || '仅录入');
    setLastSaved(chapter?.storyboardUpdatedAt || null);
  }, [chapterId, novelId, chapter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (chapter) {
        updateChapter(novelId, chapterId, { content });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [content]);

  if (!chapter || !novel) return <div className="card">未找到章节。</div>;

  const handleManualSave = () => {
    updateChapter(novelId, chapterId, { content });
    setLastSaved(Date.now());
  };

  const handleStatusChange = (value) => {
    setStatus(value);
    updateChapter(novelId, chapterId, { status: value });
  };

  return (
    <div className="stack">
      <div className="card">
        <h2>
          {novel.title} / {chapter.title}
        </h2>
        <div className="row">
          <label>
            章节状态
            <select value={status} onChange={(e) => handleStatusChange(e.target.value)}>
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <div>自动保存，最近手动保存：{lastSaved ? new Date(lastSaved).toLocaleString() : '未手动保存'}</div>
          <button onClick={handleManualSave}>手动保存原文</button>
        </div>
        <textarea
          className="large-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="输入章节原文，自动保存"
        />
      </div>
      <StoryboardEditor novelId={novelId} chapter={chapter} />
    </div>
  );
};

export default ChapterPage;
