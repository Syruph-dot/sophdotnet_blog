# PRD: 博客相似度推荐与热度排行系统

## Problem Statement

Sophdotnet 博客系统目前侧边栏的「相关推荐」和「热度文章」区域为空占位符，无实际功能。随机推荐使用 sessionStorage 级种子，同标签页内刷新不变，用户体验僵硬。系统没有任何持久化层——`POST /api/pageview` 路由弃置数据，文章元数据（标签、日期）未被解析，无法支撑任何推荐或排行逻辑。

读者无法发现与当前阅读内容相关的其他文章，也无法看到社区热度趋势，内容发现效率低。

## Solution

引入 SQLite 持久化层，实现三大推荐支柱：

1. **相似度推荐** — 基于文章正文的 TF-IDF 向量余弦相似度，提供每篇文章的相关推荐
2. **热度排行** — 基于真实 pageview 聚合，按今日/本周/全部时间窗口展示热门文章
3. **随机推荐优化** — 保留种子化随机，可选嵌入相似度降采样以提升推荐多样性

所有新功能保持零外部 API 依赖（TF-IDF 纯本地计算），不与现有文件监听、前端 SPA 架构冲突。

## User Stories

1. 作为博客读者，我希望在阅读一篇文章时看到与之内容相似的其他文章推荐，以便连贯地探索相关主题
2. 作为博客读者，我希望看到博客整体的热门文章排行（今日/本周/全部），以便快速了解社区关注焦点
3. 作为博客读者，我希望随机推荐文章每次打开新标签页时刷新，以获得新鲜发现体验
4. 作为博客读者，我不想在同一篇文章上反复刷新计数（同 session 去重），以保证热度数据的真实性
5. 作为博客管理员，我希望新增/修改文章后相似度推荐自动更新，无需手动触发
6. 作为博客管理员，我期望系统在无外部 API 的情况下正常工作，降低运维成本和故障点
7. 作为开发者，我希望持久化层有独立测试，以验证 pageview 聚合和相似度查询的正确性
8. 作为开发者，我希望 TF-IDF 向量计算有隔离测试，以确保文本向量化和余弦相似度计算准确

## Implementation Decisions

### DL-01: 持久化层使用 better-sqlite3

| 项目 | 选择 |
|---|---|
| 驱动 | `better-sqlite3`（同步 API，适合单进程 Node.js） |
| 数据文件 | `data/blog.db`（加入 `.gitignore`） |
| 表结构 | 三张表：`pageviews`, `embeddings`, `tfidf_terms` |

**Schema:**

```sql
CREATE TABLE pageviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    session_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_pageviews_path ON pageviews(path);
CREATE INDEX idx_pageviews_created ON pageviews(created_at);

CREATE TABLE embeddings (
    path TEXT PRIMARY KEY,
    vector BLOB NOT NULL,        -- Float32Array 序列化
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE tfidf_terms (
    term TEXT NOT NULL,
    path TEXT NOT NULL,
    tf REAL NOT NULL,
    idf REAL NOT NULL,
    PRIMARY KEY (term, path)
);
```

理由：embedding 存两份（原始向量 + TF-IDF 稀疏表示），TF-IDF 表支持 SQL 级相似度 JOIN，避免全表向量加载。

### DL-02: 嵌入方案使用 TF-IDF（第一阶段）

采用 TF-IDF + 余弦相似度，纯本地计算：

- 分词：中文使用 `nodejieba`，英文/代码按空白符拆分
- 停用词：内置基础中文+英文停用词表
- 向量化：每个文档表示为 `{term: tf-idf}` 稀疏映射
- 相似度：余弦相似度（仅交并集非零维度计算）
- 触发：服务启动时全量计算 + `fs.watch` 回调增量更新

第一阶段不做 LLM embedding。TF-IDF 对技术博客和叙事文本的词汇重叠有足够区分度。后续可在 TF-IDF 基础上叠加 LLM embedding 作为第二阶段优化。

### DL-03: Store 模块接口

`store.js` 导出以下接口：

```javascript
// Pageview
incrementPageview(path, sessionId)    // 同 session 同 path 只计一次
getTopPosts(limit, timeframe)         // timeframe: 'today' | 'week' | 'all'
clearPageviewsBefore(date)           // 数据老化

// Embedding / similarity
upsertEmbedding(path, vector)         // 存储或更新向量
deleteEmbedding(path)                 // 文章删除时清理
findSimilar(path, limit)              // 返回按余弦相似度降序的 [{path, similarity}]
findSimilarToVector(vector, limit)    // 供随机推荐的多样性降采样使用

// TF-IDF
upsertTfidfTerms(path, terms)         // 批量写入词项权重
getTfidfVector(path)                  // 取出稀疏向量用于相似度计算
```

### DL-04: EmbeddingService 模块接口

`embedding-service.js` 导出：

```javascript
// 生命周期
initialize(allPosts)                  // 启动时全量计算，写入 store
onFileChanged(changedPath)            // 文件变化时增量更新单篇文章
onFileRemoved(removedPath)            // 文件删除时清理对应数据

// 文本处理
tokenize(text)                        // 分词 + 去停用词
computeTfidf(tokens, allPostsTokens)  // 计算 TF-IDF 权重
cosineSimilarity(vecA, vecB)          // 余弦相似度
```

### DL-05: API 路由变更

| 方法 | 路径 | 变更 |
|---|---|---|
| `POST` | `/api/pageview` | 从空转改为调用 `store.incrementPageview()` |
| `GET` | `/api/blog/related` | **新增**，参数 `?path=&count=`，返回相似文章列表 |
| `GET` | `/api/blog/hot` | **新增**，参数 `?count=&timeframe=`，返回热门文章列表 |
| `GET` | `/api/blog/random` | 不变（种子化随机保留） |

**响应格式（related & hot）：**

```json
{
  "ok": true,
  "data": [
    { "title": "文章标题", "path": "category/article", "similarity": 0.85 },
    ...
  ]
}
```

### DL-06: 前端变更

- `blog.html`：替换「相关推荐」和「热度文章」占位符 `<div class="empty-side">` 为实际 API 调用 + 渲染逻辑
- 渲染风格与现有的随机推荐列表一致（`<ul class="side-list">` 结构）
- 相关推荐在文章切换时自动刷新；热度文章在页面加载时获取
- 错误状态：API 失败时显示简洁提示，不阻塞主体内容

### DL-07: `.gitignore` 变更

添加 `data/` 目录至 `.gitignore`，避免 SQLite 数据文件进入版本控制。

## Testing Decisions

### 测试原则

- 只测外部行为，不测实现细节
- Store 模块：测试真实 SQLite 文件（使用临时文件 `:memory:`），验证 CRUD 和聚合查询的正确性
- EmbeddingService 模块：测试分词、TF-IDF 权重计算、余弦相似度值
- API 路由：使用 `supertest` 挂载 Express app 测试 HTTP 响应

### 测试清单

| 模块 | 测试内容 | 已有测试参照 |
|---|---|---|
| `store.js` | pageview 自增、同 session 去重、timeframe 聚合 TOP N、embedding upsert/findSimilar、tfidf terms 批量写入 | `tests/blog-service.test.js`（同类独立模块测试） |
| `embedding-service.js` | 中英文分词、停用词过滤、TF-IDF 权重计算、余弦相似度对称性/边界值 | `tests/blog-service.test.js`（纯函数测试） |
| API 路由 | `GET /api/blog/related` 返回格式与排序、`GET /api/blog/hot` 分时间段聚合、错误路径返回 400 | 无现有 HTTP 集成测试，属新增 |

### 测试文件

```
tests/store.test.js
tests/embedding-service.test.js
tests/api-related.test.js
tests/api-hot.test.js
```

## Out of Scope

- **LLM/外部 embedding API 集成**：第一阶段使用 TF-IDF 纯本地方案
- **用户认证与后台管理界面**：不涉及登录、管理面板
- **文章浏览历史/个性化推荐**：不基于用户历史行为做个性化
- **实时协同过滤**：不考虑用户群体行为交叉分析
- **全文搜索引擎**：不替换已有文件系统扫描，不引入 Elasticsearch 等

## Further Notes

- 建议在实现前先安装 `better-sqlite3` 和 `nodejieba` 两个 npm 包
- `nodejieba` 需要 C++ 编译环境（node-gyp），Windows 下需提前确认 `build-tools` 可用
- 数据老化策略：`pageviews` 表定期清理 90 天前的原始记录，但保留聚合缓存（可选 Phase 2）
- 随机推荐可考虑将 "低相似度降采样" 作为后续优化：从高热度文章中按覆盖度采样，保证推荐既有新鲜度又有质量（Phased beyond v1）
