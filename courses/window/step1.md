## 技术特点

KWDB 的分组窗口查询具备以下特点：

1. 必须搭配 `GROUP BY` 使用，并对每个窗口分别输出聚合结果。
2. 适用于时序表单表查询，适合对设备时序数据做连续区间分析。
3. 支持时间窗口、会话窗口、状态窗口、事件窗口、计数窗口五种窗口模型，能覆盖大多数时序分析场景。

## 使用规则

1. 分组窗口函数仅用于时序表单表查询，不支持嵌套子查询、关联查询和联合查询。
2. 分组窗口函数必须出现在 `GROUP BY` 子句中，可单独使用，也可与主标签组合使用。
3. 表内单个设备的数据应按时间戳有序，且时间戳不应重复。
4. `SESSION_WINDOW` 的间隔参数支持 `s`、`m`、`h`、`d`、`w`，不支持 `1m2s` 这类复合时间格式。
5. `STATE_WINDOW` 适合直接作用于整型、布尔值和字符类型的状态列。
6. `COUNT_WINDOW` 的滑动值不能大于窗口行数，且必须为正整数。
7. `TIME_WINDOW` 支持设置滑动时间，但滑动时间不应大于窗口大小，且不建议与窗口大小差距过大。

## 语法格式

```sql
SELECT select_list
FROM ts_table
[WHERE condition]
GROUP BY [<ptag>,] group_window_function;

group_window_function: {
    COUNT_WINDOW(count_val[, sliding_val])
  | EVENT_WINDOW(start_trigger_condition, end_trigger_condition)
  | SESSION_WINDOW(ts_col, tol_val)
  | STATE_WINDOW(column_name)
  | TIME_WINDOW(ts_col, duration[, sliding_time])
}
```

## 生成数据

**启动数据库**

启动 KWDB（非安全模式）：
```bash {{exec}}
./kwbase start-single-node --insecure --listen-addr=0.0.0.0:26257 --http-addr=0.0.0.0:8080 --store=./kwbase-data --background > kwbase.log 2>&1
```

可以指定数据存储路径，如 `bash generate_data.sh ./kwbase-data12`，该路径需要与启动命令中的 `--store` 的保持一致，如果不指定的话，默认是 `./kwbase-data`

```bash {{exec}}
./generate_data.sh
```

创建数据库、时序表、关系表，并将数据导入表中

```bash {{exec}}
./kwbase sql --insecure --host=127.0.0.1 < create_load.sql
```
