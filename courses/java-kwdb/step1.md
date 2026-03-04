首先，我们先准备 KaiwuDB JDBC 驱动，然后使用 Java 程序连接 KWDB。

## JDBC 驱动

`kaiwudb-jdbc.jar` 驱动包已经预下载到 `/tmp/kaiwudb-jdbc.jar`。查看驱动包是否存在：

```bash
ls -l /tmp/kaiwudb-jdbc.jar
```

## 连接 KWDB

```java
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

class Main {
    public static void main(String[] args) throws Exception {
        Class.forName("com.kaiwudb.Driver");

        String url = "jdbc:kaiwudb://127.0.0.1:26257/defaultdb";
        String user = "root";
        String password = "";

        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {
            ResultSet rs = stmt.executeQuery("SELECT 1 AS result");
            if (rs.next()) {
                System.out.println("连接测试结果: " + rs.getInt("result"));
            }
        }

        System.out.println("连接已关闭");
    }
}
```

## 代码说明

| 参数 | 说明 |
|------|------|
| `Class.forName("com.kaiwudb.Driver")` | 加载 KaiwuDB JDBC 驱动 |
| `url` | KaiwuDB JDBC 连接地址 |
| `user` | 用户名，默认 `root` |
| `password` | 密码，`--insecure` 模式下为空 |

> 注意：请先启动容器，确保 KWDB 服务已运行。
