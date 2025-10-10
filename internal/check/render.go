package check

import (
    "fmt"
    "strings"
)

// RenderSummaryCLI 将环境检查结果渲染为适合 CLI 输出的文本。
// 保持与现有 CLI 输出一致的格式，包含开始/结束分隔与缩进的详情。
func RenderSummaryCLI(summary Summary) string {
    var b strings.Builder
    b.WriteString("================ 环境检查开始 ================\n")

    for _, it := range summary.Items {
        if it.OK {
            b.WriteString(fmt.Sprintf("[✅] %s：%s\n", it.Name, it.Message))
        } else {
            b.WriteString(fmt.Sprintf("[❌] %s：%s\n", it.Name, it.Message))
        }
        if strings.TrimSpace(it.Details) != "" {
            b.WriteString(indent(it.Details, "    "))
            if !strings.HasSuffix(it.Details, "\n") {
                b.WriteString("\n")
            }
        }
    }

    b.WriteString("================ 环境检查结束 ================")
    return b.String()
}

// indent 将多行文本缩进，便于在 CLI 中更清晰展示（内部使用）
func indent(s, prefix string) string {
    lines := []byte(s)
    res := make([]byte, 0, len(lines)+len(prefix))
    prevNL := true
    for _, b := range lines {
        if prevNL {
            res = append(res, []byte(prefix)...)
            prevNL = false
        }
        res = append(res, b)
        if b == '\n' {
            prevNL = true
        }
    }
    return string(res)
}