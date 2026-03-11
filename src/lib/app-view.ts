export type AppView = "capture" | "review" | "practice" | "story" | "essay" | "article" | "speaking";

export function getPrimaryNavView(view: AppView): AppView {
  if (view === "practice" || view === "story") return "review";
  return view;
}

export function getViewLabel(view: AppView): string {
  switch (view) {
    case "capture":
      return "新增单词";
    case "review":
      return "单词本";
    case "practice":
      return "练习";
    case "story":
      return "故事";
    case "speaking":
      return "听说训练";
    case "article":
      return "文章阅读";
    case "essay":
      return "作文批改";
    default:
      return "LexiCapture";
  }
}

export function getViewDescription(view: AppView): string | undefined {
  switch (view) {
    case "capture":
      return "手动输入或拍照/上传图片采集单词。";
    case "review":
      return "按周复习、分组管理，并生成练习与故事。";
    case "speaking":
      return "跟读训练与 AI 对话，提升口语表达。";
    case "article":
      return "分析文章结构与词汇，生成阅读理解题。";
    case "essay":
      return "雅思写作 Task 2 批改与优化建议。";
    default:
      return undefined;
  }
}

