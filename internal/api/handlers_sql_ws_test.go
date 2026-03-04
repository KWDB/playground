package api

import "testing"

func TestIsSelectQuery(t *testing.T) {
	tests := []struct {
		name string
		sql  string
		want bool
	}{
		{name: "simple select", sql: "SELECT 1", want: true},
		{name: "leading comment select", sql: "-- head\nSELECT 1", want: true},
		{name: "block comment select", sql: "/* x */ SELECT 1", want: true},
		{name: "show command", sql: "SHOW DATABASES", want: true},
		{name: "desc command", sql: "DESC t", want: true},
		{name: "with query", sql: "WITH cte AS (SELECT 1) SELECT * FROM cte", want: true},
		{name: "leading newline", sql: "\n\tSELECT 1", want: true},
		{name: "insert", sql: "INSERT INTO t VALUES (1)", want: false},
		{name: "keyword prefix", sql: "SELECTALL * FROM t", want: false},
		{name: "comment then insert", sql: "-- c\nINSERT INTO t VALUES(1)", want: false},
		{name: "empty", sql: "   ", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isSelectQuery(tt.sql)
			if got != tt.want {
				t.Fatalf("isSelectQuery(%q)=%v, want=%v", tt.sql, got, tt.want)
			}
		})
	}
}

func TestRemoveComments(t *testing.T) {
	tests := []struct {
		name string
		sql  string
		want string
	}{
		{name: "line comment", sql: "-- a\nSELECT 1", want: " SELECT 1"},
		{name: "block comment", sql: "/*abc*/SELECT 1", want: " SELECT 1"},
		{name: "keep quoted dashes", sql: "SELECT '--x' as s", want: "SELECT '--x' as s"},
		{name: "keep quoted block tokens", sql: `SELECT "/*x*/" as s`, want: `SELECT "/*x*/" as s`},
		{name: "unterminated block comment", sql: "/*abc", want: " c"},
		{name: "escaped quotes", sql: `SELECT "a\"b"`, want: `SELECT "a\"b"`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := removeComments(tt.sql)
			if got != tt.want {
				t.Fatalf("removeComments(%q)=%q, want=%q", tt.sql, got, tt.want)
			}
		})
	}
}

func TestIsWhitespace(t *testing.T) {
	cases := []struct {
		r    rune
		want bool
	}{
		{r: ' ', want: true},
		{r: '\t', want: true},
		{r: '\n', want: true},
		{r: '\r', want: true},
		{r: '\f', want: true},
		{r: '\v', want: true},
		{r: 'A', want: false},
		{r: '1', want: false},
	}

	for _, c := range cases {
		got := isWhitespace(c.r)
		if got != c.want {
			t.Fatalf("isWhitespace(%q)=%v, want=%v", c.r, got, c.want)
		}
	}
}
