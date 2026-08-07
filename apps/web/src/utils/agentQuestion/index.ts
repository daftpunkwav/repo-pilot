/**
 * agentQuestion 模块入口（§4.2.16 N-02 拆分第一步）。
 *
 * 完整实现仍在 `../agentQuestion.ts`（716 行），本入口仅 re-export 公开 API，
 * 方便按职责逐步拆出 `formatters/`、`parsers/`、`hydrate/` 等子模块。
 *
 * 当前已抽离的子模块：
 *   - `formatters.ts`：标签格式化 / 卡片摘要 / 答案摘要 / 记忆芯片
 *
 * 拆分原则：保持公开 API 不变；测试断言覆盖的语义不变；逐步替换原文件中的实现。
 */
export * from '../agentQuestion';