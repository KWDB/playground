连接成功后，我们继续创建数据库、关系表和时序表。

## 创建数据库

```java
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

class Main {
    public static void main(String[] args) throws Exception {
        Class.forName("com.kaiwudb.Driver");
        String url = "jdbc:kaiwudb://127.0.0.1:26257/defaultdb";
        try (Connection conn = DriverManager.getConnection(url, "root", "");
             Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE DATABASE shop_java");
            System.out.println("数据库 shop_java 创建成功");
        }
    }
}
```

## 创建商品表

```java
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

class Main {
    public static void main(String[] args) throws Exception {
        Class.forName("com.kaiwudb.Driver");
        String url = "jdbc:kaiwudb://127.0.0.1:26257/shop_java";
        try (Connection conn = DriverManager.getConnection(url, "root", "");
             Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE products (
                    id SERIAL PRIMARY KEY,
                    name STRING,
                    price DECIMAL(10, 2),
                    stock INT
                )
            """);
            System.out.println("表 products 创建成功");
        }
    }
}
```

## 创建时序表

```java
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

class Main {
    public static void main(String[] args) throws Exception {
        Class.forName("com.kaiwudb.Driver");
        String url = "jdbc:kaiwudb://127.0.0.1:26257/shop_java";
        try (Connection conn = DriverManager.getConnection(url, "root", "");
             Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE sensor_data (
                    ts TIMESTAMP,
                    device_id STRING,
                    temperature DOUBLE,
                    humidity DOUBLE
                )
            """);
            System.out.println("时序表 sensor_data 创建成功");
        }
    }
}
```

> 提示：如果数据库已存在，可先执行 `DROP DATABASE IF EXISTS shop_java`。
