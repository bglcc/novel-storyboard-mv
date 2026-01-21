import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import StoryboardEditor from '../components/StoryboardEditor';
import { useData } from '../context/DataContext';
import '../styles/novel.css';

const statusColors = {
  仅录入: 'gray',
  待审核: 'orange',
  已完成: 'green'
};

const ChapterPage = () => {
  const { novelId, chapterId } = useParams();
  const { data, updateChapter } = useData();
  const novel = data.novels.find((n) => n.id === novelId);
  const chapter = novel?.chapters.find((c) => c.id === chapterId);
  const [content, setContent] = useState(chapter?.content || '');
  const [lastSaved, setLastSaved] = useState(chapter?.storyboardUpdatedAt || null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    setContent(chapter?.content || '');
    setLastSaved(chapter?.storyboardUpdatedAt || null);
  }, [chapterId, novelId, chapter]);

  if (!chapter || !novel) return <div className="card">未找到章节。</div>;

  const computedStatus = useMemo(() => {
    if (!chapter) return '仅录入';
    if ((chapter.storyboards || []).length > 0) return '待审核';
    if ((chapter.content || '').trim()) return '仅录入';
    return '仅录入';
  }, [chapter]);

  useEffect(() => {
    if (chapter && chapter.status !== computedStatus) {
      updateChapter(novelId, chapterId, { status: computedStatus });
    }
  }, [chapter, chapterId, computedStatus, novelId, updateChapter]);

  return (
    <div className="stack">
      <div className="card">
        <h2>
          {novel.title} / {chapter.title}
        </h2>
        <div className="row space-between">
          <div className={`status-pill ${statusColors[computedStatus] || 'gray'}`}>章节状态：{computedStatus}</div>
          <div className="row">
            <button type="button" onClick={() => setShowOriginal((v) => !v)}>
              {showOriginal ? '收起原文' : '展开原文'}
            </button>
            <button type="button" className="tab" onClick={() => setEditModalOpen(true)}>
              编辑原文
            </button>
          </div>
        </div>
        {showOriginal && (
          <div className="original-box">
            <pre className="original-text">{content || '尚未填写原文'}</pre>
          </div>
        )}
      </div>
      <StoryboardEditor novelId={novelId} chapter={chapter} />

      {editModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3>编辑章节原文</h3>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                updateChapter(novelId, chapterId, { content });
                setEditModalOpen(false);
                setLastSaved(Date.now());
              }}
            >
              <textarea
                className="large-input"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="输入章节原文"
                required
              />
              <div className="row">
                <button type="submit" className="primary">保存</button>
                <button type="button" className="tab" onClick={() => setEditModalOpen(false)}>
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

export default ChapterPage;
