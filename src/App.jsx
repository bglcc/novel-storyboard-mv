import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import NovelDetail from './pages/NovelDetail';
import ChapterPage from './pages/ChapterPage';
import ResourceLibrary from './pages/ResourceLibrary';
import ResourceDetail from './pages/ResourceDetail';
import RuleLibrary from './pages/RuleLibrary';
import ExpressionFormsLibrary from './pages/ExpressionFormsLibrary';
import ExpressionFormDetail from './pages/ExpressionFormDetail';

const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/novel/:novelId" element={<NovelDetail />} />
        <Route path="/novel/:novelId/chapter/:chapterId" element={<ChapterPage />} />
        <Route path="/resources" element={<ResourceLibrary />} />
        <Route path="/resources/:type/:resourceId" element={<ResourceDetail />} />
        <Route path="/expression-forms" element={<ExpressionFormsLibrary />} />
        <Route path="/expression-forms/:expressionId" element={<ExpressionFormDetail />} />
        <Route path="/rules" element={<RuleLibrary />} />
      </Routes>
    </Layout>
  );
};

export default App;
