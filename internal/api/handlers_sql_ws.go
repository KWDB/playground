package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"kwdb-playground/internal/course"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func isSelectQuery(sqlText string) bool {
	cleanSQL := removeComments(sqlText)
	cleanSQL = strings.TrimSpace(strings.ToUpper(cleanSQL))

	if cleanSQL == "" {
		return false
	}

	queryKeywords := []string{"SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "WITH"}

	for _, keyword := range queryKeywords {
		if strings.HasPrefix(cleanSQL, keyword) {
			if len(cleanSQL) == len(keyword) ||
				(len(cleanSQL) > len(keyword) && isWhitespace(rune(cleanSQL[len(keyword)]))) {
				return true
			}
		}
	}

	return false
}

func removeComments(sql string) string {
	var result strings.Builder
	runes := []rune(sql)
	i := 0

	for i < len(runes) {
		if i < len(runes)-1 && runes[i] == '-' && runes[i+1] == '-' {
			for i < len(runes) && runes[i] != '\n' && runes[i] != '\r' {
				i++
			}
			if i < len(runes) && (runes[i] == '\n' || runes[i] == '\r') {
				result.WriteRune(' ')
				i++
			}
			continue
		}

		if i < len(runes)-1 && runes[i] == '/' && runes[i+1] == '*' {
			i += 2
			for i < len(runes)-1 {
				if runes[i] == '*' && runes[i+1] == '/' {
					i += 2
					break
				}
				i++
			}
			result.WriteRune(' ')
			continue
		}

		if runes[i] == '\'' || runes[i] == '"' {
			quote := runes[i]
			result.WriteRune(runes[i])
			i++

			for i < len(runes) {
				if runes[i] == quote {
					result.WriteRune(runes[i])
					i++
					break
				}
				if runes[i] == '\\' && i < len(runes)-1 {
					result.WriteRune(runes[i])
					i++
					if i < len(runes) {
						result.WriteRune(runes[i])
						i++
					}
				} else {
					result.WriteRune(runes[i])
					i++
				}
			}
			continue
		}

		result.WriteRune(runes[i])
		i++
	}

	return result.String()
}

func isWhitespace(r rune) bool {
	return r == ' ' || r == '\t' || r == '\n' || r == '\r' || r == '\f' || r == '\v'
}

func (h *Handler) handleSqlWebSocket(c *gin.Context) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error("SQL WebSocket升级失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "WebSocket连接升级失败"})
		return
	}
	defer conn.Close()

	const (
		writeWait  = 10 * time.Second
		pongWait   = 60 * time.Second
		pingPeriod = (pongWait * 9) / 10
	)

	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	var courseObj *course.Course
	ctx := context.Background()

	stopPing := make(chan struct{})
	go func() {
		ticker := time.NewTicker(pingPeriod)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				conn.SetWriteDeadline(time.Now().Add(writeWait))
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					h.logger.Debug("SQL WebSocket发送ping失败: %v", err)
					return
				}
			case <-stopPing:
				return
			}
		}
	}()

	for {
		var msg map[string]interface{}
		if err := conn.ReadJSON(&msg); err != nil {
			h.logger.Debug("SQL WebSocket读取结束或错误: %v", err)
			close(stopPing)
			return
		}
		conn.SetReadDeadline(time.Now().Add(pongWait))
		t, _ := msg["type"].(string)
		switch t {
		case "init":
			courseID, _ := msg["courseId"].(string)
			if strings.TrimSpace(courseID) == "" {
				_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": "缺少 courseId"})
				continue
			}
			if co, ok := h.courseService.GetCourse(courseID); ok {
				courseObj = co
			} else {
				_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": "课程不存在"})
				continue
			}
			port := h.resolveSQLRuntimePort(ctx, courseObj)
			if port <= 0 {
				_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": "课程未配置 backend.port"})
				continue
			}
			courseForConnect := *courseObj
			courseForConnect.Backend.Port = port
			if err := h.sqlDriverManager.EnsureReady(ctx, &courseForConnect, h.resolveDBHost(ctx, courseID)); err != nil {
				_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": fmt.Sprintf("KWDB未就绪: %v", err)})
				continue
			}
			_ = conn.WriteJSON(map[string]interface{}{"type": "ready"})
			_ = conn.WriteJSON(map[string]interface{}{"type": "info", "port": port, "connected": true})
		case "query":
			if courseObj == nil || h.sqlDriverManager.Pool(courseObj.ID) == nil {
				_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": "连接未初始化"})
				continue
			}
			sqlText, _ := msg["sql"].(string)
			qid, _ := msg["queryId"].(string)
			if strings.TrimSpace(sqlText) == "" {
				_ = conn.WriteJSON(map[string]interface{}{"type": "error", "queryId": qid, "message": "SQL不能为空"})
				continue
			}

			if isSelectQuery(sqlText) {
				rows, err := h.sqlDriverManager.Pool(courseObj.ID).Query(ctx, sqlText)
				if err != nil {
					_ = conn.WriteJSON(map[string]interface{}{"type": "error", "queryId": qid, "message": err.Error()})
					continue
				}

				fieldDescs := rows.FieldDescriptions()
				cols := make([]string, 0, len(fieldDescs))
				for _, f := range fieldDescs {
					cols = append(cols, string(f.Name))
				}

				outRows := make([][]interface{}, 0, 128)
				for rows.Next() {
					vals, err := rows.Values()
					if err != nil {
						_ = conn.WriteJSON(map[string]interface{}{"type": "error", "queryId": qid, "message": err.Error()})
						break
					}

					formattedVals := make([]interface{}, len(vals))
					for i, val := range vals {
						if t, ok := val.(time.Time); ok {
							formattedVals[i] = t.Format(time.RFC3339)
						} else {
							formattedVals[i] = val
						}
					}

					outRows = append(outRows, formattedVals)
				}

				rows.Close()

				h.logger.Debug("[handleSqlWebSocket] 查询结果，列: %v, 行: %v", cols, outRows)

				_ = conn.WriteJSON(map[string]interface{}{
					"type":     "result",
					"queryId":  qid,
					"columns":  cols,
					"rows":     outRows,
					"rowCount": len(outRows),
					"hasMore":  false,
				})
			} else {
				commandTag, err := h.sqlDriverManager.Pool(courseObj.ID).Exec(ctx, sqlText)
				if err != nil {
					_ = conn.WriteJSON(map[string]interface{}{"type": "error", "queryId": qid, "message": err.Error()})
					continue
				}

				rowsAffected := commandTag.RowsAffected()

				_ = conn.WriteJSON(map[string]interface{}{
					"type":     "result",
					"queryId":  qid,
					"columns":  []string{},
					"rows":     [][]interface{}{},
					"rowCount": int(rowsAffected),
					"hasMore":  false,
				})
			}

			_ = conn.WriteJSON(map[string]interface{}{"type": "complete", "queryId": qid})
		case "subscribe":
			_ = conn.WriteJSON(map[string]interface{}{"type": "subscribed"})
		case "ping":
			_ = conn.WriteJSON(map[string]interface{}{"type": "pong"})
		default:
			_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": "未知消息类型"})
		}
	}
}
