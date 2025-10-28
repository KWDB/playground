# 关系数据查询

关系数据库支持使用 SQL 语句完成简单查询以及与其他结构组合形成的更复杂的选择查询。具体 SQL 语法格式，参见 [SQL 参考](../../sql-reference/overview.md)。

## 创建查询

简单 `SELECT` 子句是读取和处理现有数据的主要 SQL 语法。当用作独立语句时，简单 `SELECT` 子句也称为 `SELECT` 语句。但是，它也是一个选择子句，可以与其他结构组合以形成更复杂的选择查询。KWDB 支持通过 `SET CLUSTER SETTING sql.auto_limit.quantity = <value>` 配置 SQL 查询结果的返回行数。

KWDB 支持在查询中对列类型为时间戳、时间戳常量以及结果类型为时间戳的函数和表达式进行时间加减运算，运算结果支持使用大于号（`>`）、小于号（`<`）、等号（`=`）、大于等于号（`>=`）、小于等于号（`<=`）进行比较。运算中可以包含 `interval` 常量、其他时间戳列以及结果类型为 interval、timestamp 或 timstamptz 的函数和表达式。如果运算符两边均为 timestamp 或 timestamptz 类型，则只支持减法运算，差值对应的纳秒数不得超过 INT64 范围，对应的天数不得超过 `106751` 天。超出范围时，系统将显示为 `106751 days 23:47:16.854776`。

加减运算中，`interval` 常量支持的单位包括毫秒（ms）、秒（s）、分（m）、小时（h）、天（d）、周（w）、月（mon）、年（y）。目前，KWDB 不支持复合时间格式，如 `1d1h`。

毫秒、秒、分、小时的取值范围受纳秒最大值（INT64）范围限制。下表列出具体支持的取值范围：

| 单位      | 取值范围                                |
| --------- | --------------------------------------- |
| 毫秒（ms） | [-9,223,372,036,854, 9,223,372,036,854] |
| 秒（s）    | [-9,223,372,036, 9,223,372,036]         |
| 分（m）    | [-153,722,867, 153,722,867]             |
| 小时（h）  | [-2,562,047, 2,562,047]                 |

天、周、月、年的取值范围受加减计算结果的限制。计算结果对应的毫秒数不得超过 INT64 范围。

::: warning 说明
时间加减表达式支持出现在以下位置：

- `SELECT` 列表：例如 `SELECT ts+1h FROM table1;` 将返回表中时间戳列加上 1 小时后的结果。
- `WHERE` 子句：例如 `SELECT * FROM table1 WHERE ts+1h > now();` 将返回表中时间戳列加上 1 小时后大于当前时间的数据。
- `ORDER BY` 子句：例如 `SELECT * FROM table1 ORDER BY ts+1h;` 将按时间戳列加上 1 小时后的值进行排序。
- `HAVING` 子句：例如 `SELECT MAX(ts) FROM table1 GROUP BY ts HAVING ts+1h > now();` 将筛选出满足条件的分组结果。
- 参数类型为 timestamp 的函数调用：例如 `SELECT CAST(ts+1h AS timestamp) FROM table1;` 可以将时间戳列加上 1 小时后的结果转换为 timestamp 类型。
- 使用比较运算符的表示连接条件：例如 `SELECT * FROM table1,table2 WHERE table1.ts+1h > table2.ts;` 表示在连接两个表时使用时间加减条件。

### 前提条件

用户是 `admin` 角色的成员或者拥有目标表的 SELECT 权限。默认情况下，`root` 用户属于 `admin` 角色。

### 语法格式

有关关系数据查询的语法格式，参见 [SQL 参考](../../sql-reference/dml/relational-db/relational-select.md#语法格式)。

### 参数说明

有关关系数据查询的参数说明，参见 [SQL 参考](../../sql-reference/dml/relational-db/relational-select.md#参数说明)。

### 语法示例

以下示例假设已经创建 `accounts` 表并写入数据。

```sql {{exec}}
-- 1. 创建 accounts 表。
CREATE TABLE accounts (
    id      INT8    DEFAULT unique_rowid() PRIMARY KEY,
    name    STRING,
    balance DECIMAL,
    enabled BOOL
);
```

```sql {{exec}}
-- 2. 写入数据。
INSERT INTO accounts
VALUES
    (1, 'lily', 10000.5, true),
    (2, 'ruarc', 20000.75, true),
    (3, 'tullia', 30000, false),
    (4, 'arturo', 45000, false);
```

- 检索特定列。

    以下示例检索 `accounts` 表 中 `balance < 21000` 的数据。

    ```sql {{exec}}
    SELECT id FROM accounts WHERE balance < 21000;

    ```

- 检索所有列。

    以下示例检索 `accounts` 表的所有列。

    ```sql {{exec}}
    SELECT * FROM accounts;

    ```

- 使用单个条件过滤表。

    以下示例过滤 `accounts` 表中 `balance < 21000` 的数据。

    ```sql {{exec}}
    SELECT id FROM accounts WHERE balance < 21000;
    ```

- 使用多个条件过滤表。

    以下示例过滤 `accounts` 表中 `balance > 25000` 且 `enabled = false` 的数据。

    ```sql {{exec}}
    SELECT * FROM accounts WHERE balance > 25000 AND enabled = false;
    ```

- 查询无重复的行。缺少主键或者唯一性约束的列可能存在相同的值。

    以下示例查询 `accounts` 表中无重复的行。

    ```sql {{exec}}
    -- 1. 向 accounts 表中写入数据。
    INSERT INTO accounts VALUES (5, 'lily', 50000.5, true);
    ```

    ```sql {{exec}}
    -- 查询 accounts 表中 enabled=true 的数据。
    SELECT name FROM accounts WHERE enabled=true;

    ```

- 使用 `DISTINCT` 进行去重查询。

    以下示例使用 `DISTINCT` 关键字对 `accounts` 表进行去重查询。

    ```sql {{exec}}
    SELECT DISTINCT name FROM accounts WHERE enabled=true;
    ```

- 使用多个条件过滤表。

    以下示例使用 `WHERE IN(<逗号分隔的值列表>)` 子句查询 `accounts` 表中指定列的值。

    ```sql {{exec}}
    SELECT name FROM accounts WHERE balance in (10000.5, 20000.75);
    ```

- 修改输出列的名称。

    以下示例查询 `accounts` 表的 `name` 列，并使用 `AS` 关键字将输出列的列名指定为 `n`。

    ```sql {{exec}}
    SELECT name AS n, balance FROM accounts WHERE enabled=true;
    ```

- 查询字符串值。

    在 `SELECT` 语句中使用 `LIKE` 关键字在列中搜索部分匹配的字符串，支持以下通配符：

    - `%`：匹配 `0` 个或多个任意字符。
    - `_`：匹配 `1` 个任意字符。
    - `[charlist]`：匹配字符列 `charlist` 中的任意字符。
    - `charlist` 或 `[!charlist]`：不匹配字符列 `charlist` 中的任意字符。

    以下示例查询 `accounts` 表中含有 `li` 字符的数据。

    ```sql {{exec}}
    SELECT * FROM accounts WHERE name LIKE '%li%';
    ```

- 在整个列上使用聚合函数，计算数据。

    以下示例查询 `accounts` 表中 `bakance` 值最小的数据。

    ```sql {{exec}}
    SELECT MIN(balance) FROM accounts;
    ```

    KWDB 支持把聚合函数检索到的值作为 `WHERE` 子句表达式的一部分。

    ```sql {{exec}}
    SELECT id,
           name,
           balance
    FROM accounts
    WHERE balance = (SELECT MIN(balance) FROM accounts);
    ```

- 在检索出的行数据上进行聚合函数操作。

    以下示例对 `accounts` 表的数据进行过滤，然后对查询结果的 `balance` 值进行求和计算。

    ```sql {{exec}}
    SELECT SUM(balance) FROM accounts WHERE enabled=true;
    ```

- 筛选加入聚合函数中的列。

    以下示例使用 `FILTER(WHERE<BOOLEAN 表达式>)` 过滤 `accounts` 表中由聚合函数处理的行。`<BOOLEAN 表达式>` 是 `FILTER` 子句的布尔表达式。那些返回 `FALSE` 或 `NULL` 的值不会被输入到聚合函数中。

    ```sql {{exec}}
    SELECT
        count(*) AS unfiltered,
        count(*) FILTER (WHERE balance > 15000) AS filtered
    FROM accounts;
    ```

- 将检索到的行分组，然后对每组数据执行聚合函数。

    以下示例查询 `accounts` 表，使用 `GROUP BY` 子句对查询结果进行分组，然后在每行上执行聚合函数。

    ```sql {{exec}}
    SELECT
        enabled AS state,
        SUM(balance) AS state_balance
    FROM accounts
    GROUP BY enabled;
    ```

- 过滤聚合组。

    以下示例查询 `accounts` 表，使用 `GROUP BY` 子句对查询结果进行分组，然后使用 `HAVING` 子句过滤聚合组。`HAVING` 子句必须返回布尔值。

    ```sql {{exec}}
    SELECT
        enabled AS state,
        SUM(balance) AS state_balance
    FROM accounts
    GROUP BY enabled
    HAVING AVG(balance) BETWEEN 100 AND 30000;
    ```

- 在 `Having` 子句中使用聚合函数查询表。

    以下示例在 `Having` 子句中使用聚合函数查询 `accounts` 表。

    ```sql {{exec}}
    SELECT name, enabled
    FROM accounts
    WHERE enabled = true
    GROUP BY name, enabled
    HAVING count(name) > 1;
    ```

- 使用 `LIMIT` + `count` 的形式查询表。

    以下示例使用 `LIMIT` + `count` 的形式查询 `accounts` 表。

    ```sql {{exec}}
    SELECT * FROM accounts LIMIT 5;
    ```

- 使用 `FETCH FIRST` + `count` 的形式查询表。

    以下示例使用 `FETCH FIRST` + `count` 的形式查询 `accounts` 表。

    ```sql {{exec}}
    SELECT * FROM accounts FETCH FIRST 2 ROW ONLY;
    ```

- 使用 `LIMIT` 与 `OFFSET` 组合查询表。

    以下示例使用 `LIMIT` 和 `OFFSET` 关键字查询 `accounts` 表。

    ```sql {{exec}}
    SELECT id, name FROM accounts LIMIT 1 OFFSET 1;
    ```

- 当使用 `NEXT` 关键字时，此时需要和 `OFFSET` 关键字组合使用。`OFFSET n` 相当于指定了一个起始位置，从该位置开始取 `NEXT` 的 `count` 行。

    以下示例使用 `NEXT` 和 `OFFSET` 关键字查询 `accounts` 表。

    ```sql {{exec}}
    SELECT * FROM accounts OFFSET 2 rows FETCH NEXT 2 ROW ONLY;
    ```
